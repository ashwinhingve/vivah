/**
 * Vendor Gap Detection (Phase 5 Sprint B, Unit 5.3)
 *
 * Computes (city × category) vendor supply and flags cells below a configurable
 * threshold — surfacing under-supplied markets for admin recruiting. Pure
 * algorithmic: no ML, no LLM. Reference-style read across the vendors table.
 *
 * Evaluation set = each city with ≥1 active vendor × every "expected" category,
 * with supply defaulting to 0 where a city has that category entirely absent —
 * so true zero-supply gaps inside a live market surface, not just thin ones.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import { VendorCategory, type SupplyGapCell, type SupplyGapReport } from '@smartshaadi/types';

/** Default minimum active vendors per (city × category); overridable per request. */
export const DEFAULT_GAP_THRESHOLD = 3;

/**
 * Categories real markets are expected to supply. OTHER is a residual catch-all
 * bucket, not a recruiting target, so it is excluded from gap evaluation.
 */
export const EXPECTED_CATEGORIES: string[] = Object.values(VendorCategory).filter(
  (c) => c !== 'OTHER',
);

export interface SupplyRow {
  city: string;
  category: string;
  supply: number;
}

/** Aggregate active, APPROVED vendors grouped by (city, category). */
export async function queryVendorSupply(): Promise<SupplyRow[]> {
  const rows = await db
    .select({
      city: vendors.city,
      category: vendors.category,
      supply: sql<number>`count(*)::int`,
    })
    .from(vendors)
    .where(and(eq(vendors.isActive, true), eq(vendors.status, 'APPROVED')))
    .groupBy(vendors.city, vendors.category);

  return rows.map((r) => ({ city: r.city, category: r.category as string, supply: r.supply }));
}

/**
 * Pure: build the (city × category) cross product over active cities, fill supply
 * (0 where a cell is absent), flag cells below threshold, and sort deterministically
 * (largest shortfall first → city → category).
 */
export function computeSupplyGaps(params: {
  supply: SupplyRow[];
  categories: string[];
  threshold: number;
}): SupplyGapReport {
  const { supply, categories, threshold } = params;

  const counts = new Map<string, number>();
  const citySet = new Set<string>();
  for (const row of supply) {
    citySet.add(row.city);
    counts.set(`${row.city}|${row.category}`, row.supply);
  }
  const cities = [...citySet].sort((a, b) => a.localeCompare(b));

  const gaps: SupplyGapCell[] = [];
  for (const city of cities) {
    for (const category of categories) {
      const cellSupply = counts.get(`${city}|${category}`) ?? 0;
      const shortfall = threshold - cellSupply;
      if (shortfall > 0) {
        gaps.push({ city, category, supply: cellSupply, threshold, shortfall });
      }
    }
  }

  gaps.sort(
    (a, b) =>
      b.shortfall - a.shortfall ||
      a.city.localeCompare(b.city) ||
      a.category.localeCompare(b.category),
  );

  return {
    threshold,
    gaps,
    cellsEvaluated: cities.length * categories.length,
    citiesEvaluated: cities.length,
    underSuppliedCount: gaps.length,
  };
}

/** Orchestration: query live supply, then compute the gap report for a threshold. */
export async function getSupplyGapReport(
  threshold: number = DEFAULT_GAP_THRESHOLD,
): Promise<SupplyGapReport> {
  const supply = await queryVendorSupply();
  return computeSupplyGaps({ supply, categories: EXPECTED_CATEGORIES, threshold });
}
