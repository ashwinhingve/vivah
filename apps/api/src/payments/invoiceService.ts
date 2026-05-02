/**
 * Smart Shaadi — Invoice Service (GST-compliant).
 *
 * Generates sequential invoice numbers per Indian financial year:
 *   SS/2526/000001 — fiscal year 2025-26, sequence #1
 *
 * Splits tax into CGST+SGST (intra-state) or IGST (inter-state).
 * Creates immutable `invoices` rows with full line items and tax breakdown.
 *
 * Default GST rate: 18% (services). Override via input.taxRate.
 */
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { appendAuditLog } from './service.js';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import type { InvoiceLineItem } from '@smartshaadi/types';

export class InvoiceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'InvoiceError';
  }
}

const PLATFORM_GSTIN = process.env['PLATFORM_GSTIN'] ?? '27AAAAA0000A1Z5';
const PLATFORM_STATE = process.env['PLATFORM_STATE'] ?? 'Maharashtra';
const DEFAULT_HSN    = '998596'; // SAC for "Wedding Planning Services"

function fyForDate(d: Date): string {
  const month = d.getUTCMonth() + 1;
  const year  = d.getUTCFullYear();
  // Indian fiscal year runs Apr 1 → Mar 31
  const startYear = month >= 4 ? year : year - 1;
  const endYear   = (startYear + 1) % 100;
  return `${String(startYear % 100).padStart(2, '0')}${String(endYear).padStart(2, '0')}`;
}

async function nextInvoiceNumber(now: Date): Promise<{ invoiceNo: string; financialYear: string; counter: number }> {
  const fy = fyForDate(now);

  return db.transaction(async (tx) => {
    // Insert-or-increment using ON CONFLICT
    const [seq] = await tx
      .insert(schema.invoiceSequences)
      .values({ financialYear: fy, lastNumber: 1, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.invoiceSequences.financialYear,
        set:    { lastNumber: sql`${schema.invoiceSequences.lastNumber} + 1`, updatedAt: now },
      })
      .returning();

    const counter = seq!.lastNumber;
    const invoiceNo = `SS/${fy}/${String(counter).padStart(6, '0')}`;
    return { invoiceNo, financialYear: fy, counter };
  });
}

function computeTax(taxableValue: number, customerState: string | null, taxRate = 18) {
  const isIntraState = !customerState || customerState.toLowerCase() === PLATFORM_STATE.toLowerCase();
  const totalTax     = Math.round(taxableValue * taxRate) / 100;
  if (isIntraState) {
    const half = Math.round(totalTax * 50) / 100;
    return { cgst: half, sgst: totalTax - half, igst: 0, totalTax };
  }
  return { cgst: 0, sgst: 0, igst: totalTax, totalTax };
}

export interface IssueInvoiceInput {
  bookingId?:     string;
  orderId?:       string;
  paymentId?:     string;
  customerId:     string;
  customerName:   string;
  customerGstin?: string;
  customerState?: string;
  vendorId?:      string;
  vendorName?:    string;
  vendorGstin?:   string;
  hsnCode?:       string;
  taxRate?:       number;
  discount?:      number;
  notes?:         string;
  lineItems:      InvoiceLineItem[];
}

export async function issueInvoice(input: IssueInvoiceInput) {
  if (input.lineItems.length === 0) throw new InvoiceError('NO_ITEMS', 'At least one line item required');
  if (input.bookingId) {
    const [existing] = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.bookingId, input.bookingId), eq(schema.invoices.status, 'ISSUED')))
      .limit(1);
    if (existing) {
      const [full] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, existing.id));
      return full!;
    }
  }

  const subtotal     = input.lineItems.reduce((s, li) => s + li.amount, 0);
  const discount     = input.discount ?? 0;
  const taxableValue = Math.max(0, subtotal - discount);
  const tax          = computeTax(taxableValue, input.customerState ?? null, input.taxRate ?? 18);
  const totalAmount  = Math.round((taxableValue + tax.totalTax) * 100) / 100;

  const now = new Date();
  const { invoiceNo } = await nextInvoiceNumber(now);

  const [invoice] = await db
    .insert(schema.invoices)
    .values({
      invoiceNo,
      bookingId:     input.bookingId ?? null,
      orderId:       input.orderId ?? null,
      paymentId:     input.paymentId ?? null,
      customerId:    input.customerId,
      vendorId:      input.vendorId ?? null,
      customerName:  input.customerName,
      customerGstin: input.customerGstin ?? null,
      vendorName:    input.vendorName ?? null,
      vendorGstin:   input.vendorGstin ?? PLATFORM_GSTIN,
      placeOfSupply: input.customerState ?? PLATFORM_STATE,
      hsnCode:       input.hsnCode ?? DEFAULT_HSN,
      subtotal:      String(subtotal),
      discount:      String(discount),
      taxableValue:  String(taxableValue),
      cgst:          String(tax.cgst),
      sgst:          String(tax.sgst),
      igst:          String(tax.igst),
      totalTax:      String(tax.totalTax),
      totalAmount:   String(totalAmount),
      taxBreakdown:  { rate: input.taxRate ?? 18, ...tax },
      lineItems:     input.lineItems as unknown as Record<string, unknown>,
      status:        'ISSUED',
      issuedAt:      now,
      notes:         input.notes ?? null,
    })
    .returning();

  await appendAuditLog({
    eventType:  'INVOICE_GENERATED',
    entityType: 'invoice',
    entityId:   invoice!.id,
    actorId:    input.customerId,
    payload:    { invoiceNo, totalAmount, taxableValue, taxBreakdown: tax },
  });

  void notificationsQueue
    .add('INVOICE_AVAILABLE', {
      type:    'INVOICE_AVAILABLE',
      userId:  input.customerId,
      payload: { invoiceId: invoice!.id, invoiceNo, totalAmount },
    })
    .catch(() => undefined);

  return invoice!;
}

export async function getInvoice(invoiceId: string, userId: string) {
  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);
  if (!invoice) throw new InvoiceError('NOT_FOUND', 'Invoice not found');
  if (invoice.customerId !== userId) {
    // Allow admin override at higher layer if needed
    throw new InvoiceError('FORBIDDEN', 'Not your invoice');
  }
  return invoice;
}

export async function listMyInvoices(userId: string, limit = 50) {
  return db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.customerId, userId))
    .orderBy(desc(schema.invoices.issuedAt))
    .limit(limit);
}

export async function adminListInvoices(adminId: string, fromDate?: string, toDate?: string, limit = 200) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new InvoiceError('FORBIDDEN', 'Admin role required');

  const from = fromDate ? new Date(`${fromDate}T00:00:00Z`) : undefined;
  const to   = toDate ? new Date(`${toDate}T23:59:59Z`) : undefined;

  return db
    .select()
    .from(schema.invoices)
    .where(
      and(
        from ? gte(schema.invoices.issuedAt, from) : undefined,
        to   ? lte(schema.invoices.issuedAt, to)   : undefined,
      ),
    )
    .orderBy(desc(schema.invoices.issuedAt))
    .limit(limit);
}

/** Cancel an invoice and (optionally) issue a credit note pointing at it. */
export async function cancelInvoice(adminId: string, invoiceId: string, issueCreditNote: boolean) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new InvoiceError('FORBIDDEN', 'Admin role required');

  const [original] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);
  if (!original) throw new InvoiceError('NOT_FOUND', 'Invoice not found');
  if (original.status === 'CANCELLED') throw new InvoiceError('ALREADY_CANCELLED', 'Already cancelled');

  await db
    .update(schema.invoices)
    .set({ status: 'CANCELLED', cancelledAt: new Date() })
    .where(eq(schema.invoices.id, invoiceId));

  await appendAuditLog({
    eventType:  'INVOICE_CANCELLED',
    entityType: 'invoice',
    entityId:   invoiceId,
    actorId:    adminId,
    payload:    { invoiceNo: original.invoiceNo },
  });

  if (issueCreditNote) {
    const lineItems = original.lineItems as unknown as InvoiceLineItem[];
    const negated   = lineItems.map(li => ({ ...li, amount: -li.amount, quantity: li.quantity }));
    const cn: IssueInvoiceInput = {
      customerId:   original.customerId,
      customerName: original.customerName,
      lineItems:    negated,
      notes:        `Credit note for invoice ${original.invoiceNo}`,
      ...(original.customerGstin  ? { customerGstin:  original.customerGstin  } : {}),
      ...(original.placeOfSupply  ? { customerState:  original.placeOfSupply  } : {}),
      ...(original.vendorId       ? { vendorId:       original.vendorId       } : {}),
      ...(original.vendorName     ? { vendorName:     original.vendorName     } : {}),
      ...(original.vendorGstin    ? { vendorGstin:    original.vendorGstin    } : {}),
      ...(original.hsnCode        ? { hsnCode:        original.hsnCode        } : {}),
    };
    return issueInvoice(cn);
  }
  return null;
}
