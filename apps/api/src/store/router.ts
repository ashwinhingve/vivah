/**
 * Smart Shaadi — Store Router
 *
 * Public (no auth):
 *   GET  /store/products            → listProducts
 *   GET  /store/products/featured   → getFeaturedProducts
 *   GET  /store/products/:id        → getProduct
 *
 * Vendor (authenticated):
 *   POST   /store/products          → createProduct
 *   PUT    /store/products/:id      → updateProduct
 *   DELETE /store/products/:id      → deleteProduct
 *   PUT    /store/products/:id/stock   → updateStock
 *   POST   /store/products/:id/images  → addProductImages
 *   GET    /store/vendor/products   → getVendorProducts
 *
 * Customer (authenticated):
 *   POST /store/orders              → createOrder
 *   GET  /store/orders              → getMyOrders
 *   GET  /store/orders/:id          → getOrderDetail
 *   PUT  /store/orders/:id/cancel   → cancelOrder
 *
 * Vendor (authenticated):
 *   GET  /store/vendor/orders       → getVendorOrders
 *   PUT  /store/order-items/:id/ship    → shipOrderItem
 *   PUT  /store/order-items/:id/deliver → deliverOrderItem
 *
 * Webhook (NO auth — Razorpay signature verified):
 *   POST /store/webhook/razorpay    → confirmOrder
 *
 * Exported as `storeRouter`. Phase 2 mounts at /api/v1/store.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import * as razorpay from '../lib/razorpay.js';
import {
  ProductListQuerySchema,
  CreateProductSchema,
  UpdateProductSchema,
  UpdateStockSchema,
  CreateOrderSchema,
  ShipItemSchema,
} from '@smartshaadi/schemas';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  addProductImages,
  getFeaturedProducts,
  getVendorProducts,
} from './product.service.js';
import {
  createOrder,
  confirmOrder,
  getMyOrders,
  getOrderDetail,
  cancelOrder,
  shipOrderItem,
  deliverOrderItem,
  getVendorOrders,
} from './order.service.js';

export const storeRouter = Router();

// ── Error handler ─────────────────────────────────────────────────────────────

interface AppError extends Error {
  code?:   string;
  status?: number;
}

function handleError(res: Response, e: unknown, fallbackMsg: string): void {
  const ae     = e as AppError;
  const code   = ae.code   ?? 'INTERNAL_ERROR';
  const status = ae.status ?? 500;
  const msg    = ae instanceof Error ? ae.message : fallbackMsg;

  if (status === 403) { err(res, 'FORBIDDEN',   msg, 403); return; }
  if (status === 404) { err(res, 'NOT_FOUND',   msg, 404); return; }
  if (status === 409) { err(res, code,           msg, 409); return; }
  err(res, code, msg, status);
}

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCT ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /products/featured  (PUBLIC — must be BEFORE /:id) ───────────────────

storeRouter.get(
  '/products/featured',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const featured = await getFeaturedProducts();
      ok(res, { products: featured });
    } catch (e) {
      handleError(res, e, 'Failed to fetch featured products');
    }
  },
);

// ── GET /products  (PUBLIC) ───────────────────────────────────────────────────

storeRouter.get(
  '/products',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ProductListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }

    try {
      const result = await listProducts(parsed.data);
      ok(res, result);
    } catch (e) {
      handleError(res, e, 'Failed to list products');
    }
  },
);

// ── GET /products/:id  (PUBLIC) ───────────────────────────────────────────────

storeRouter.get(
  '/products/:id',
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params['id'];
    if (!productId) { err(res, 'VALIDATION_ERROR', 'Missing product id', 400); return; }

    try {
      const product = await getProduct(productId);
      ok(res, product);
    } catch (e) {
      handleError(res, e, 'Failed to fetch product');
    }
  },
);

// ── POST /products  (vendor auth) ─────────────────────────────────────────────

storeRouter.post(
  '/products',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const product = await createProduct(userId, parsed.data);
      ok(res, product, 201);
    } catch (e) {
      handleError(res, e, 'Failed to create product');
    }
  },
);

// ── PUT /products/:id  (vendor auth) ──────────────────────────────────────────

storeRouter.put(
  '/products/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params['id'];
    const userId    = req.user!.id;
    if (!productId) { err(res, 'VALIDATION_ERROR', 'Missing product id', 400); return; }

    const parsed = UpdateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const product = await updateProduct(userId, productId, parsed.data);
      ok(res, product);
    } catch (e) {
      handleError(res, e, 'Failed to update product');
    }
  },
);

// ── DELETE /products/:id  (vendor auth) ───────────────────────────────────────

storeRouter.delete(
  '/products/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params['id'];
    const userId    = req.user!.id;
    if (!productId) { err(res, 'VALIDATION_ERROR', 'Missing product id', 400); return; }

    try {
      await deleteProduct(userId, productId);
      ok(res, { deleted: true });
    } catch (e) {
      handleError(res, e, 'Failed to delete product');
    }
  },
);

// ── PUT /products/:id/stock  (vendor auth) ────────────────────────────────────

storeRouter.put(
  '/products/:id/stock',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params['id'];
    const userId    = req.user!.id;
    if (!productId) { err(res, 'VALIDATION_ERROR', 'Missing product id', 400); return; }

    const parsed = UpdateStockSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const product = await updateStock(userId, productId, parsed.data);
      ok(res, product);
    } catch (e) {
      handleError(res, e, 'Failed to update stock');
    }
  },
);

// ── POST /products/:id/images  (vendor auth) ──────────────────────────────────

storeRouter.post(
  '/products/:id/images',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params['id'];
    const userId    = req.user!.id;
    if (!productId) { err(res, 'VALIDATION_ERROR', 'Missing product id', 400); return; }

    const body = req.body as { r2Keys?: unknown };
    if (!Array.isArray(body.r2Keys) || body.r2Keys.length === 0) {
      err(res, 'VALIDATION_ERROR', 'r2Keys must be a non-empty array', 400);
      return;
    }

    const r2Keys = body.r2Keys as string[];

    try {
      const product = await addProductImages(userId, productId, r2Keys);
      ok(res, product);
    } catch (e) {
      handleError(res, e, 'Failed to add product images');
    }
  },
);

// ── GET /vendor/products  (vendor auth — before /products/:id) ───────────────

storeRouter.get(
  '/vendor/products',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      const productList = await getVendorProducts(userId);
      ok(res, { products: productList });
    } catch (e) {
      handleError(res, e, 'Failed to fetch vendor products');
    }
  },
);

// ════════════════════════════════════════════════════════════════════════════════
// ORDER ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /orders  (customer auth) ─────────────────────────────────────────────

storeRouter.post(
  '/orders',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const result = await createOrder(userId, parsed.data);
      ok(res, result, 201);
    } catch (e) {
      handleError(res, e, 'Failed to create order');
    }
  },
);

// ── GET /orders  (customer auth) ──────────────────────────────────────────────

storeRouter.get(
  '/orders',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const page   = Number(req.query['page'] ?? 1);
    const limit  = Number(req.query['limit'] ?? 12);

    try {
      const result = await getMyOrders(userId, page, limit);
      ok(res, result);
    } catch (e) {
      handleError(res, e, 'Failed to fetch orders');
    }
  },
);

// ── GET /orders/:id  (customer auth) ──────────────────────────────────────────

storeRouter.get(
  '/orders/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params['id'];
    const userId  = req.user!.id;
    if (!orderId) { err(res, 'VALIDATION_ERROR', 'Missing order id', 400); return; }

    try {
      const order = await getOrderDetail(userId, orderId);
      ok(res, order);
    } catch (e) {
      handleError(res, e, 'Failed to fetch order');
    }
  },
);

// ── PUT /orders/:id/cancel  (customer auth) ───────────────────────────────────

storeRouter.put(
  '/orders/:id/cancel',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params['id'];
    const userId  = req.user!.id;
    if (!orderId) { err(res, 'VALIDATION_ERROR', 'Missing order id', 400); return; }

    try {
      await cancelOrder(userId, orderId);
      ok(res, { cancelled: true });
    } catch (e) {
      handleError(res, e, 'Failed to cancel order');
    }
  },
);

// ── GET /vendor/orders  (vendor auth) ─────────────────────────────────────────

storeRouter.get(
  '/vendor/orders',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      const vendorOrderList = await getVendorOrders(userId);
      ok(res, { orders: vendorOrderList });
    } catch (e) {
      handleError(res, e, 'Failed to fetch vendor orders');
    }
  },
);

// ── PUT /order-items/:id/ship  (vendor auth) ──────────────────────────────────

storeRouter.put(
  '/order-items/:id/ship',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const orderItemId = req.params['id'];
    const userId      = req.user!.id;
    if (!orderItemId) { err(res, 'VALIDATION_ERROR', 'Missing order item id', 400); return; }

    const parsed = ShipItemSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      await shipOrderItem(userId, orderItemId, parsed.data);
      ok(res, { shipped: true });
    } catch (e) {
      handleError(res, e, 'Failed to ship order item');
    }
  },
);

// ── PUT /order-items/:id/deliver  (vendor auth) ───────────────────────────────

storeRouter.put(
  '/order-items/:id/deliver',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const orderItemId = req.params['id'];
    const userId      = req.user!.id;
    if (!orderItemId) { err(res, 'VALIDATION_ERROR', 'Missing order item id', 400); return; }

    try {
      await deliverOrderItem(userId, orderItemId);
      ok(res, { delivered: true });
    } catch (e) {
      handleError(res, e, 'Failed to deliver order item');
    }
  },
);

// ════════════════════════════════════════════════════════════════════════════════
// WEBHOOK ROUTES (NO auth — Razorpay signature verified)
// ════════════════════════════════════════════════════════════════════════════════

storeRouter.post(
  '/webhook/razorpay',
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string') {
      err(res, 'UNAUTHORIZED', 'Missing Razorpay signature', 401);
      return;
    }

    // Verify webhook signature (mock always returns true in dev)
    const rawBody = JSON.stringify(req.body);
    const valid   = await razorpay.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      err(res, 'UNAUTHORIZED', 'Invalid Razorpay signature', 401);
      return;
    }

    const body = req.body as {
      event?: string;
      payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
    };

    if (body.event === 'payment.captured') {
      const razorpayOrderId   = body.payload?.payment?.entity?.order_id ?? '';
      const razorpayPaymentId = body.payload?.payment?.entity?.id        ?? '';

      if (razorpayOrderId && razorpayPaymentId) {
        try {
          await confirmOrder(razorpayOrderId, razorpayPaymentId);
        } catch (e) {
          // Log but don't fail — Razorpay will retry
          console.error('[store/webhook/razorpay] confirmOrder failed:', e);
        }
      }
    }

    // Always respond 200 to Razorpay
    res.status(200).json({ received: true });
  },
);
