import { z } from 'zod';

export const RentalListQuerySchema = z.object({
  category: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(20).default(10),
});

export const CreateRentalItemSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category:    z.enum(['DECOR','COSTUME','AV_EQUIPMENT','FURNITURE','LIGHTING','TABLEWARE','OTHER']),
  pricePerDay: z.number().positive(),
  deposit:     z.number().min(0).default(0),
  stockQty:    z.number().int().min(1).default(1),
});

export const CreateRentalBookingSchema = z.object({
  rentalItemId: z.string().uuid(),
  fromDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity:     z.number().int().min(1).default(1),
  notes:        z.string().max(500).optional(),
});

export const DisputeEscrowSchema = z.object({
  reason: z.string().min(10).max(1000),
});

export type RentalListQuery          = z.infer<typeof RentalListQuerySchema>;
export type CreateRentalItemInput    = z.infer<typeof CreateRentalItemSchema>;
export type CreateRentalBookingInput = z.infer<typeof CreateRentalBookingSchema>;
export type DisputeEscrowInput       = z.infer<typeof DisputeEscrowSchema>;
