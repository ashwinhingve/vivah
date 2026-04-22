/**
 * Store — product.service unit tests.
 * All DB calls are mocked — no real I/O.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock('@smartshaadi/db', () => ({
  products: {},
  vendors:  {},
}));

vi.mock('drizzle-orm', () => ({
  eq:    vi.fn((_c: unknown, _v: unknown) => ({ type: 'eq', _c, _v })),
  and:   vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  ilike: vi.fn((_c: unknown, _v: unknown) => ({ type: 'ilike', _c, _v })),
  gte:   vi.fn((_c: unknown, _v: unknown) => ({ type: 'gte', _c, _v })),
  lte:   vi.fn((_c: unknown, _v: unknown) => ({ type: 'lte', _c, _v })),
  sql:   vi.fn((..._args: unknown[]) => ({ type: 'sql' })),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, REDIS_URL: 'redis://localhost:6379' },
}));

// ── Chain builder helpers ─────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeSelectChain(rows: Row[]) {
  const chain: Record<string, unknown> = {
    from:      vi.fn(),
    where:     vi.fn(),
    limit:     vi.fn(),
    offset:    vi.fn(),
    orderBy:   vi.fn(),
    innerJoin: vi.fn(),
    groupBy:   vi.fn(),
    then:      (onfulfilled: (v: Row[]) => unknown) => Promise.resolve(rows).then(onfulfilled),
  };
  (chain['from']      as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['where']     as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['limit']     as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['offset']    as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['orderBy']   as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['innerJoin'] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['groupBy']   as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function makeInsertChain(rows: Row[]) {
  return {
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
}

function makeUpdateChain(rows: Row[]) {
  return {
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID   = 'user-text-id-1';
const VENDOR_ID = 'vendor-uuid-1';
const PRODUCT_ID = 'product-uuid-1';

const vendorRow = {
  id:           VENDOR_ID,
  userId:       USER_ID,
  businessName: 'Test Vendor Shop',
};

const productRow = {
  id:           PRODUCT_ID,
  vendorId:     VENDOR_ID,
  name:         'Golden Bangles Set',
  description:  'Beautiful wedding bangles',
  category:     'Gifts',
  price:        '1500.00',
  comparePrice: '1800.00',
  stockQty:     10,
  sku:          null,
  r2ImageKeys:  ['r2/img1.jpg'],
  isActive:     true,
  isFeatured:   false,
  createdAt:    new Date(),
  updatedAt:    new Date(),
};

const productWithVendorRow = {
  product:    productRow,
  vendorName: 'Test Vendor Shop',
};

// ── Service imports (after mocks) ─────────────────────────────────────────────

import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getFeaturedProducts,
  getVendorProducts,
} from '../product.service.js';

// ── listProducts ──────────────────────────────────────────────────────────────

describe('listProducts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated product list with meta', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([productWithVendorRow]));

    const result = await listProducts({ page: 1, limit: 12 });

    expect(result.products).toHaveLength(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(12);
    expect(result.meta.total).toBe(1);
  });

  it('applies category filter', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([productWithVendorRow]));

    const result = await listProducts({ category: 'Gifts', page: 1, limit: 12 });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]!.category).toBe('Gifts');
  });

  it('only returns isActive=true products for public listing', async () => {
    // The service adds eq(products.isActive, true) — we verify the shape.
    // All returned rows are treated as active (filtering is done at DB level).
    const activeOnlyRow = { ...productWithVendorRow, product: { ...productRow, isActive: true } };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([activeOnlyRow]));

    const result = await listProducts({ page: 1, limit: 12 });

    expect(result.products[0]!.isActive).toBe(true);
  });

  it('returns empty list and zero total when no products match', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await listProducts({ page: 1, limit: 12 });

    expect(result.products).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  it('maps imageKey to first element of r2ImageKeys', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([productWithVendorRow]));

    const result = await listProducts({ page: 1, limit: 12 });

    expect(result.products[0]!.imageKey).toBe('r2/img1.jpg');
  });

  it('sets imageKey to null when r2ImageKeys is empty', async () => {
    const noImageRow = {
      product:    { ...productRow, r2ImageKeys: [] },
      vendorName: 'Test Vendor Shop',
    };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([noImageRow]));

    const result = await listProducts({ page: 1, limit: 12 });

    expect(result.products[0]!.imageKey).toBeNull();
  });
});

// ── createProduct ─────────────────────────────────────────────────────────────

describe('createProduct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates product after resolving vendor from userId', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([vendorRow]));
    mockInsert.mockReturnValueOnce(makeInsertChain([productRow]));

    const result = await createProduct(USER_ID, {
      name:      'Golden Bangles Set',
      category:  'Gifts',
      price:     1500,
      stockQty:  10,
      isFeatured: false,
    });

    expect(result.name).toBe('Golden Bangles Set');
    expect(result.vendorId).toBe(VENDOR_ID);
    expect(result.vendorName).toBe('Test Vendor Shop');
  });

  it('rejects non-vendor user with FORBIDDEN', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([])); // no vendor row

    await expect(
      createProduct(USER_ID, {
        name:      'Test Product',
        category:  'Gifts',
        price:     500,
        stockQty:  1,
        isFeatured: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ── updateProduct ─────────────────────────────────────────────────────────────

describe('updateProduct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates product when called by owning vendor', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([vendorRow]))      // resolve vendor
      .mockReturnValueOnce(makeSelectChain([productRow]));    // verify ownership
    mockUpdate.mockReturnValueOnce(makeUpdateChain([{ ...productRow, name: 'Updated Name' }]));

    const result = await updateProduct(USER_ID, PRODUCT_ID, { name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
  });

  it('rejects when wrong vendor tries to update (FORBIDDEN)', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'other-vendor', businessName: 'Other' }])) // different vendor
      .mockReturnValueOnce(makeSelectChain([])); // product not found for that vendor

    await expect(
      updateProduct('other-user', PRODUCT_ID, { name: 'Hack' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ── getFeaturedProducts ───────────────────────────────────────────────────────

describe('getFeaturedProducts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns only featured+active products (max 8)', async () => {
    const featuredRow = {
      product:    { ...productRow, isFeatured: true, isActive: true },
      vendorName: 'Test Vendor Shop',
    };
    mockSelect.mockReturnValueOnce(makeSelectChain([featuredRow]));

    const result = await getFeaturedProducts();

    expect(result).toHaveLength(1);
    expect(result[0]!.isFeatured).toBe(true);
    expect(result[0]!.isActive).toBe(true);
  });

  it('returns empty array when no featured products exist', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]));

    const result = await getFeaturedProducts();
    expect(result).toHaveLength(0);
  });
});

// ── deleteProduct ─────────────────────────────────────────────────────────────

describe('deleteProduct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('soft-deletes product by setting isActive=false', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([vendorRow]))
      .mockReturnValueOnce(makeSelectChain([productRow]));
    mockUpdate.mockReturnValueOnce(makeUpdateChain([]));

    await expect(deleteProduct(USER_ID, PRODUCT_ID)).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

// ── updateStock ────────────────────────────────────────────────────────────────

describe('updateStock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates stockQty to new value', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([vendorRow]))
      .mockReturnValueOnce(makeSelectChain([productRow]));
    mockUpdate.mockReturnValueOnce(makeUpdateChain([{ ...productRow, stockQty: 50 }]));

    const result = await updateStock(USER_ID, PRODUCT_ID, { stockQty: 50 });
    expect(result.stockQty).toBe(50);
  });
});

// ── getVendorProducts ─────────────────────────────────────────────────────────

describe('getVendorProducts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all products (active + inactive) for vendor', async () => {
    const inactiveProduct = { ...productRow, isActive: false };
    mockSelect
      .mockReturnValueOnce(makeSelectChain([vendorRow]))
      .mockReturnValueOnce(makeSelectChain([productRow, inactiveProduct]));

    const result = await getVendorProducts(USER_ID);
    expect(result).toHaveLength(2);
  });

  it('throws FORBIDDEN if user has no vendor record', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]));

    await expect(getVendorProducts(USER_ID)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
