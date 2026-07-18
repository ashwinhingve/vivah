/**
 * PDF Reporting (Phase 8 Sprint H, Unit 8.3).
 *
 * A report is a point-in-time PDF rendering of the analytics/forecast series that
 * apps/api/src/analytics already computes — no new aggregation. Two audiences:
 * PLATFORM (admin/support only) and VENDOR (owner or admin/support).
 *
 * The API streams the PDF bytes directly; these types describe the request shape
 * and the metadata rendered onto the cover page, not a JSON response body.
 */

/** Which report to render. Also selects the authorization rule. */
export type ReportKind = 'PLATFORM' | 'VENDOR';

/** Report period, as ISO month keys (YYYY-MM). Both bounds inclusive. */
export interface ReportPeriod {
  /** ISO month YYYY-MM. Defaults to 12 months before `to`. */
  from: string;
  /** ISO month YYYY-MM. Defaults to the current month. */
  to:   string;
}

export interface ReportRequest {
  kind:   ReportKind;
  /** Required when kind === 'VENDOR'; ignored for PLATFORM. */
  vendorId?: string;
  period?: Partial<ReportPeriod>;
}

/** Cover-page metadata. Rendered into the PDF, never returned as JSON. */
export interface ReportMeta {
  kind:        ReportKind;
  title:       string;
  /** Vendor business name for VENDOR reports; 'Smart Shaadi' for PLATFORM. */
  subject:     string;
  period:      ReportPeriod;
  /** ISO-8601 timestamp the report was rendered. */
  generatedAt: string;
  /** Forecast horizon in months (6, matching the analytics forecast). */
  horizon:     number;
}
