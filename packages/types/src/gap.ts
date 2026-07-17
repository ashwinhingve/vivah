// packages/types/src/gap.ts
//
// Vendor Gap Detection (Phase 5 Sprint B, Unit 5.3).
// Deterministic (city × category) supply analysis vs a configurable threshold.
// Pure algorithmic — no ML, no LLM.

/** One (city × category) cell of vendor supply measured against the threshold. */
export interface SupplyGapCell {
  city: string
  category: string
  /** Active, APPROVED vendors serving this city × category. */
  supply: number
  /** The threshold this cell was evaluated against. */
  threshold: number
  /** threshold − supply; > 0 means under-supplied (the gap size). */
  shortfall: number
}

/** Admin supply-gap report: under-supplied cells, most severe first. */
export interface SupplyGapReport {
  threshold: number
  /** Under-supplied cells (supply < threshold), sorted shortfall desc → city → category. */
  gaps: SupplyGapCell[]
  /** Total (city × category) cells evaluated across active cities. */
  cellsEvaluated: number
  /** Number of distinct cities with at least one active vendor. */
  citiesEvaluated: number
  /** Count of under-supplied cells (== gaps.length; convenience for the card). */
  underSuppliedCount: number
}
