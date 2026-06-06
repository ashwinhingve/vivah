import { z } from 'zod';

// Mirrors @smartshaadi/types b2b.ts (B2B self-serve).
// profileId is a raw UUID here; ProfileId brand applied at the resolver boundary.

const profileId = z.string().uuid();

// 15-char GSTIN: 2 state + 10 PAN + 1 entity + 1 'Z' + 1 checksum.
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const B2B_ACCOUNT_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;
export const B2BAccountStatusSchema = z.enum(B2B_ACCOUNT_STATUSES);

export const CreateB2BAccountSchema = z.object({
  profileId,
  legalName:      z.string().min(2).max(255),
  gstin:          z.string().regex(GSTIN, 'invalid GSTIN'),
  hsnSac:         z.string().max(20).nullable().optional(),
  billingAddress: z.string().max(1000).nullable().optional(),
  contactEmail:   z.string().email().max(255).nullable().optional(),
  contactPhone:   z.string().max(20).nullable().optional(),
});

export const UpdateB2BAccountSchema = z.object({
  legalName:      z.string().min(2).max(255).optional(),
  hsnSac:         z.string().max(20).nullable().optional(),
  billingAddress: z.string().max(1000).nullable().optional(),
  contactEmail:   z.string().email().max(255).nullable().optional(),
  contactPhone:   z.string().max(20).nullable().optional(),
  status:         B2BAccountStatusSchema.optional(),
});

export type CreateB2BAccountInput = z.infer<typeof CreateB2BAccountSchema>;
export type UpdateB2BAccountInput = z.infer<typeof UpdateB2BAccountSchema>;
