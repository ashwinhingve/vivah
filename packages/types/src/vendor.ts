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
}

export interface BookingSummary {
  id:           string
  vendorId:     string
  vendorName:   string
  serviceId:    string | null
  eventDate:    string
  status:       BookingStatus
  totalAmount:  number
  escrowAmount: number | null
  createdAt:    string
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
