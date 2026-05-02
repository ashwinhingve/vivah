import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

vi.mock('@smartshaadi/db', () => ({
  vendors:        { id: {}, userId: {}, rating: {}, totalReviews: {}, updatedAt: {} },
  vendorReviews:  { id: {}, vendorId: {}, bookingId: {}, reviewerId: {}, rating: {}, isHidden: {}, createdAt: {} },
  bookings:       { id: {}, status: {}, customerId: {}, vendorId: {} },
  user:           { id: {}, name: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq:   (..._a: unknown[]) => ({ _q: 'eq' }),
  and:  (..._a: unknown[]) => ({ _q: 'and' }),
  desc: (..._a: unknown[]) => ({ _q: 'desc' }),
  sql:  (..._a: unknown[]) => ({ _q: 'sql' }),
}));

function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  c.from     = vi.fn().mockReturnValue(c);
  c.where    = vi.fn().mockReturnValue(c);
  c.orderBy  = vi.fn().mockReturnValue(c);
  c.leftJoin = vi.fn().mockReturnValue(c);
  c.limit    = vi.fn().mockReturnValue(c);
  c.offset   = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return c;
}

function insertChain(rows: unknown[]) {
  return {
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
}

function updateChain() {
  return {
    set:    vi.fn().mockReturnThis(),
    where:  vi.fn().mockResolvedValue([]),
  };
}

describe('vendors/reviews — createReview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects review when vendor missing', async () => {
    mockSelect.mockReturnValueOnce(chain([]));
    const { createReview, ReviewError } = await import('../reviews.service.js');
    await expect(createReview('u1', 'v-missing', { rating: 5 })).rejects.toBeInstanceOf(ReviewError);
  });

  it('rejects review when booking is not COMPLETED', async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: 'v1' }]))
      .mockReturnValueOnce(chain([{
        id: 'b1', status: 'PENDING', customerId: 'u1', vendorId: 'v1',
      }]));

    const { createReview, ReviewError } = await import('../reviews.service.js');
    try {
      await createReview('u1', 'v1', { rating: 5, bookingId: 'b1' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ReviewError);
      expect((e as Error).message).toMatch(/completed/i);
    }
  });

  it('rejects review when booking customer mismatch', async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: 'v1' }]))
      .mockReturnValueOnce(chain([{
        id: 'b1', status: 'COMPLETED', customerId: 'someone-else', vendorId: 'v1',
      }]));

    const { createReview, ReviewError } = await import('../reviews.service.js');
    await expect(createReview('u1', 'v1', { rating: 5, bookingId: 'b1' })).rejects.toBeInstanceOf(ReviewError);
  });

  it('inserts review and recomputes aggregate', async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: 'v1' }]))                                  // vendor exists
      .mockReturnValueOnce(chain([{ id: 'b1', status: 'COMPLETED', customerId: 'u1', vendorId: 'v1' }])) // booking ok
      .mockReturnValueOnce(chain([]))                                              // no existing review
      .mockReturnValueOnce(chain([{ avg: '4.50', count: 2 }]))                     // recompute aggregate
      .mockReturnValueOnce(chain([{ name: 'Asha' }]));                             // reviewer name

    const insertedRow = {
      id: 'r1', vendorId: 'v1', bookingId: 'b1', reviewerId: 'u1',
      rating: 5, title: null, comment: null, vendorReply: null,
      vendorRepliedAt: null, isHidden: false, createdAt: new Date(),
    };
    mockInsert.mockReturnValueOnce(insertChain([insertedRow]));
    mockUpdate.mockReturnValueOnce(updateChain());

    const { createReview } = await import('../reviews.service.js');
    const review = await createReview('u1', 'v1', { rating: 5, bookingId: 'b1' });

    expect(review.id).toBe('r1');
    expect(review.rating).toBe(5);
    expect(review.reviewerName).toBe('Asha');
    expect(mockUpdate).toHaveBeenCalledTimes(1); // aggregate recompute
  });
});
