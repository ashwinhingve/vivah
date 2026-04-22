import { z } from 'zod';

export const ProductListQuerySchema = z.object({
  category: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
  search:   z.string().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(40).default(12),
});

export const CreateProductSchema = z.object({
  name:         z.string().min(1).max(255),
  description:  z.string().max(2000).optional(),
  category:     z.string().min(1).max(100),
  price:        z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stockQty:     z.number().int().min(0),
  sku:          z.string().max(100).optional(),
  isFeatured:   z.boolean().default(false),
});

export const UpdateProductSchema = CreateProductSchema.partial();

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
});

export const ShipItemSchema = z.object({
  trackingNumber: z.string().min(1).max(255),
});

export const UpdateStockSchema = z.object({
  stockQty: z.number().int().min(0),
});

export type ProductListQuery   = z.infer<typeof ProductListQuerySchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateOrderInput   = z.infer<typeof CreateOrderSchema>;
export type ShipItemInput      = z.infer<typeof ShipItemSchema>;
export type UpdateStockInput   = z.infer<typeof UpdateStockSchema>;
