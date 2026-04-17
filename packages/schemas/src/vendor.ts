import { z } from 'zod'

export const VendorListQuerySchema = z.object({
  category: z.string().optional(),
  city:     z.string().optional(),
  state:    z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(20).default(10),
})

export const CreateVendorSchema = z.object({
  businessName: z.string().min(2).max(255),
  category:     z.string(),
  city:         z.string().min(2).max(100),
  state:        z.string().min(2).max(100),
})

export const CreateServiceSchema = z.object({
  name:        z.string().min(2).max(255),
  priceFrom:   z.number().positive(),
  priceTo:     z.number().positive().optional(),
  unit:        z.string().max(50),
  description: z.string().max(1000).optional(),
})

export const CreateBookingSchema = z.object({
  vendorId:     z.string().uuid(),
  serviceId:    z.string().uuid().optional(),
  eventDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ceremonyType: z.string().optional(),
  notes:        z.string().max(1000).optional(),
  totalAmount:  z.number().positive(),
})

export const CreatePaymentOrderSchema = z.object({
  bookingId: z.string().uuid(),
})

export const RefundSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const DisputeSchema = z.object({
  reason: z.string().min(10).max(1000),
})

export type VendorListQuery    = z.infer<typeof VendorListQuerySchema>
export type CreateVendorInput  = z.infer<typeof CreateVendorSchema>
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type CreatePaymentInput = z.infer<typeof CreatePaymentOrderSchema>
export type RefundInput        = z.infer<typeof RefundSchema>
export type DisputeInput       = z.infer<typeof DisputeSchema>
