import { z } from 'zod'

export const MatchRequestSchema = z.object({
  receiverId: z.string().uuid(),
  message:    z.string().max(500).optional(),
})

export const MatchFeedQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  // ── Phase 7 Sprint G (Unit 7.2) — NRI / international facets ───────────────
  //
  // These were previously absent while the /nri page was already sending
  // `?nriOnly=true`. Zod strips unknown keys, so the flag was silently dropped
  // and the NRI browse view rendered the ORDINARY feed under an NRI heading —
  // showing domestic profiles as if they were cross-border. Parsing the facet is
  // what makes that page honest.
  nriOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  // Comma-separated ISO 3166-1 alpha-2 list, e.g. "CA,US,GB". Uppercased so a
  // lowercase query string can't miss an uppercase column value.
  countries: z
    .string()
    .transform((s) =>
      s.split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    )
    .refine((arr) => arr.length > 0 && arr.length <= 20, {
      message: 'countries must contain 1–20 valid ISO alpha-2 codes',
    })
    .optional(),
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
