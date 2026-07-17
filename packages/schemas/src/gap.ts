import { z } from 'zod';

// Query for GET /api/v1/admin/vendor-gaps (Phase 5 Sprint B, Unit 5.3).
// threshold is the minimum active-vendor count per (city × category) below which
// a cell is flagged as under-supplied. Configurable per request; defaults applied
// server-side when omitted.
export const VendorGapQuerySchema = z.object({
  threshold: z.coerce.number().int().positive().max(100).optional(),
});

export type VendorGapQueryInput = z.infer<typeof VendorGapQuerySchema>;
