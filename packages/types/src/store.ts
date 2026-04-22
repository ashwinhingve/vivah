export const ProductCategory = {
  GIFTS:       'Gifts',
  TROUSSEAU:   'Trousseau',
  ETHNIC_WEAR: 'Ethnic Wear',
  POOJA:       'Pooja',
  DECOR:       'Decor',
  STATIONERY:  'Stationery',
  OTHER:       'Other',
} as const;
export type ProductCategory = typeof ProductCategory[keyof typeof ProductCategory];

export const OrderStatus = {
  PLACED:    'PLACED',
  CONFIRMED: 'CONFIRMED',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED:  'REFUNDED',
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const FulfilmentStatus = {
  PENDING:   'PENDING',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
} as const;
export type FulfilmentStatus = typeof FulfilmentStatus[keyof typeof FulfilmentStatus];

export interface ProductSummary {
  id:           string;
  vendorId:     string;
  vendorName:   string;
  name:         string;
  description:  string | null;
  category:     string;
  price:        number;
  comparePrice: number | null;
  stockQty:     number;
  imageKey:     string | null;
  isActive:     boolean;
  isFeatured:   boolean;
}

export interface CartItem {
  productId:  string;
  name:       string;
  price:      number;
  imageKey:   string | null;
  quantity:   number;
  vendorId:   string;
  vendorName: string;
}

export interface CartState {
  items:          CartItem[];
  addItem:        (item: CartItem) => void;
  removeItem:     (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart:      () => void;
  totalItems:     () => number;
  totalPrice:     () => number;
}

export interface ShippingAddress {
  name:    string;
  phone:   string;
  address: string;
  city:    string;
  state:   string;
  pincode: string;
}

export interface OrderSummary {
  id:              string;
  status:          OrderStatus;
  subtotal:        number;
  shippingFee:     number;
  total:           number;
  itemCount:       number;
  createdAt:       string;
  shippingAddress: ShippingAddress;
}

export interface OrderItemDetail {
  id:               string;
  productId:        string;
  productName:      string;
  vendorId:         string;
  quantity:         number;
  unitPrice:        number;
  subtotal:         number;
  fulfilmentStatus: FulfilmentStatus;
  trackingNumber:   string | null;
}

export interface OrderDetail extends OrderSummary {
  items:             OrderItemDetail[];
  razorpayOrderId:   string | null;
  razorpayPaymentId: string | null;
}

export interface VendorOrderItem extends OrderItemDetail {
  customerName:    string;
  customerPhone:   string;
  orderDate:       string;
  shippingAddress: ShippingAddress;
}
