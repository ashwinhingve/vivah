/**
 * Smart Shaadi — Payments domain types.
 *
 * Authoritative source for refund / invoice / wallet / promo / payout / payment-link types.
 * Backend services and frontend pages must import from here, not redefine inline.
 */

export const RefundStatus = {
  REQUESTED:  'REQUESTED',
  APPROVED:   'APPROVED',
  PROCESSING: 'PROCESSING',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
  REJECTED:   'REJECTED',
} as const;
export type RefundStatus = typeof RefundStatus[keyof typeof RefundStatus];

export const RefundReason = {
  CUSTOMER_REQUEST:  'CUSTOMER_REQUEST',
  SERVICE_CANCELLED: 'SERVICE_CANCELLED',
  VENDOR_NO_SHOW:    'VENDOR_NO_SHOW',
  DUPLICATE_PAYMENT: 'DUPLICATE_PAYMENT',
  DISPUTE_RESOLVED:  'DISPUTE_RESOLVED',
  FRAUD:             'FRAUD',
  OTHER:             'OTHER',
} as const;
export type RefundReason = typeof RefundReason[keyof typeof RefundReason];

export interface RefundRecord {
  id:                string;
  paymentId:         string;
  bookingId:         string | null;
  amount:            string;
  reason:            RefundReason;
  reasonDetails:     string | null;
  status:            RefundStatus;
  razorpayRefundId:  string | null;
  refundToWallet:    boolean;
  requestedBy:       string | null;
  approvedBy:        string | null;
  failureReason:     string | null;
  requestedAt:       string;
  approvedAt:        string | null;
  processedAt:       string | null;
}

export const InvoiceStatus = {
  DRAFT:     'DRAFT',
  ISSUED:    'ISSUED',
  PAID:      'PAID',
  CANCELLED: 'CANCELLED',
  CREDITED:  'CREDITED',
} as const;
export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export interface InvoiceLineItem {
  description: string;
  hsnCode?:    string;
  quantity:    number;
  unitPrice:   number;
  taxRate:     number;       // percent — 18 means 18%
  amount:      number;       // pre-tax
  discount?:   number;
}

export interface InvoiceRecord {
  id:             string;
  invoiceNo:      string;
  bookingId:      string | null;
  orderId:        string | null;
  paymentId:      string | null;
  customerId:     string;
  vendorId:       string | null;
  customerName:   string;
  customerGstin:  string | null;
  vendorName:     string | null;
  vendorGstin:    string | null;
  placeOfSupply:  string | null;
  hsnCode:        string | null;
  subtotal:       string;
  discount:       string;
  taxableValue:   string;
  cgst:           string;
  sgst:           string;
  igst:           string;
  totalTax:       string;
  totalAmount:    string;
  taxBreakdown:   Record<string, unknown> | null;
  lineItems:      InvoiceLineItem[];
  status:         InvoiceStatus;
  pdfR2Key:       string | null;
  issuedAt:       string;
  cancelledAt:    string | null;
  notes:          string | null;
}

// Tax-aware PDF input — used by GST invoice generator.
export interface InvoicePdfData {
  invoiceNo:      string;
  invoiceDate:    string;
  bookingId:      string;
  customerName:   string;
  customerEmail?: string;
  customerGstin?: string;
  vendorName:     string;
  vendorAddress?: string;
  vendorGstin?:   string;
  placeOfSupply?: string;
  serviceItems:   Array<{
    description:  string;
    hsnCode?:     string;
    quantity:     number;
    unitPrice:    number;
    amount:       number;
  }>;
  subtotal:       number;
  discount?:      number;
  taxableValue:   number;
  cgst?:          number;
  sgst?:          number;
  igst?:          number;
  totalTax:       number;
  total:          number;
  paidAmount:     number;
  notes?:         string;
}

export const PayoutStatus = {
  SCHEDULED:  'SCHEDULED',
  PROCESSING: 'PROCESSING',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
  ON_HOLD:    'ON_HOLD',
} as const;
export type PayoutStatus = typeof PayoutStatus[keyof typeof PayoutStatus];

export interface PayoutRecord {
  id:                  string;
  vendorId:            string;
  bookingId:           string | null;
  orderId:             string | null;
  escrowId:            string | null;
  grossAmount:         string;
  platformFee:         string;
  taxWithheld:         string;
  netAmount:           string;
  currency:            string;
  status:              PayoutStatus;
  razorpayPayoutId:    string | null;
  razorpayTransferId:  string | null;
  vendorAccountRef:    string | null;
  scheduledFor:        string | null;
  processedAt:         string | null;
  failureReason:       string | null;
  attempts:            number;
  createdAt:           string;
}

export const WalletTxnType = { CREDIT: 'CREDIT', DEBIT: 'DEBIT' } as const;
export type WalletTxnType = typeof WalletTxnType[keyof typeof WalletTxnType];

export const WalletTxnReason = {
  REFUND:     'REFUND',
  PROMO:      'PROMO',
  REFERRAL:   'REFERRAL',
  CASHBACK:   'CASHBACK',
  PAYMENT:    'PAYMENT',
  TOPUP:      'TOPUP',
  ADJUSTMENT: 'ADJUSTMENT',
  EXPIRY:     'EXPIRY',
} as const;
export type WalletTxnReason = typeof WalletTxnReason[keyof typeof WalletTxnReason];

export interface WalletSnapshot {
  id:           string;
  userId:       string;
  balance:      string;
  lifetimeIn:   string;
  lifetimeOut:  string;
  currency:     string;
  isActive:     boolean;
  updatedAt:    string;
}

export interface WalletTransaction {
  id:             string;
  walletId:       string;
  userId:         string;
  type:           WalletTxnType;
  reason:         WalletTxnReason;
  amount:         string;
  balanceAfter:   string;
  description:    string | null;
  referenceType:  string | null;
  referenceId:    string | null;
  createdAt:      string;
}

export const PromoType = { PERCENT: 'PERCENT', FLAT: 'FLAT' } as const;
export type PromoType = typeof PromoType[keyof typeof PromoType];

export const PromoScope = {
  BOOKING:  'BOOKING',
  STORE:    'STORE',
  WEDDING:  'WEDDING',
  ALL:      'ALL',
} as const;
export type PromoScope = typeof PromoScope[keyof typeof PromoScope];

export interface PromoCodeRecord {
  id:                 string;
  code:               string;
  description:        string | null;
  type:               PromoType;
  value:              string;
  scope:              PromoScope;
  minOrderAmount:     string;
  maxDiscount:        string | null;
  usageLimit:         number | null;
  perUserLimit:       number;
  usedCount:          number;
  validFrom:          string;
  validUntil:         string | null;
  firstTimeUserOnly:  boolean;
  isActive:           boolean;
  createdAt:          string;
}

export interface PromoApplicationResult {
  promoId:   string;
  code:      string;
  discount:  number;
  finalAmount: number;
}

export const PaymentLinkStatus = {
  ACTIVE:    'ACTIVE',
  PAID:      'PAID',
  EXPIRED:   'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentLinkStatus = typeof PaymentLinkStatus[keyof typeof PaymentLinkStatus];

export interface PaymentLinkRecord {
  id:                  string;
  shortId:             string;
  amount:              string;
  currency:            string;
  description:         string;
  customerName:        string | null;
  customerEmail:       string | null;
  customerPhone:       string | null;
  bookingId:           string | null;
  status:              PaymentLinkStatus;
  razorpayLinkId:      string | null;
  razorpayShortUrl:    string | null;
  expiresAt:           string | null;
  paidAt:              string | null;
  createdBy:           string;
  createdAt:           string;
}

export const PaymentInstrument = {
  CARD:       'CARD',
  UPI:        'UPI',
  NETBANKING: 'NETBANKING',
  WALLET:     'WALLET',
} as const;
export type PaymentInstrument = typeof PaymentInstrument[keyof typeof PaymentInstrument];

export interface PaymentMethodRecord {
  id:                  string;
  userId:              string;
  instrument:          PaymentInstrument;
  cardLast4:           string | null;
  cardNetwork:         string | null;
  cardExpiryMonth:     number | null;
  cardExpiryYear:      number | null;
  upiVpa:              string | null;
  bankName:            string | null;
  walletProvider:      string | null;
  isDefault:           boolean;
  isActive:            boolean;
  createdAt:           string;
}

export interface RevenueSummary {
  periodStart:        string;
  periodEnd:          string;
  grossRevenue:       number;
  netRevenue:         number;
  refunded:           number;
  pendingPayouts:     number;
  completedPayouts:   number;
  platformFees:       number;
  taxCollected:       number;
  bookingsCount:      number;
  ordersCount:        number;
  avgBookingValue:    number;
  paymentSuccessRate: number;
}

export interface RevenueByCategory {
  category:    string;
  revenue:     number;
  count:       number;
  pct:         number;
}

export interface DailyRevenuePoint {
  date:    string;
  gross:   number;
  net:     number;
  count:   number;
}

export interface PaymentStatementRow {
  date:        string;
  type:        'PAYMENT' | 'REFUND' | 'WALLET_CREDIT' | 'WALLET_DEBIT' | 'PAYOUT';
  description: string;
  amount:      number;
  balance:     number;
  reference:   string;
}

export interface PaymentStatement {
  userId:       string;
  fromDate:     string;
  toDate:       string;
  rows:         PaymentStatementRow[];
  totalIn:      number;
  totalOut:     number;
  closingBalance: number;
}
