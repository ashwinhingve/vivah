/**
 * Multi-City Vendor Network (Unit 6.5, Sprint J) — Zod validation.
 * Shapes mirror packages/types/src/cities.ts exactly.
 */
import { z } from 'zod';

export const CityStatusSchema = z.enum(['ACTIVE', 'EXPANSION', 'PLANNED']);

export const UpdateCitySchema = z.object({
  status:                   CityStatusSchema.optional(),
  targetVendorsPerCategory: z.number().int().min(0).max(100).optional(),
  displayOrder:             z.number().int().min(0).max(9999).optional(),
}).strict().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'At least one field is required' },
);

export const CreateCitySchema = z.object({
  name:  z.string().trim().min(2).max(100),
  slug:  z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/, 'lowercase slug only'),
  state: z.string().trim().min(2).max(100),
  status: CityStatusSchema.default('PLANNED'),
  targetVendorsPerCategory: z.number().int().min(0).max(100).default(3),
  latitude:  z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  displayOrder: z.number().int().min(0).max(9999).default(999),
});
