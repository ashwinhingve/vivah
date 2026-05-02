export const VendorCategory = {
  PHOTOGRAPHY:   'PHOTOGRAPHY',
  VIDEOGRAPHY:   'VIDEOGRAPHY',
  CATERING:      'CATERING',
  DECORATION:    'DECORATION',
  VENUE:         'VENUE',
  MAKEUP:        'MAKEUP',
  JEWELLERY:     'JEWELLERY',
  CLOTHING:      'CLOTHING',
  MUSIC:         'MUSIC',
  LIGHTING:      'LIGHTING',
  SECURITY:      'SECURITY',
  TRANSPORT:     'TRANSPORT',
  PRIEST:        'PRIEST',
  SOUND:         'SOUND',
  EVENT_HOSTING: 'EVENT_HOSTING',
  RENTAL:        'RENTAL',
  OTHER:         'OTHER',
} as const
export type VendorCategory = typeof VendorCategory[keyof typeof VendorCategory]

export const BookingStatus = {
  PENDING:   'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DISPUTED:  'DISPUTED',
} as const
export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus]

export const PaymentStatus = {
  PENDING:            'PENDING',
  CAPTURED:           'CAPTURED',
  REFUNDED:           'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUND_PENDING:     'REFUND_PENDING',
  FAILED:             'FAILED',
} as const
export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus]

export interface VendorService {
  id:          string
  name:        string
  priceFrom:   number
  priceTo:     number | null
  unit:        string
  description: string | null
}

export interface VendorProfile {
  id:           string
  businessName: string
  category:     VendorCategory
  city:         string
  state:        string
  rating:       number
  totalReviews: number
  verified:     boolean
  services:     VendorService[]
  portfolioKey: string | null
  tagline?:     string | null
  description?: string | null
  coverImageKey?: string | null
  phone?:       string | null
  email?:       string | null
  website?:     string | null
  instagram?:   string | null
  yearsActive?: number | null
  responseTimeHours?: number | null
  priceMin?:    number | null
  priceMax?:    number | null
  viewCount?:   number
  favoriteCount?: number
  isFavorite?:  boolean
}

export interface VendorReview {
  id:               string
  vendorId:         string
  bookingId:        string | null
  reviewerId:       string
  reviewerName:     string
  rating:           number
  title:            string | null
  comment:          string | null
  vendorReply:      string | null
  vendorRepliedAt:  string | null
  createdAt:        string
}

export type InquiryStatus = 'NEW' | 'REPLIED' | 'CONVERTED' | 'CLOSED'

export interface VendorInquiry {
  id:           string
  vendorId:     string
  vendorName?:  string
  customerId:   string
  customerName?: string
  ceremonyType: string | null
  eventDate:    string | null
  guestCount:   number | null
  budgetMin:    number | null
  budgetMax:    number | null
  message:      string
  vendorReply:  string | null
  repliedAt:    string | null
  status:       InquiryStatus
  createdAt:    string
}

export interface VendorBlockedDate {
  id:        string
  vendorId:  string
  date:      string
  reason:    string | null
  createdAt: string
}

export interface BookingAddon {
  id:        string
  name:      string
  quantity:  number
  unitPrice: number
  notes:     string | null
}

export interface BookingSummary {
  id:           string
  vendorId:     string
  vendorName:   string
  serviceId:    string | null
  eventDate:    string
  ceremonyType?: string
  status:       BookingStatus
  totalAmount:  number
  escrowAmount: number | null
  createdAt:    string
  packageName?:  string | null
  packagePrice?: number | null
  guestCount?:   number | null
  eventLocation?: string | null
  proposedDate?: string | null
  proposedBy?:   string | null
  proposedReason?: string | null
  addons?:       BookingAddon[]
  hasReview?:    boolean
}

export interface PaymentOrder {
  razorpayOrderId: string
  amount:          number
  currency:        string
  bookingId:       string
}

export interface InvoiceData {
  bookingId:    string
  customerName: string
  vendorName:   string
  serviceNames: string[]
  eventDate:    string
  totalAmount:  number
  paidAmount:   number
  invoiceDate:  string
  invoiceNo:    string
}
