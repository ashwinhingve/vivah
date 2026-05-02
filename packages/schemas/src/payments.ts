import { z } from 'zod';

const REFUND_REASONS = [
  'CUSTOMER_REQUEST', 'SERVICE_CANCELLED', 'VENDOR_NO_SHOW',
  'DUPLICATE_PAYMENT', 'DISPUTE_RESOLVED', 'FRAUD', 'OTHER',
] as const;

export const RequestRefundSchema = z.object({
  paymentId:      z.string().uuid(),
  amount:         z.number().positive().optional(),       // omit → full remaining
  reason:         z.enum(REFUND_REASONS),
  reasonDetails:  z.string().min(10).max(1000).optional(),
  refundToWallet: z.boolean().default(false),
});
export type RequestRefundInput = z.infer<typeof RequestRefundSchema>;

export const AdminApproveRefundSchema = z.object({
  refundId: z.string().uuid(),
  approve:  z.boolean(),
  notes:    z.string().max(500).optional(),
});
export type AdminApproveRefundInput = z.infer<typeof AdminApproveRefundSchema>;

export const PromoApplySchema = z.object({
  code:        z.string().min(2).max(32),
  amount:      z.number().positive(),
  scope:       z.enum(['BOOKING', 'STORE', 'WEDDING', 'ALL']).default('ALL'),
});
export type PromoApplyInput = z.infer<typeof PromoApplySchema>;

export const CreatePromoSchema = z.object({
  code:               z.string().min(2).max(32).regex(/^[A-Z0-9_-]+$/, 'Uppercase alphanumeric'),
  description:        z.string().max(255).optional(),
  type:               z.enum(['PERCENT', 'FLAT']),
  value:              z.number().positive(),
  scope:              z.enum(['BOOKING', 'STORE', 'WEDDING', 'ALL']).default('ALL'),
  minOrderAmount:     z.number().nonnegative().default(0),
  maxDiscount:        z.number().positive().optional(),
  usageLimit:         z.number().int().positive().optional(),
  perUserLimit:       z.number().int().positive().default(1),
  validFrom:          z.string().datetime().optional(),
  validUntil:         z.string().datetime().optional(),
  firstTimeUserOnly:  z.boolean().default(false),
});
export type CreatePromoInput = z.infer<typeof CreatePromoSchema>;

export const WalletTopupSchema = z.object({
  amount: z.number().positive().max(100000),
});
export type WalletTopupInput = z.infer<typeof WalletTopupSchema>;

export const WalletAdjustSchema = z.object({
  userId:       z.string(),
  amount:       z.number().positive(),
  type:         z.enum(['CREDIT', 'DEBIT']),
  reason:       z.enum(['REFUND', 'PROMO', 'REFERRAL', 'CASHBACK', 'PAYMENT', 'TOPUP', 'ADJUSTMENT', 'EXPIRY']),
  description:  z.string().max(500),
});
export type WalletAdjustInput = z.infer<typeof WalletAdjustSchema>;

export const CreatePaymentLinkSchema = z.object({
  amount:        z.number().positive().max(1000000),
  description:   z.string().min(3).max(500),
  customerName:  z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().regex(/^(\+91)?[6-9]\d{9}$/).optional(),
  bookingId:     z.string().uuid().optional(),
  expiryHours:   z.number().int().min(1).max(720).default(48),
});
export type CreatePaymentLinkInput = z.infer<typeof CreatePaymentLinkSchema>;

export const SavePaymentMethodSchema = z.object({
  instrument:       z.enum(['CARD', 'UPI', 'NETBANKING', 'WALLET']),
  razorpayTokenId:  z.string().min(1),
  cardLast4:        z.string().regex(/^\d{4}$/).optional(),
  cardNetwork:      z.string().max(30).optional(),
  cardExpiryMonth:  z.number().int().min(1).max(12).optional(),
  cardExpiryYear:   z.number().int().min(2026).max(2050).optional(),
  upiVpa:           z.string().max(100).optional(),
  bankName:         z.string().max(100).optional(),
  walletProvider:   z.string().max(50).optional(),
  setDefault:       z.boolean().default(false),
});
export type SavePaymentMethodInput = z.infer<typeof SavePaymentMethodSchema>;

export const StatementQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type StatementQueryInput = z.infer<typeof StatementQuerySchema>;

export const RetryPaymentSchema = z.object({
  bookingId: z.string().uuid(),
});
export type RetryPaymentInput = z.infer<typeof RetryPaymentSchema>;

export const RevenueQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy:  z.enum(['day', 'week', 'month']).default('day'),
});
export type RevenueQueryInput = z.infer<typeof RevenueQuerySchema>;

export const PayoutScheduleSchema = z.object({
  bookingId:    z.string().uuid().optional(),
  orderId:      z.string().uuid().optional(),
  vendorId:     z.string().uuid(),
  grossAmount:  z.number().positive(),
  platformFee:  z.number().nonnegative().default(0),
  taxWithheld:  z.number().nonnegative().default(0),
  scheduledFor: z.string().datetime().optional(),
});
export type PayoutScheduleInput = z.infer<typeof PayoutScheduleSchema>;
