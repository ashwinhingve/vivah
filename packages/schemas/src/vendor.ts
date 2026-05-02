import { z } from 'zod'

const VENDOR_CATEGORIES = [
  'PHOTOGRAPHY', 'VIDEOGRAPHY', 'CATERING', 'DECORATION', 'VENUE',
  'MAKEUP', 'JEWELLERY', 'CLOTHING', 'MUSIC', 'LIGHTING', 'SECURITY',
  'TRANSPORT', 'PRIEST', 'SOUND', 'EVENT_HOSTING', 'RENTAL', 'OTHER',
] as const

const VENDOR_SORTS = ['rating', 'price_low', 'price_high', 'popular', 'recent'] as const

export const VendorListQuerySchema = z.object({
  category: z.enum(VENDOR_CATEGORIES).optional(),
  city:     z.string().optional(),
  state:    z.string().optional(),
  q:        z.string().min(1).max(120).optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  verifiedOnly: z.preprocess(
    (v) => v === 'true' || v === true,
    z.boolean(),
  ).optional(),
  sort:     z.enum(VENDOR_SORTS).default('popular'),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(48).default(12),
})

export const CreateVendorSchema = z.object({
  businessName: z.string().min(2).max(255),
  category:     z.enum(VENDOR_CATEGORIES),
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

export const BookingAddonSchema = z.object({
  name:      z.string().min(1).max(255),
  quantity:  z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  notes:     z.string().max(500).nullable().optional(),
})

export const CreateBookingSchema = z.object({
  vendorId:      z.string().uuid(),
  serviceId:     z.string().uuid().optional(),
  eventDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ceremonyType:  z.string().optional(),
  notes:         z.string().max(1000).optional(),
  totalAmount:   z.number().positive(),
  packageName:   z.string().max(255).optional(),
  packagePrice:  z.number().nonnegative().optional(),
  guestCount:    z.number().int().positive().optional(),
  eventLocation: z.string().max(500).optional(),
  addons:        z.array(BookingAddonSchema).max(20).optional(),
})

export const RescheduleBookingSchema = z.object({
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:       z.string().min(3).max(500),
})

export const VendorUpdateSchema = z.object({
  businessName: z.string().min(2).max(255).optional(),
  category:     z.enum(VENDOR_CATEGORIES).optional(),
  city:         z.string().min(2).max(100).optional(),
  state:        z.string().min(2).max(100).optional(),
  tagline:      z.string().max(255).nullable().optional(),
  description:  z.string().max(5000).nullable().optional(),
  coverImageKey: z.string().max(500).nullable().optional(),
  phone:        z.string().max(20).nullable().optional(),
  email:        z.string().email().max(255).nullable().optional(),
  website:      z.string().url().max(500).nullable().optional(),
  instagram:    z.string().max(255).nullable().optional(),
  yearsActive:  z.number().int().min(0).max(100).nullable().optional(),
  responseTimeHours: z.number().int().min(0).max(168).nullable().optional(),
  priceMin:     z.number().nonnegative().nullable().optional(),
  priceMax:     z.number().nonnegative().nullable().optional(),
  isActive:     z.boolean().optional(),
})

export const CreateReviewSchema = z.object({
  bookingId: z.string().uuid().optional(),
  rating:    z.number().int().min(1).max(5),
  title:     z.string().max(200).nullable().optional(),
  comment:   z.string().max(2000).nullable().optional(),
})

export const ReviewReplySchema = z.object({
  reply: z.string().min(1).max(2000),
})

export const CreateInquirySchema = z.object({
  ceremonyType: z.string().optional(),
  eventDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestCount:   z.number().int().positive().max(100000).optional(),
  budgetMin:    z.number().nonnegative().optional(),
  budgetMax:    z.number().nonnegative().optional(),
  message:      z.string().min(5).max(2000),
})

export const InquiryReplySchema = z.object({
  reply:  z.string().min(1).max(2000),
  status: z.enum(['REPLIED', 'CLOSED', 'CONVERTED']).default('REPLIED'),
})

export const BlockedDateSchema = z.object({
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(255).optional(),
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

export type VendorListQuery       = z.infer<typeof VendorListQuerySchema>
export type CreateVendorInput     = z.infer<typeof CreateVendorSchema>
export type VendorUpdateInput     = z.infer<typeof VendorUpdateSchema>
export type CreateServiceInput    = z.infer<typeof CreateServiceSchema>
export type CreateBookingInput    = z.infer<typeof CreateBookingSchema>
export type BookingAddonInput     = z.infer<typeof BookingAddonSchema>
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingSchema>
export type CreatePaymentInput    = z.infer<typeof CreatePaymentOrderSchema>
export type RefundInput           = z.infer<typeof RefundSchema>
export type DisputeInput          = z.infer<typeof DisputeSchema>
export type CreateReviewInput     = z.infer<typeof CreateReviewSchema>
export type ReviewReplyInput      = z.infer<typeof ReviewReplySchema>
export type CreateInquiryInput    = z.infer<typeof CreateInquirySchema>
export type InquiryReplyInput     = z.infer<typeof InquiryReplySchema>
export type BlockedDateInput      = z.infer<typeof BlockedDateSchema>
