/**
 * Smart Shaadi — Order Service
 *
 * Handles order lifecycle: create → confirm → ship → deliver → cancel.
 *
 * Rule 12 note: orders.customerId → user.id (TEXT) — passes through directly
 *               orderItems.vendorId → vendors.id (uuid)
 *               vendors.userId → user.id (TEXT) — resolve for vendor ownership checks
 *
 * Stock rule: ALL stock decrements happen inside db.transaction (anti-overbooking, Week 8 lesson).
 * Price rule: unitPrice captured from product.price at order time — never recalculate from current price.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { products, orders, orderItems, vendors } from '@smartshaadi/db';
import * as razorpay from '../lib/razorpay.js';
import { orderExpiryQueue } from '../infrastructure/redis/queues.js';
import { env } from '../lib/env.js';
import type { OrderSummary, OrderDetail, OrderItemDetail, VendorOrderItem } from '@smartshaadi/types';
import type { CreateOrderInput, ShipItemInput } from '@smartshaadi/schemas';

// ── Typed error factory ───────────────────────────────────────────────────────

function makeError(
  code: string,
  message: string,
  status: number,
): Error & { code: string; status: number } {
  const e = new Error(message) as Error & { code: string; status: number };
  e.code   = code;
  e.status = status;
  return e;
}

// ── Row shapes ────────────────────────────────────────────────────────────────

interface OrderRow {
  id:               string;
  customerId:       string;
  status:           string;
  subtotal:         string;
  shippingFee:      string;
  total:            string;
  shippingAddress:  unknown;
  razorpayOrderId:  string | null;
  razorpayPaymentId: string | null;
  notes:            string | null;
  createdAt:        Date;
  updatedAt:        Date;
}

interface OrderItemRow {
  id:               string;
  orderId:          string;
  productId:        string;
  vendorId:         string;
  quantity:         number;
  unitPrice:        string;
  subtotal:         string;
  fulfilmentStatus: string;
  trackingNumber:   string | null;
  createdAt:        Date;
  updatedAt:        Date;
}

interface ProductRow {
  id:          string;
  vendorId:    string;
  name:        string;
  price:       string;
  stockQty:    number;
  isActive:    boolean;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toOrderSummary(row: OrderRow, itemCount: number): OrderSummary {
  return {
    id:              row.id,
    status:          row.status as OrderSummary['status'],
    subtotal:        parseFloat(row.subtotal),
    shippingFee:     parseFloat(row.shippingFee),
    total:           parseFloat(row.total),
    itemCount,
    createdAt:       row.createdAt.toISOString(),
    shippingAddress: row.shippingAddress as OrderSummary['shippingAddress'],
  };
}

function toOrderItemDetail(row: OrderItemRow, productName: string): OrderItemDetail {
  return {
    id:               row.id,
    productId:        row.productId,
    productName,
    vendorId:         row.vendorId,
    quantity:         row.quantity,
    unitPrice:        parseFloat(row.unitPrice),
    subtotal:         parseFloat(row.subtotal),
    fulfilmentStatus: row.fulfilmentStatus as OrderItemDetail['fulfilmentStatus'],
    trackingNumber:   row.trackingNumber,
  };
}

// ── 1) createOrder ────────────────────────────────────────────────────────────

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
): Promise<{ order: OrderSummary; razorpayOrderId: string }> {
  // Step 1: Fetch all requested products upfront (outside tx — read-only validation)
  const productIds = input.items.map((i) => i.productId);

  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));

  // Build a map for quick lookup
  const productMap = new Map<string, ProductRow>(
    productRows.map((p) => [p.id, p as ProductRow]),
  );

  // Step 2: Validate each item (product exists, active, sufficient stock)
  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw makeError('NOT_FOUND', `Product ${item.productId} not found`, 404);
    }
    if (!product.isActive) {
      throw makeError('INVALID_STATE', `Product "${product.name}" is not available`, 409);
    }
    if (product.stockQty < item.quantity) {
      throw makeError(
        'INSUFFICIENT_STOCK',
        `Insufficient stock for "${product.name}". Available: ${product.stockQty}, requested: ${item.quantity}`,
        409,
      );
    }
  }

  // Step 3: Capture unitPrice at order time + calculate totals
  const lineItems = input.items.map((item) => {
    const product   = productMap.get(item.productId)!;
    const unitPrice = parseFloat(product.price); // snapshot — never recalculate later
    const subtotal  = unitPrice * item.quantity;
    return { ...item, vendorId: product.vendorId, unitPrice, subtotal };
  });

  const subtotal    = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
  const shippingFee = 0;
  const total       = subtotal + shippingFee;

  // Step 4: Insert order + items + decrement stock — ALL inside a single transaction
  const order = await db.transaction(async (tx) => {
    // 4a: Insert order
    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        customerId:      userId,
        status:          'PLACED',
        subtotal:        String(subtotal),
        shippingFee:     String(shippingFee),
        total:           String(total),
        shippingAddress: input.shippingAddress,
        notes:           input.notes ?? null,
      })
      .returning();

    const orderId = (insertedOrder as OrderRow).id;

    // 4b: Insert order_items with captured unitPrice
    await tx
      .insert(orderItems)
      .values(
        lineItems.map((li) => ({
          orderId,
          productId:        li.productId,
          vendorId:         li.vendorId,
          quantity:         li.quantity,
          unitPrice:        String(li.unitPrice),
          subtotal:         String(li.subtotal),
          fulfilmentStatus: 'PENDING',
        })),
      );

    // 4c: Decrement stock for each item (with guard: only update if stock_qty >= quantity)
    for (const li of lineItems) {
      const result = await tx
        .update(products)
        .set({
          stockQty:  sql`${products.stockQty} - ${li.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, li.productId),
            sql`${products.stockQty} >= ${li.quantity}`,
          ),
        )
        .returning({ id: products.id });

      if (result.length === 0) {
        // Stock was taken by a concurrent request — abort
        throw makeError(
          'INSUFFICIENT_STOCK',
          `Concurrent stock exhaustion for product ${li.productId}`,
          409,
        );
      }
    }

    return insertedOrder as OrderRow;
  });

  // Step 5: Outside tx — create Razorpay order (mock in dev)
  const rpOrder = await razorpay.createOrder(Math.round(total * 100), 'INR', order.id);

  // Step 6: Persist razorpayOrderId
  await db
    .update(orders)
    .set({ razorpayOrderId: rpOrder.id, updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  // Step 7: Schedule expiry — if the customer abandons payment, cancel the
  // order in 30 minutes so reserved stock is returned. Deterministic jobId
  // (no colons — BullMQ rejects them) prevents duplicate scheduling on retry.
  if (!env.USE_MOCK_SERVICES) {
    try {
      await orderExpiryQueue.add(
        'expire-order',
        { orderId: order.id },
        {
          delay: 30 * 60 * 1000,
          jobId: `order-expiry-${order.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    } catch (e) {
      console.error('[store/createOrder] failed to schedule expiry job:', e);
    }
  }

  return {
    order:          toOrderSummary(order, input.items.length),
    razorpayOrderId: rpOrder.id,
  };
}

// ── 2) confirmOrder (webhook handler) ────────────────────────────────────────

export async function confirmOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  await db
    .update(orders)
    .set({
      status:            'CONFIRMED',
      razorpayPaymentId,
      updatedAt:         new Date(),
    })
    .where(eq(orders.razorpayOrderId, razorpayOrderId));
}

// ── 3) getMyOrders ────────────────────────────────────────────────────────────

export async function getMyOrders(
  userId: string,
  page = 1,
  limit = 12,
): Promise<{ orders: OrderSummary[]; meta: { page: number; limit: number; total: number } }> {
  const offset = (page - 1) * limit;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.customerId, userId)),
    db
      .select({
        order:     orders,
        itemCount: sql<number>`count(${orderItems.id})::int`,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(eq(orders.customerId, userId))
      .groupBy(orders.id)
      .orderBy(sql`${orders.createdAt} desc`)
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    orders: rows.map((r) => toOrderSummary(r.order as OrderRow, r.itemCount ?? 0)),
    meta:   { page, limit, total },
  };
}

// ── 4) getOrderDetail ─────────────────────────────────────────────────────────

export async function getOrderDetail(userId: string, orderId: string): Promise<OrderDetail> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerId, userId)))
    .limit(1);

  if (orderRows.length === 0) {
    throw makeError('NOT_FOUND', 'Order not found', 404);
  }

  const order = orderRows[0] as OrderRow;

  const itemRows = await db
    .select({
      item:        orderItems,
      productName: products.name,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  const items = itemRows.map((r) =>
    toOrderItemDetail(r.item as OrderItemRow, r.productName),
  );

  return {
    ...toOrderSummary(order, items.length),
    items,
    razorpayOrderId:   order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
  };
}

// ── 5) cancelOrder ────────────────────────────────────────────────────────────

export async function cancelOrder(userId: string, orderId: string): Promise<void> {
  // Fetch order + items (outside tx — validation only)
  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerId, userId)))
    .limit(1);

  if (orderRows.length === 0) {
    throw makeError('NOT_FOUND', 'Order not found', 404);
  }

  const order = orderRows[0] as OrderRow;

  if (order.status !== 'PLACED' && order.status !== 'CONFIRMED') {
    throw makeError(
      'INVALID_STATE',
      `Order cannot be cancelled — current status: ${order.status}`,
      409,
    );
  }

  const itemRows = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Cancel + restore stock inside a transaction
  await db.transaction(async (tx) => {
    // Cancel the order
    await tx
      .update(orders)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.customerId, userId)));

    // Restore stock for each item
    for (const item of itemRows as OrderItemRow[]) {
      await tx
        .update(products)
        .set({
          stockQty:  sql`${products.stockQty} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
    }
  });
}

// ── 6) shipOrderItem ──────────────────────────────────────────────────────────

export async function shipOrderItem(
  vendorUserId: string,
  orderItemId: string,
  input: ShipItemInput,
): Promise<void> {
  // Resolve vendor
  const vendorRows = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, vendorUserId))
    .limit(1);

  if (vendorRows.length === 0) {
    throw makeError('FORBIDDEN', 'Only vendors can ship order items', 403);
  }
  const vendorId = vendorRows[0]!.id;

  // Fetch the order item and verify vendor ownership
  const itemRows = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId)))
    .limit(1);

  if (itemRows.length === 0) {
    throw makeError('FORBIDDEN', 'Order item not found or you do not own it', 403);
  }

  // Update fulfilment status
  await db
    .update(orderItems)
    .set({
      fulfilmentStatus: 'SHIPPED',
      trackingNumber:   input.trackingNumber,
      updatedAt:        new Date(),
    })
    .where(eq(orderItems.id, orderItemId));

  // Check if ALL items in the order are now SHIPPED → update order status
  const orderId = (itemRows[0] as OrderItemRow).orderId;
  await maybeAdvanceOrderStatus(orderId, 'SHIPPED', 'SHIPPED' as const);
}

// ── 7) deliverOrderItem ───────────────────────────────────────────────────────

export async function deliverOrderItem(
  vendorUserId: string,
  orderItemId: string,
): Promise<void> {
  const vendorRows = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, vendorUserId))
    .limit(1);

  if (vendorRows.length === 0) {
    throw makeError('FORBIDDEN', 'Only vendors can mark order items as delivered', 403);
  }
  const vendorId = vendorRows[0]!.id;

  const itemRows = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId)))
    .limit(1);

  if (itemRows.length === 0) {
    throw makeError('FORBIDDEN', 'Order item not found or you do not own it', 403);
  }

  await db
    .update(orderItems)
    .set({ fulfilmentStatus: 'DELIVERED', updatedAt: new Date() })
    .where(eq(orderItems.id, orderItemId));

  const orderId = (itemRows[0] as OrderItemRow).orderId;
  await maybeAdvanceOrderStatus(orderId, 'DELIVERED', 'DELIVERED' as const);
}

// ── Helper: advance order status if all items have reached a fulfilment state ─

type OrderStatusValue = 'PLACED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

async function maybeAdvanceOrderStatus(
  orderId: string,
  itemTargetStatus: string,
  orderTargetStatus: OrderStatusValue,
): Promise<void> {
  const allItems = await db
    .select({ fulfilmentStatus: orderItems.fulfilmentStatus })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const allReached = allItems.every((i) => i.fulfilmentStatus === itemTargetStatus);

  if (allReached && allItems.length > 0) {
    await db
      .update(orders)
      .set({ status: orderTargetStatus, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }
}

// ── 8) getVendorOrders ────────────────────────────────────────────────────────

export async function getVendorOrders(vendorUserId: string): Promise<VendorOrderItem[]> {
  const vendorRows = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, vendorUserId))
    .limit(1);

  if (vendorRows.length === 0) {
    throw makeError('FORBIDDEN', 'Vendor not found', 403);
  }
  const vendorId = vendorRows[0]!.id;

  const rows = await db
    .select({
      item:            orderItems,
      productName:     products.name,
      orderDate:       orders.createdAt,
      shippingAddress: orders.shippingAddress,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(orders,   eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.vendorId, vendorId))
    .orderBy(sql`${orders.createdAt} desc`);

  return rows.map((r) => ({
    ...toOrderItemDetail(r.item as OrderItemRow, r.productName),
    // VendorOrderItem fields — customer contact intentionally omitted (CLAUDE.md rule 5)
    customerName:    '',
    customerPhone:   '',
    orderDate:       (r.orderDate as Date).toISOString(),
    shippingAddress: r.shippingAddress as VendorOrderItem['shippingAddress'],
  }));
}
