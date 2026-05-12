/**
 * Vendor Leads client fetch helpers — Tier 3 Track 2.
 *
 * Server-side fetches forward the better-auth.session_token cookie.
 * Browser-side fetches rely on default credentials inclusion.
 */
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export type LeadFeeStatus =
  | 'PENDING' | 'QUALIFIED' | 'CHARGED' | 'REFUNDED' | 'CANCELLED' | 'PENDING_PAYMENT';
export type LeadQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'SPAM';

export interface VendorLeadRow {
  id:             string;
  vendorId:       string;
  inquirerUserId: string;
  inquirerName:   string | null;
  eventType:      string;
  eventDate:      string | null;
  eventLocation:  string | null;
  message:        string | null;
  feeChargedInr:  number;
  feeStatus:      LeadFeeStatus;
  leadQuality:    LeadQuality | null;
  chargedAt:      string | null;
  refundReason:   string | null;
  createdAt:      string;
}

export interface VendorLeadStats {
  totalLeads:         number;
  qualifiedLeads:     number;
  chargedLeads:       number;
  cancelledLeads:     number;
  pendingLeads:       number;
  lifetimeChargedInr: number;
  monthChargedInr:    number;
  qualifiedRate:      number;
  avgFeeInr:          number;
}

interface ApiEnvelope<T> { success: boolean; data: T | null; error?: { code: string; message: string } }

/** Fetch the authenticated vendor's leads inbox. */
export async function fetchMyLeads(
  cookie: string,
  opts: { status?: LeadFeeStatus; limit?: number; offset?: number } = {},
): Promise<VendorLeadRow[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.limit  !== undefined) params.set('limit',  String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  try {
    const res = await fetch(
      `${API_URL}/api/v1/vendor-leads/my${qs ? `?${qs}` : ''}`,
      { headers: { Cookie: cookie }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as ApiEnvelope<{ leads: VendorLeadRow[] }>;
    return json.success && json.data ? json.data.leads : [];
  } catch {
    return [];
  }
}

/** Fetch the authenticated vendor's lead stats. */
export async function fetchMyLeadStats(cookie: string): Promise<VendorLeadStats | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/vendor-leads/stats`,
      { headers: { Cookie: cookie }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<{ stats: VendorLeadStats }>;
    return json.success && json.data ? json.data.stats : null;
  } catch {
    return null;
  }
}
