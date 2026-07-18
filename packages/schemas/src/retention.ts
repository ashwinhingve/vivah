import { z } from 'zod';

/** Admin list query for churn-recovery campaigns. */
export const RetentionCampaignsQuerySchema = z.object({
  status:   z.enum(['DRY_RUN', 'QUEUED', 'SENT', 'CONVERTED', 'EXPIRED', 'SUPPRESSED']).optional(),
  riskBand: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

export type RetentionCampaignsQuery = z.infer<typeof RetentionCampaignsQuerySchema>;
