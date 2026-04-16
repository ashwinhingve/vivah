import { z } from 'zod'

export const MatchRequestSchema = z.object({
  receiverId: z.string().uuid(),
  message:    z.string().max(500).optional(),
})

export const MatchFeedQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export const CompatibilityScoreQuerySchema = z.object({
  profileId: z.string().uuid(),
})

export const GunaInputSchema = z.object({
  profileA: z.object({
    rashi:     z.string(),
    nakshatra: z.string(),
    manglik:   z.boolean(),
  }),
  profileB: z.object({
    rashi:     z.string(),
    nakshatra: z.string(),
    manglik:   z.boolean(),
  }),
})

export type MatchRequestInput       = z.infer<typeof MatchRequestSchema>
export type MatchFeedQuery          = z.infer<typeof MatchFeedQuerySchema>
export type CompatibilityScoreQuery = z.infer<typeof CompatibilityScoreQuerySchema>
export type GunaInput               = z.infer<typeof GunaInputSchema>
