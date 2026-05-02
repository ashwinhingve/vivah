import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete },
}));

vi.mock('@smartshaadi/db', () => ({
  vendors:          { id: {}, userId: {}, favoriteCount: {} },
  vendorFavorites:  { id: {}, userId: {}, vendorId: {}, createdAt: {} },
  vendorServices:   { id: {}, vendorId: {}, isActive: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq:      (..._a: unknown[]) => ({ _q: 'eq' }),
  and:     (..._a: unknown[]) => ({ _q: 'and' }),
  desc:    (..._a: unknown[]) => ({ _q: 'desc' }),
  inArray: (..._a: unknown[]) => ({ _q: 'inArray' }),
  sql:     (..._a: unknown[]) => ({ _q: 'sql' }),
}));

function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  c.from     = vi.fn().mockReturnValue(c);
  c.where    = vi.fn().mockReturnValue(c);
  c.orderBy  = vi.fn().mockReturnValue(c);
  c.innerJoin= vi.fn().mockReturnValue(c);
  c.limit    = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return c;
}

function insertChain(returnRows: unknown[] = []) {
  return {
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnRows),
  };
}

function deleteChain(returnRows: unknown[] = []) {
  return {
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnRows),
  };
}

function updateChain() {
  return {
    set:    vi.fn().mockReturnThis(),
    where:  vi.fn().mockResolvedValue([]),
  };
}

describe('vendors/favorites — addFavorite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a favorite + bumps count when not already favorited', async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: 'v1' }]))   // vendor exists
      .mockReturnValueOnce(chain([]));              // not yet favorited
    mockInsert.mockReturnValueOnce(insertChain([]));
    mockUpdate.mockReturnValueOnce(updateChain());

    const { addFavorite } = await import('../favorites.service.js');
    const result = await addFavorite('user-1', 'v1');

    expect(result.favorited).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when already favorited', async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: 'v1' }]))
      .mockReturnValueOnce(chain([{ id: 'fav-1' }]));

    const { addFavorite } = await import('../favorites.service.js');
    const result = await addFavorite('user-1', 'v1');

    expect(result.favorited).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when vendor missing', async () => {
    mockSelect.mockReturnValueOnce(chain([]));
    const { addFavorite, FavoriteError } = await import('../favorites.service.js');
    await expect(addFavorite('user-1', 'v-missing')).rejects.toBeInstanceOf(FavoriteError);
  });
});

describe('vendors/favorites — removeFavorite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decrements favoriteCount when row was deleted', async () => {
    mockDelete.mockReturnValueOnce(deleteChain([{ id: 'fav-1' }]));
    mockUpdate.mockReturnValueOnce(updateChain());

    const { removeFavorite } = await import('../favorites.service.js');
    const result = await removeFavorite('user-1', 'v1');

    expect(result.favorited).toBe(false);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('does NOT decrement count when no row deleted', async () => {
    mockDelete.mockReturnValueOnce(deleteChain([]));

    const { removeFavorite } = await import('../favorites.service.js');
    const result = await removeFavorite('user-1', 'v1');

    expect(result.favorited).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
