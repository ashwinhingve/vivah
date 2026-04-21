export const RentalCategory = {
  DECOR:        'DECOR',
  COSTUME:      'COSTUME',
  AV_EQUIPMENT: 'AV_EQUIPMENT',
  FURNITURE:    'FURNITURE',
  LIGHTING:     'LIGHTING',
  TABLEWARE:    'TABLEWARE',
  OTHER:        'OTHER',
} as const;
export type RentalCategory = typeof RentalCategory[keyof typeof RentalCategory];

export const RentalBookingStatus = {
  PENDING:   'PENDING',
  CONFIRMED: 'CONFIRMED',
  ACTIVE:    'ACTIVE',
  RETURNED:  'RETURNED',
  CANCELLED: 'CANCELLED',
  OVERDUE:   'OVERDUE',
} as const;
export type RentalBookingStatus = typeof RentalBookingStatus[keyof typeof RentalBookingStatus];

export interface RentalItem {
  id:          string;
  vendorId:    string;
  name:        string;
  description: string | null;
  category:    RentalCategory;
  pricePerDay: number;
  deposit:     number;
  stockQty:    number;
  imageKeys:   string[];
  isActive:    boolean;
}

export interface RentalBookingSummary {
  id:          string;
  itemId:      string;
  itemName:    string;
  fromDate:    string;
  toDate:      string;
  quantity:    number;
  totalAmount: number;
  depositPaid: number;
  status:      RentalBookingStatus;
}
