import { z } from 'zod';

// Mirrors @smartshaadi/types vue.ts (Vendor Utilization Engine).
// profileId validated as a raw UUID here; the ProfileId brand is applied at the
// resolver boundary via asProfileId() (the established codebase pattern).

const profileId = z.string().uuid();

export const CAPACITY_STATUSES = ['OPEN', 'HELD', 'BOOKED', 'BLOCKED'] as const;
export const CapacityStatusSchema = z.enum(CAPACITY_STATUSES);

export const CreateCapacityWindowSchema = z.object({
  profileId,
  startAt:     z.string().datetime(),
  endAt:       z.string().datetime(),
  status:      CapacityStatusSchema.default('OPEN'),
  maxBookings: z.number().int().min(1).max(1000).default(1),
  offSeason:   z.boolean().default(false),
  notes:       z.string().max(1000).nullable().optional(),
}).refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
  message: 'endAt must be after startAt',
  path:    ['endAt'],
});

export const UpdateCapacityWindowSchema = z.object({
  status:      CapacityStatusSchema.optional(),
  maxBookings: z.number().int().min(1).max(1000).optional(),
  offSeason:   z.boolean().optional(),
  notes:       z.string().max(1000).nullable().optional(),
});

export type CreateCapacityWindowInput = z.infer<typeof CreateCapacityWindowSchema>;
export type UpdateCapacityWindowInput = z.infer<typeof UpdateCapacityWindowSchema>;
