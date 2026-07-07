/**
 * Smart Shaadi — Vendor Portfolio Service (Mongo write path, onboarding wizard)
 *
 * getPortfolio          — full portfolio doc for the vendor (owner-only read)
 * updatePortfolioBasics — about/faqs/awards/certifications (upsert)
 * addPortfolioItem      — push a new work-sample entry
 * updatePortfolioItem   — replace the entry at index
 * removePortfolioItem   — splice the entry at index
 *
 * CLAUDE.md rule 11: every Mongoose call is guarded by shouldUseMockMongo and
 * falls back to the shared mockStore, mirroring profiles/content.service.ts.
 * Ownership is enforced the same way as the vendor packages CRUD in
 * service.ts — assertVendorOwner throws VENDOR_NOT_FOUND / FORBIDDEN, which
 * the router maps to 404 / 403.
 */

import { shouldUseMockMongo } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import { VendorPortfolio } from '../infrastructure/mongo/models/VendorPortfolio.js';
import { assertVendorOwner } from './service.js';
import type { PortfolioBasicsInput, PortfolioItemInput } from '@smartshaadi/schemas';

export interface VendorPortfolioItem {
  title?:       string | undefined;
  description?: string | undefined;
  eventType?:   string | undefined;
  eventDate?:   string | undefined;
  photoKeys?:   string[] | undefined;
  videoKey?:    string | undefined;
}

export interface VendorPortfolioDoc {
  vendorId?:       string;
  about?:          string | null;
  tagline?:        string | null;
  faqs?:           Array<{ question: string; answer: string }>;
  awards?:         string[];
  certifications?: string[];
  portfolio?:      VendorPortfolioItem[];
}

// ── Mock helpers ──────────────────────────────────────────────────────────────
// Namespaced key so this shares the mockStore Map safely alongside profile
// content, wedding plans, etc. — mirrors weddings/service.ts's planKey pattern.

function portfolioKey(vendorId: string): string {
  return `vendor_portfolio:${vendorId}`;
}

function mockRead(vendorId: string): VendorPortfolioDoc | null {
  const raw = mockGet(portfolioKey(vendorId));
  if (!raw) return null;
  return ((raw as { doc?: unknown }).doc ?? raw) as VendorPortfolioDoc;
}

function mockWrite(vendorId: string, doc: VendorPortfolioDoc): VendorPortfolioDoc {
  mockUpsertField(portfolioKey(vendorId), 'doc', doc);
  return doc;
}

function notFound(): Error {
  return Object.assign(new Error('Portfolio item not found'), { code: 'NOT_FOUND' });
}

// ── getPortfolio ────────────────────────────────────────────────────────────

export async function getPortfolio(
  vendorId: string,
  ownerUserId: string,
): Promise<VendorPortfolioDoc | null> {
  await assertVendorOwner(vendorId, ownerUserId);
  if (shouldUseMockMongo) return mockRead(vendorId);
  const doc = await VendorPortfolio.findOne({ vendorId }).lean();
  return doc as VendorPortfolioDoc | null;
}

// ── updatePortfolioBasics ────────────────────────────────────────────────────

export async function updatePortfolioBasics(
  vendorId: string,
  ownerUserId: string,
  input: PortfolioBasicsInput,
): Promise<VendorPortfolioDoc> {
  await assertVendorOwner(vendorId, ownerUserId);

  const patch: Record<string, unknown> = {};
  if (input.about !== undefined)          patch['about'] = input.about;
  if (input.faqs !== undefined)           patch['faqs'] = input.faqs;
  if (input.awards !== undefined)         patch['awards'] = input.awards;
  if (input.certifications !== undefined) patch['certifications'] = input.certifications;

  if (shouldUseMockMongo) {
    const existing = mockRead(vendorId) ?? {};
    return mockWrite(vendorId, { ...existing, ...patch, vendorId });
  }
  const updated = await VendorPortfolio.findOneAndUpdate(
    { vendorId },
    { $set: patch, $setOnInsert: { vendorId } },
    { upsert: true, returnDocument: 'after', lean: true },
  );
  return (updated as VendorPortfolioDoc | null) ?? { vendorId, ...patch };
}

// ── Portfolio items (work samples) ───────────────────────────────────────────

export async function addPortfolioItem(
  vendorId: string,
  ownerUserId: string,
  item: PortfolioItemInput,
): Promise<VendorPortfolioItem[]> {
  await assertVendorOwner(vendorId, ownerUserId);
  if (shouldUseMockMongo) {
    const existing = mockRead(vendorId) ?? {};
    const portfolio = [...(existing.portfolio ?? []), item];
    mockWrite(vendorId, { ...existing, vendorId, portfolio });
    return portfolio;
  }
  const updated = await VendorPortfolio.findOneAndUpdate(
    { vendorId },
    { $push: { portfolio: item }, $setOnInsert: { vendorId } },
    { upsert: true, returnDocument: 'after', lean: true },
  );
  return (updated as VendorPortfolioDoc | null)?.portfolio ?? [];
}

export async function updatePortfolioItem(
  vendorId: string,
  ownerUserId: string,
  index: number,
  item: PortfolioItemInput,
): Promise<VendorPortfolioItem[]> {
  await assertVendorOwner(vendorId, ownerUserId);
  if (shouldUseMockMongo) {
    const existing = mockRead(vendorId) ?? {};
    const portfolio = [...(existing.portfolio ?? [])];
    if (index < 0 || index >= portfolio.length) throw notFound();
    portfolio[index] = item;
    mockWrite(vendorId, { ...existing, vendorId, portfolio });
    return portfolio;
  }
  const setKey = `portfolio.${index}`;
  const updated = await VendorPortfolio.findOneAndUpdate(
    { vendorId },
    { $set: { [setKey]: item } },
    { returnDocument: 'after', lean: true },
  );
  return (updated as VendorPortfolioDoc | null)?.portfolio ?? [];
}

export async function removePortfolioItem(
  vendorId: string,
  ownerUserId: string,
  index: number,
): Promise<VendorPortfolioItem[]> {
  await assertVendorOwner(vendorId, ownerUserId);
  if (shouldUseMockMongo) {
    const existing = mockRead(vendorId) ?? {};
    const portfolio = [...(existing.portfolio ?? [])];
    if (index < 0 || index >= portfolio.length) throw notFound();
    portfolio.splice(index, 1);
    mockWrite(vendorId, { ...existing, vendorId, portfolio });
    return portfolio;
  }
  // $unset by index then $pull nulls — same splice idiom as removeVendorPackage.
  const setKey = `portfolio.${index}`;
  await VendorPortfolio.updateOne({ vendorId }, { $unset: { [setKey]: 1 } });
  const updated = await VendorPortfolio.findOneAndUpdate(
    { vendorId },
    { $pull: { portfolio: null as unknown as VendorPortfolioItem } },
    { returnDocument: 'after', lean: true },
  );
  return (updated as VendorPortfolioDoc | null)?.portfolio ?? [];
}
