# Week 9 — E-Commerce Store + Phase 2 QA + Production Deploy
# VivahOS Infinity · Phase 2 · Days 16–20 (FINAL PHASE 2 WEEK)
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1) → Single Agent (Phase 2 QA + Deploy)

> Final week of Phase 2. E-commerce store is the last major feature.
> products/orders/order_items tables already exist in schema.
> Zustand cart pattern adapted from taptifs. Razorpay checkout (mocked).
> Week ends with full Phase 2 QA audit + production deploy + Loom for Colonel Deepak.

---

## taptifs Patterns to Adapt

From taptifs (D:\Do Not Open\project\tapti\taptifs):
- Zustand store pattern for cart state management
- react-dropzone for vendor product image upload
- Product card component layout + grid structure
- Cart drawer/sidebar pattern from components/cart/
- react-hook-form + zod for product forms

Adapting to Smart Shaadi:
- Cashfree → Razorpay (already mocked in lib/razorpay.ts)
- Cloudinary → Cloudflare R2 (already in lib/storage.ts)
- Supabase → Drizzle ORM (already set up)
- next-auth → Better Auth (already set up)
- Design system: Burgundy/Teal/Gold/Ivory (not taptifs colors)

---

## Morning Checklist (7:00–8:00)

```bash
# 1. Confirm status
cat CLAUDE.md | head -30

# 2. Week target
grep -A15 "Week 9" ROADMAP.md

# 3. Update CLAUDE.md
# Phase: 2 | Week: 9 | Focus: E-Commerce + QA + Deploy | Status: Starting

# 4. Infrastructure
docker compose up -d
pnpm dev

# 5. Agent Teams enabled
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

---

## ─── PHASE 0: Single Agent (8:00–9:00) ──────────────────────────────────

> Shared types, schemas, Zustand cart store.
> No schema migration needed — tables already exist.

### Research prompt (8:00–8:15)

```
Read these files before touching anything:
- packages/db/schema/index.ts lines 608–680
  (products, orders, order_items tables + relations)
- packages/types/src/index.ts
- packages/schemas/src/index.ts
- apps/api/src/lib/razorpay.ts (mock payment client)
- apps/api/src/lib/storage.ts or storage/ (R2 pre-signed URLs)
- apps/web/src/app/(app)/vendors/page.tsx (reference for list page pattern)

Confirm:
1. products table columns (name, price, stock_qty, r2_image_keys etc)
2. orders table columns (status enum values)
3. order_items table columns
4. What storage helper exists for R2 pre-signed URLs

Do NOT write any code. Report findings.
```

### Phase 0 jobs (8:15–9:00)

#### Job 1 — Create `packages/types/src/store.ts`
```typescript
export const ProductCategory = {
  GIFTS:       'Gifts',
  TROUSSEAU:   'Trousseau',
  ETHNIC_WEAR: 'Ethnic Wear',
  POOJA:       'Pooja',
  DECOR:       'Decor',
  STATIONERY:  'Stationery',
  OTHER:       'Other',
} as const
export type ProductCategory = typeof ProductCategory[keyof typeof ProductCategory]

export const OrderStatus = {
  PLACED:    'PLACED',
  CONFIRMED: 'CONFIRMED',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED:  'REFUNDED',
} as const
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus]

export const FulfilmentStatus = {
  PENDING:   'PENDING',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
} as const
export type FulfilmentStatus = typeof FulfilmentStatus[keyof typeof FulfilmentStatus]

export interface ProductSummary {
  id:           string
  vendorId:     string
  vendorName:   string
  name:         string
  description:  string | null
  category:     string
  price:        number
  comparePrice: number | null
  stockQty:     number
  imageKey:     string | null   // primary image R2 key
  isActive:     boolean
  isFeatured:   boolean
}

export interface CartItem {
  productId:  string
  name:       string
  price:      number
  imageKey:   string | null
  quantity:   number
  vendorId:   string
  vendorName: string
}

export interface CartState {
  items:          CartItem[]
  addItem:        (item: CartItem) => void
  removeItem:     (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart:      () => void
  totalItems:     () => number
  totalPrice:     () => number
}

export interface OrderSummary {
  id:              string
  status:          OrderStatus
  subtotal:        number
  shippingFee:     number
  total:           number
  itemCount:       number
  createdAt:       string
  shippingAddress: ShippingAddress
}

export interface ShippingAddress {
  name:    string
  phone:   string
  address: string
  city:    string
  state:   string
  pincode: string
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemDetail[]
  razorpayOrderId:   string | null
  razorpayPaymentId: string | null
}

export interface OrderItemDetail {
  id:               string
  productId:        string
  productName:      string
  vendorId:         string
  quantity:         number
  unitPrice:        number
  subtotal:         number
  fulfilmentStatus: FulfilmentStatus
  trackingNumber:   string | null
}

export interface VendorOrderItem extends OrderItemDetail {
  customerName:  string
  customerPhone: string
  orderDate:     string
  shippingAddress: ShippingAddress
}
```

#### Job 2 — Create `packages/schemas/src/store.ts`
```typescript
import { z } from 'zod'

export const ProductListQuerySchema = z.object({
  category:   z.string().optional(),
  vendorId:   z.string().uuid().optional(),
  featured:   z.coerce.boolean().optional(),
  search:     z.string().max(100).optional(),
  minPrice:   z.coerce.number().min(0).optional(),
  maxPrice:   z.coerce.number().min(0).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(40).default(12),
})

export const CreateProductSchema = z.object({
  name:         z.string().min(1).max(255),
  description:  z.string().max(2000).optional(),
  category:     z.string().min(1).max(100),
  price:        z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stockQty:     z.number().int().min(0),
  sku:          z.string().max(100).optional(),
  isFeatured:   z.boolean().default(false),
})

export const UpdateProductSchema = CreateProductSchema.partial()

export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity:  z.number().int().min(1),
  })).min(1),
  shippingAddress: z.object({
    name:    z.string().min(1).max(255),
    phone:   z.string().min(10).max(15),
    address: z.string().min(5).max(500),
    city:    z.string().min(1).max(100),
    state:   z.string().min(1).max(100),
    pincode: z.string().length(6),
  }),
  notes: z.string().max(500).optional(),
})

export const ShipItemSchema = z.object({
  trackingNumber: z.string().min(1).max(255),
})

export const UpdateStockSchema = z.object({
  stockQty: z.number().int().min(0),
})

export type ProductListQuery   = z.infer<typeof ProductListQuerySchema>
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type CreateOrderInput   = z.infer<typeof CreateOrderSchema>
export type ShipItemInput      = z.infer<typeof ShipItemSchema>
export type UpdateStockInput   = z.infer<typeof UpdateStockSchema>
```

#### Job 3 — Create Zustand cart store
Create `apps/web/src/store/useCartStore.ts`:
```typescript
// Adapted from taptifs Zustand cart pattern
// taptifs used Zustand for persistent cart state — same pattern here
'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem, CartState } from '@smartshaadi/types'

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item: CartItem) => {
        const existing = get().items.find(i => i.productId === item.productId)
        if (existing) {
          set(state => ({
            items: state.items.map(i =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          }))
        } else {
          set(state => ({ items: [...state.items, item] }))
        }
      },

      removeItem: (productId: string) =>
        set(state => ({ items: state.items.filter(i => i.productId !== productId) })),

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set(state => ({
          items: state.items.map(i =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'smartshaadi-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

Install Zustand:
```bash
pnpm --filter @smartshaadi/web add zustand
```

#### Job 4 — Barrel exports
```
packages/types/src/index.ts   → add: export * from './store.js'
packages/schemas/src/index.ts → add: export * from './store.js'
```

#### Phase 0 commit (9:00)
```bash
pnpm --filter @smartshaadi/types build
pnpm --filter @smartshaadi/schemas build
pnpm type-check   # zero errors
git add -A
git commit -m "feat(types,schemas,store): e-commerce shared contracts + zustand cart"
git push
```

> ✅ STOP. Agent Team takes over.

---

## ─── PHASE 1: Agent Team — E-Commerce Build (9:00–14:00) ───────────────

> 3 teammates. No plan approval. Plan in 3 lines then implement immediately.
> taptifs patterns adapted to Smart Shaadi design system.

### Team spawn prompt

```
We are building Week 9 of VivahOS Infinity — the E-Commerce Store.
Phase 0 is complete and committed:
- Shared types: packages/types/src/store.ts
- Shared schemas: packages/schemas/src/store.ts
- Zustand cart store: apps/web/src/store/useCartStore.ts
- Zustand installed in @smartshaadi/web

PostgreSQL tables already exist and migrated:
- products (id, vendor_id, name, description, category, price,
  compare_price, stock_qty, sku, r2_image_keys, is_active, is_featured)
- orders (id, customer_id, status, subtotal, shipping_fee, total,
  shipping_address jsonb, razorpay_order_id, razorpay_payment_id)
- order_items (id, order_id, product_id, vendor_id, quantity,
  unit_price, subtotal, fulfilment_status, tracking_number)

Reference from taptifs (D:\Do Not Open\project\tapti\taptifs):
- Use taptifs cart/product component patterns but adapt to:
  VivahOS design system: #FEFAF6 Ivory bg, #7B2D42 Burgundy headings,
  #0E7C7B Teal CTAs, #C5A47E Gold accents
- Products are wedding-related: gifts, trousseau, ethnic wear,
  pooja items, decor pieces, invitation stationery

Create an agent team with exactly 3 teammates.
NO plan approval. Each teammate writes a 3-line plan then implements immediately.
index.ts NOT touched by any teammate.

─── TEAMMATE 1: store-api ────────────────────────────────────────────────
Domain: apps/api/src/store/
Files you OWN:
  - apps/api/src/store/product.service.ts         (CREATE)
  - apps/api/src/store/order.service.ts           (CREATE)
  - apps/api/src/store/router.ts                  (CREATE)
  - apps/api/src/store/__tests__/product.service.test.ts (CREATE)
  - apps/api/src/store/__tests__/order.service.test.ts   (CREATE)

Context — read first:
  - packages/db/schema/index.ts lines 608–680 (products, orders, order_items)
  - apps/api/src/lib/razorpay.ts (mock payment)
  - apps/api/src/lib/storage.ts or storage/router.ts (R2 pre-signed URLs)
  - apps/api/src/auth/middleware.ts
  - apps/api/src/lib/response.ts
  - packages/types/src/store.ts
  - packages/schemas/src/store.ts

Tasks in order:

1. product.service.ts:
   listProducts(query: ProductListQuery)
     → filter: category, vendorId, featured, search (name ILIKE)
     → price range: minPrice, maxPrice
     → only isActive = true for public queries
     → paginated, return ProductSummary[] with meta
     → For each product: primary image = r2ImageKeys[0] ?? null

   getProduct(productId)
     → fetch full product with vendor info
     → return ProductSummary + description + all imageKeys

   createProduct(userId, input: CreateProductInput)
     → verify user has VENDOR role
     → get vendor record for this userId
     → insert products row
     → return created product

   updateProduct(userId, productId, input: UpdateProductInput)
     → verify vendor owns product
     → update products row
     → return updated product

   deleteProduct(userId, productId)
     → verify vendor owns product
     → set isActive = false (soft delete)

   updateStock(userId, productId, input: UpdateStockInput)
     → verify vendor owns product
     → update stockQty
     → return updated product

   addProductImages(userId, productId, r2Keys: string[])
     → verify vendor owns product
     → append to r2ImageKeys array
     → return updated imageKeys

   getFeaturedProducts()
     → fetch isFeatured = true, isActive = true
     → limit 8
     → return ProductSummary[]

   getVendorProducts(userId)
     → get vendor for userId
     → fetch all products (active + inactive) for vendor
     → return ProductSummary[] with stock info

2. order.service.ts:
   createOrder(userId, input: CreateOrderInput)
     → for each item: verify product exists, isActive, sufficient stock
     → calculate: unitPrice = product.price at time of order
     → calculate: subtotal = sum of (unitPrice × quantity)
     → shippingFee = 0 (free shipping for now)
     → total = subtotal + shippingFee
     → db.transaction():
       - insert orders row
       - insert order_items rows
       - decrement stock_qty for each product
     → call razorpay.createOrder(total, 'INR', orderId) → mock
     → update orders.razorpay_order_id
     → return OrderSummary + razorpayOrderId for frontend payment

   confirmOrder(razorpayOrderId, razorpayPaymentId)
     → update orders status PLACED → CONFIRMED
     → update orders.razorpay_payment_id
     → return updated order

   getMyOrders(userId)
     → fetch orders for customerId = userId
     → join order_items for itemCount
     → return OrderSummary[] paginated newest first

   getOrderDetail(userId, orderId)
     → verify order belongs to userId
     → fetch order + items + product names
     → return OrderDetail

   cancelOrder(userId, orderId)
     → verify ownership + status is PLACED or CONFIRMED
     → update status → CANCELLED
     → restore stock_qty for each item (db.transaction)
     → return updated order

   shipOrderItem(vendorUserId, orderItemId, input: ShipItemInput)
     → verify vendor owns the product in this order item
     → update order_items.fulfilmentStatus → SHIPPED
     → update order_items.trackingNumber
     → if all items shipped → update orders.status → SHIPPED
     → return updated item

   deliverOrderItem(vendorUserId, orderItemId)
     → verify vendor ownership
     → update order_items.fulfilmentStatus → DELIVERED
     → if all items delivered → update orders.status → DELIVERED
     → return updated item

   getVendorOrders(vendorUserId)
     → get vendor for userId
     → fetch order_items where vendor_id = vendor.id
     → join orders + products for full context
     → return VendorOrderItem[]

3. Write tests BEFORE implementing:
   product.service.test.ts:
   - listProducts: category filter works, stock > 0 filter
   - createProduct: non-vendor rejected
   - updateProduct: wrong vendor rejected
   - getFeaturedProducts: returns only featured active

   order.service.test.ts:
   - createOrder: insufficient stock rejected
   - createOrder: stock decremented in transaction
   - createOrder: price captured at order time
   - cancelOrder: stock restored
   - shipOrderItem: wrong vendor rejected

4. router.ts — all endpoints:
   Product (public — no auth):
   GET  /store/products              → listProducts
   GET  /store/products/featured     → getFeaturedProducts
   GET  /store/products/:id          → getProduct

   Product (vendor):
   POST /store/products              → createProduct (authenticate())
   PUT  /store/products/:id          → updateProduct (authenticate())
   DELETE /store/products/:id        → deleteProduct (authenticate())
   PUT  /store/products/:id/stock    → updateStock (authenticate())
   POST /store/products/:id/images   → addProductImages (authenticate())
   GET  /store/vendor/products       → getVendorProducts (authenticate())

   Orders (customer):
   POST /store/orders                → createOrder (authenticate())
   GET  /store/orders                → getMyOrders (authenticate())
   GET  /store/orders/:id            → getOrderDetail (authenticate())
   PUT  /store/orders/:id/cancel     → cancelOrder (authenticate())

   Orders (vendor):
   GET  /store/vendor/orders         → getVendorOrders (authenticate())
   PUT  /store/order-items/:id/ship  → shipOrderItem (authenticate())
   PUT  /store/order-items/:id/deliver → deliverOrderItem (authenticate())

   Webhook:
   POST /store/webhook/razorpay      → confirmOrder (NO auth — signature verified)

5. pnpm type-check && pnpm --filter @smartshaadi/api test
6. Commit: feat(store-api): product catalogue + order management + Razorpay checkout

─── TEAMMATE 2: store-ui-customer ────────────────────────────────────────
Domain: apps/web/src/app/(app)/store/ + cart components
Files you OWN:
  - apps/web/src/app/(app)/store/page.tsx              (CREATE)
  - apps/web/src/app/(app)/store/[productId]/page.tsx  (CREATE)
  - apps/web/src/app/(app)/store/cart/page.tsx         (CREATE)
  - apps/web/src/app/(app)/store/checkout/page.tsx     (CREATE)
  - apps/web/src/app/(app)/store/orders/page.tsx       (CREATE)
  - apps/web/src/app/(app)/store/orders/[id]/page.tsx  (CREATE)
  - apps/web/src/app/(app)/store/loading.tsx           (CREATE)
  - apps/web/src/components/store/ProductCard.tsx      (CREATE)
  - apps/web/src/components/store/ProductGrid.tsx      (CREATE)
  - apps/web/src/components/store/CartDrawer.client.tsx (CREATE)
  - apps/web/src/components/store/CartButton.client.tsx (CREATE)
  - apps/web/src/components/store/AddToCartButton.client.tsx (CREATE)
  - apps/web/src/components/store/CheckoutForm.client.tsx (CREATE)

Context — read first:
  - apps/web/src/store/useCartStore.ts (Zustand cart — use this)
  - packages/types/src/store.ts
  - .claude/commands/ui-component.md (design system — MUST follow)
  - apps/web/src/app/(app)/vendors/page.tsx (reference for list page)
  - taptifs patterns: product grid + cart drawer

Design system (non-negotiable):
  Background:  #FEFAF6 Warm Ivory
  Headings:    Playfair Display + #7B2D42 Royal Burgundy
  CTAs:        #0E7C7B Peacock Teal
  Gold:        #C5A47E (price highlights, featured badge)
  Cards:       bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm
  Touch:       min-h-[44px] always

Tasks in order:

1. ProductCard.tsx — Server Component:
   Props: ProductSummary
   - Product image (R2 pre-signed URL or placeholder)
   - Product name (Burgundy #7B2D42, Playfair Display)
   - Category badge (Gold #C5A47E bg/10)
   - Price: ₹X (Teal #0E7C7B, font-semibold)
   - Compare price if set: ₹Y strikethrough text-gray-400
   - Stock indicator: "In Stock" (green) | "Low Stock" (amber, if qty < 5)
     | "Out of Stock" (red, disabled Add to Cart)
   - Featured badge: "⭐ Featured" in Gold if isFeatured
   - "View Details" link → /store/:productId

2. AddToCartButton.client.tsx — 'use client':
   Props: product (ProductSummary), disabled (out of stock)
   - Uses useCartStore to addItem
   - "Add to Cart" → bg-[#0E7C7B] min-h-[44px]
   - On add: brief "Added ✓" confirmation state (1s)
   - Disabled + grayed if out of stock

3. CartButton.client.tsx — 'use client':
   - Shows cart icon + item count badge
   - Fixed top-right or in nav header
   - Count from useCartStore.totalItems()
   - On click: opens CartDrawer

4. CartDrawer.client.tsx — 'use client':
   Adapted from taptifs cart drawer pattern:
   - Slide-in from right (fixed overlay)
   - List each CartItem: image, name, price, quantity controls
   - Quantity: − button | count | + button (min-h-[44px] each)
   - Remove button per item
   - Subtotal at bottom
   - "Checkout" CTA → /store/checkout (Teal button)
   - "Continue Shopping" link

5. store/page.tsx — Server Component:
   - Fetch GET /api/v1/store/products (public, no auth)
   - Category filter tabs: All | Gifts | Trousseau | Ethnic Wear |
     Pooja | Decor | Stationery
   - Search input (Client Component)
   - ProductGrid: responsive 2/3/4 col grid
   - Featured section at top if featured products exist
   - Pagination controls
   - Empty state: "No products yet — vendors are adding items"

6. store/[productId]/page.tsx — Server Component:
   - Fetch product details
   - Large image gallery (multiple R2 images)
   - Product name, category, price, compare price
   - Stock status indicator
   - Description (rich text / prose)
   - AddToCartButton (Client Component)
   - Vendor info: "Sold by {vendorName}"
   - "You might also like" — 4 products from same category

7. store/cart/page.tsx — Server Component shell + CartDrawer:
   - Shows full cart as page (not just drawer)
   - Same items as CartDrawer but full-width layout
   - Order summary: subtotal, shipping (free), total
   - "Proceed to Checkout" CTA

8. store/checkout/page.tsx — Client Component:
   - CheckoutForm: shipping address fields (react-hook-form + zod)
   - Name, phone, address, city, state, pincode
   - Order summary sidebar: items, total
   - "Place Order" → POST /api/v1/store/orders
   - On success: redirect to /store/orders/:id (confirmation)
   - Mock Razorpay: show "Payment Successful (Test Mode)" banner

9. store/orders/page.tsx — Server Component:
   - Fetch GET /api/v1/store/orders with auth
   - List orders newest first
   - Status badges: PLACED=amber, CONFIRMED=blue, SHIPPED=purple,
     DELIVERED=green, CANCELLED=gray
   - Click → /store/orders/:id

10. store/orders/[id]/page.tsx — Server Component:
    - Full order detail: items, status, tracking, address
    - "Cancel Order" button if PLACED or CONFIRMED
    - Track each item's fulfilment status

11. Add "Shop" to AppNav for INDIVIDUAL role:
    Icon: ShoppingBag from lucide-react
    Link: /store

12. Add CartButton to (app)/layout.tsx header area

13. pnpm --filter @smartshaadi/web build → zero errors
14. Commit: feat(store-ui): product browse + cart + checkout + order tracking

─── TEAMMATE 3: vendor-store-dashboard ───────────────────────────────────
Domain: apps/web/src/app/(app)/vendor-dashboard/ (extend existing)
Files you OWN:
  - apps/web/src/app/(app)/vendor-dashboard/store/page.tsx     (CREATE)
  - apps/web/src/app/(app)/vendor-dashboard/store/new/page.tsx (CREATE)
  - apps/web/src/app/(app)/vendor-dashboard/store/[id]/page.tsx (CREATE)
  - apps/web/src/app/(app)/vendor-dashboard/orders/page.tsx    (CREATE)
  - apps/web/src/components/store/VendorProductCard.tsx        (CREATE)
  - apps/web/src/components/store/VendorOrderRow.tsx           (CREATE)
  - apps/web/src/components/store/ProductForm.client.tsx       (CREATE)

Context — read first:
  - apps/web/src/app/(app)/vendor-dashboard/page.tsx (existing vendor dashboard)
  - packages/types/src/store.ts
  - packages/schemas/src/store.ts
  - .claude/commands/ui-component.md (design system)

Tasks in order:

1. ProductForm.client.tsx — 'use client':
   react-hook-form + zod (CreateProductSchema)
   Fields: name, description, category (dropdown), price,
           comparePrice (optional), stockQty, isFeatured toggle
   Image upload: react-dropzone → POST /api/v1/store/products/:id/images
   (Get R2 pre-signed URL first via POST /api/v1/storage/upload-url)
   "Save Product" → Teal button min-h-[44px]

2. VendorProductCard.tsx — Server Component:
   Shows vendor's own product:
   - Name, category, price, stock badge
   - Stock: green (>10) | amber (1-10) | red (0)
   - Edit button → /vendor-dashboard/store/:id
   - Toggle active/inactive (quick action)
   - Revenue: "₹X sold" if orders exist

3. vendor-dashboard/store/page.tsx — Server Component:
   - Fetch GET /api/v1/store/vendor/products with auth
   - Stats row: Total Products | Active | Out of Stock | Total Revenue
   - Product grid using VendorProductCard
   - "Add New Product" CTA → /vendor-dashboard/store/new
   - Empty state: "No products yet — add your first product"

4. vendor-dashboard/store/new/page.tsx — Server Component shell:
   - ProductForm for creating new product
   - On submit: POST /api/v1/store/products
   - On success: redirect to /vendor-dashboard/store

5. vendor-dashboard/store/[id]/page.tsx — Server Component:
   - Fetch product details
   - ProductForm pre-filled with existing data
   - On submit: PUT /api/v1/store/products/:id
   - Stock adjustment: quick increment/decrement
   - "Delete Product" (soft delete, confirm dialog)

6. VendorOrderRow.tsx — Server Component:
   Props: VendorOrderItem
   - Customer name, order date, items ordered
   - Total amount, fulfilment status badge
   - "Mark Shipped" button → tracking number input → PUT ship
   - "Mark Delivered" button → PUT deliver
   - Shipping address display

7. vendor-dashboard/orders/page.tsx — Server Component:
   - Fetch GET /api/v1/store/vendor/orders with auth
   - Stats: Pending | Shipped | Delivered | Revenue this month
   - Orders list using VendorOrderRow
   - Filter by status tabs
   - Empty state: "No orders yet"

8. Add navigation to vendor-dashboard:
   Extend existing vendor nav (AppNav vendor tabs):
   Add: "Products" → /vendor-dashboard/store
   Add: "Orders" → /vendor-dashboard/orders

9. pnpm --filter @smartshaadi/web build → zero errors
10. Commit: feat(vendor-store): vendor product management + order fulfilment dashboard

─── SHARED RULES ─────────────────────────────────────────────────────────
- Never touch a file owned by another teammate
- index.ts NOT touched by any teammate
- Razorpay always mocked (USE_MOCK_SERVICES=true)
- Stock decrement MUST be in a Drizzle transaction
- Price captured at order time (never recalculate from current price)
- /compact when context hits 70%
- Mark task complete immediately after commit
```

---

## ─── PHASE 2: Integration + Phase 2 QA (14:00–17:00) ───────────────────

> Single agent. Shut team down first.

### Phase 2 prompt
```
Week 9 Phase 2 — integration + full Phase 2 QA audit.

PART A: Mount store router (15 min)

1. Mount in apps/api/src/index.ts:
   import { storeRouter } from './store/router.js'
   app.use('/api/v1/store', storeRouter)

2. Confirm CartButton is in (app)/layout.tsx
3. Confirm "Shop" tab is in AppNav

PART B: Programmatic smoke test (30 min)

Get session token. Curl every new endpoint:

Products (public):
□ GET  /api/v1/store/products → 200, paginated list
□ GET  /api/v1/store/products/featured → 200, featured items
□ GET  /api/v1/store/products/:id → 200, product detail

Products (vendor — switch to VENDOR role first):
□ POST /api/v1/store/products → 201, product created
□ PUT  /api/v1/store/products/:id → 200, updated
□ PUT  /api/v1/store/products/:id/stock → 200, stock updated
□ GET  /api/v1/store/vendor/products → 200, vendor's products

Orders (customer — switch to INDIVIDUAL):
□ POST /api/v1/store/orders → 201, order + mock Razorpay order
□ GET  /api/v1/store/orders → 200, order list
□ GET  /api/v1/store/orders/:id → 200, order detail
□ PUT  /api/v1/store/orders/:id/cancel → 200, stock restored

Vendor orders:
□ GET  /api/v1/store/vendor/orders → 200
□ PUT  /api/v1/store/order-items/:id/ship → 200, tracking set
□ PUT  /api/v1/store/order-items/:id/deliver → 200

Web:
□ /store → loads, empty state shown
□ /store/cart → cart page loads
□ /store/checkout → form loads
□ /store/orders → order list loads
□ /vendor-dashboard/store → vendor product list loads
□ /vendor-dashboard/orders → vendor orders loads

PART C: Phase 2 Full QA Audit (45 min)

Run a complete audit of ALL Phase 2 features:

For each feature below, test the primary API endpoint and web page:
1. Wedding planning (/weddings, /api/v1/weddings)
2. Task board (/weddings/:id/tasks)
3. Budget tracker (/weddings/:id/budget)
4. Guest management (/weddings/:id/guests)
5. RSVP flow (/rsvp/:token — public)
6. Video call creation (/api/v1/video/rooms)
7. Meeting scheduler (/api/v1/video/meetings)
8. Escrow dispute flow (/api/v1/payments/:id/dispute)
9. Rental catalogue (/rentals, /api/v1/rentals)
10. Rental booking (/api/v1/rentals/:id/book)
11. Pre-wedding ceremonies (/api/v1/weddings/:id/ceremonies)
12. Muhurat selector (/api/v1/weddings/:id/muhurat)
13. E-commerce store (/store, /api/v1/store/products)
14. Order placement (/api/v1/store/orders)
15. Vendor store dashboard (/vendor-dashboard/store)

Report each as:
✅ Working | ⚠️ Partial | ❌ Broken

For anything ⚠️ or ❌ — document in docs/phase2-qa-report.md

PART D: Fix critical regressions (30 min)

Fix any ❌ items from QA that are critical path.
Defer cosmetic/low issues to Week 10 if needed.

PART E: Final verification
pnpm type-check → zero errors
pnpm --filter @smartshaadi/api test → must exceed 277

Document all results: docs/smoke-test-week9.md

git add -A
git commit -m "feat(store): e-commerce complete + phase 2 QA audit"
git push
```

---

## ─── Session End + Production Deploy Checklist ──────────────────────────

```bash
git add -A
git commit -m "chore: week 9 complete — e-commerce + phase 2 QA — phase 2 done 🚀"
git push
```

Update ROADMAP.md:
```
✅ E-Commerce Store: vendor product listings
✅ E-Commerce Store: shopping cart + Razorpay checkout (mocked)
✅ E-Commerce Store: order management flow
✅ E-Commerce Store: vendor product dashboard
✅ E-Commerce Store: order tracking + delivery coordination
✅ Phase 2 QA complete
```

Update CLAUDE.md:
```
Phase:   2 → COMPLETE ✅
Week:    9 → DONE
Focus:   Phase 3 — AI Intelligence Layer
Status:  Starting Week 10
Mocks:   USE_MOCK_SERVICES=true (swap after company registration)
```

---

## Production Deploy Checklist (Before Loom)

```
□ Vercel preview URL working — all pages load
□ Railway API service healthy — /health returns 200
□ Railway PostgreSQL — all migrations applied
□ MongoDB Atlas connected — profiles/chats/weddings readable
□ Redis operational — sessions working
□ Environment variables set in Vercel + Railway production
□ CORS origin set to production domain in API
□ pnpm build passes with zero errors
□ All mocked services documented for Colonel Deepak
```

---

## Loom Script for Colonel Deepak (Phase 2 — 7 minutes)

```
1. Wedding Planning (90s):
   Create a wedding → auto-generated task checklist appears
   Budget tracker — allocate by category
   Add ceremony: Sangeet on Day 1, Wedding on Day 3
   Select Muhurat date

2. Guest Management (60s):
   Add guests manually
   Send invitations (mock — shows console log)
   RSVP stats: confirmed/declined/pending

3. E-Commerce Store (90s):
   Switch to VENDOR → add a product (ethnic wear, ₹2500)
   Switch to INDIVIDUAL → browse store → add to cart
   Checkout → mock payment success → order confirmed
   Vendor sees order → marks shipped with tracking number

4. Video Call (30s):
   From a matched chat → Start Video Call
   Mock room URL generated (Daily.co pending API key)

5. Admin Dashboard (30s):
   12 users, 2 vendors, KYC queue, dispute queue

6. What's Next (30s):
   Phase 3: AI matchmaking intelligence, conversation coach,
   marriage readiness score. Phase 4: subscriptions + SEO.
```

---

## File Ownership Map

| File | Owner | Phase |
|------|-------|-------|
| `packages/types/src/store.ts` | Single agent | Phase 0 |
| `packages/schemas/src/store.ts` | Single agent | Phase 0 |
| `apps/web/src/store/useCartStore.ts` | Single agent | Phase 0 |
| `store/product.service.ts + order.service.ts + router.ts` | Teammate 1 | Phase 1 |
| `store/__tests__/` | Teammate 1 | Phase 1 |
| `web/app/(app)/store/` | Teammate 2 | Phase 1 |
| `web/components/store/ProductCard + CartDrawer + AddToCart + CartButton` | Teammate 2 | Phase 1 |
| `web/app/(app)/vendor-dashboard/store/` | Teammate 3 | Phase 1 |
| `web/app/(app)/vendor-dashboard/orders/` | Teammate 3 | Phase 1 |
| `web/components/store/VendorProductCard + VendorOrderRow + ProductForm` | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Single agent | Phase 2 only |

---

## WSL Agent Teams Rules

```
✅ No plan approval — implement immediately
✅ Stock decrement in Drizzle transaction (lesson from rental overbooking)
✅ Price captured at order time — never recalculate
✅ Restart API after Phase 2 mount (tsx watch unreliable on WSL DrvFs)
✅ index.ts single agent only in Phase 2
✅ /compact at 70% context
✅ If teammate goes idle — respawn with task list, no plan mode
```
