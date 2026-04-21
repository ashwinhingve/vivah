/**
 * Weddings service unit tests.
 * All DB and Mongoose calls are mocked — no real DB needed.
 * USE_MOCK_SERVICES=true so MongoDB paths use mockStore helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../lib/db.js', () => ({ db: mockDb }));

// ── Mock drizzle-orm ──────────────────────────────────────────────────────────

vi.mock('drizzle-orm', () => {
  const stub = (..._args: unknown[]) => ({ _sql: true });
  return {
    eq:  stub,
    and: stub,
    sql: Object.assign(stub, { raw: stub }),
  };
});

// ── Mock schema tables ────────────────────────────────────────────────────────

vi.mock('@smartshaadi/db', () => ({
  weddings: {
    id: {}, profileId: {}, mongoWeddingPlanId: {}, weddingDate: {},
    venueName: {}, venueCity: {}, budgetTotal: {}, guestCount: {}, status: {},
  },
  weddingTasks: {
    id: {}, weddingId: {}, title: {}, description: {}, dueDate: {},
    status: {}, priority: {}, assignedTo: {}, createdAt: {}, updatedAt: {},
  },
  profiles:   { id: {}, userId: {} },
  guestLists: { id: {}, weddingId: {} },
}));

// ── Mock env (USE_MOCK_SERVICES=true) ─────────────────────────────────────────

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true },
}));

// ── Mock WeddingPlan Mongoose model ───────────────────────────────────────────

vi.mock('../../infrastructure/mongo/models/WeddingPlan.js', () => ({
  WeddingPlan: {
    create:           vi.fn(),
    findOne:          vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

// ── Mock mockStore helpers ────────────────────────────────────────────────────

const _mockStore: Map<string, Record<string, unknown>> = new Map();

vi.mock('../../lib/mockStore.js', () => ({
  mockGet: (key: string) => _mockStore.get(key) ?? null,
  mockUpsertField: (key: string, field: string, value: unknown) => {
    const doc = _mockStore.get(key) ?? {};
    doc[field] = value;
    _mockStore.set(key, doc);
    return doc;
  },
  mockUpsertDotFields: vi.fn(),
}));

// ── Chain builders ────────────────────────────────────────────────────────────

function buildSelectChain(returnValue: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from       = vi.fn().mockReturnValue(chain);
  chain.where      = vi.fn().mockReturnValue(chain);
  chain.limit      = vi.fn().mockReturnValue(chain);
  chain.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(returnValue).then(resolve, reject);
  return chain;
}

function buildInsertChain(returnValue: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.values    = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Record<string, unknown> = {}) {
  return { id: 'profile-1', userId: 'user-1', ...overrides };
}

function makeWedding(overrides: Record<string, unknown> = {}) {
  return {
    id:                 'wedding-1',
    profileId:          'profile-1',
    mongoWeddingPlanId: null,
    weddingDate:        '2027-02-14',
    venueName:          'The Grand Palace',
    venueCity:          'Mumbai',
    budgetTotal:        '1500000',
    guestCount:         200,
    status:             'PLANNING',
    createdAt:          new Date(),
    updatedAt:          new Date(),
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id:          'task-1',
    weddingId:   'wedding-1',
    title:       'Book venue',
    description: null,
    dueDate:     null,
    status:      'TODO',
    priority:    'MEDIUM',
    assignedTo:  null,
    category:    null,
    createdAt:   new Date(),
    updatedAt:   new Date(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('weddings/service — createWedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('creates both PG row and MongoDB plan doc (mock mode)', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]));   // resolve profile

    mockDb.insert
      .mockReturnValueOnce(buildInsertChain([weddingRow])); // insert wedding

    const { createWedding } = await import('../service.js');

    const result = await createWedding('user-1', {
      weddingDate: '2027-02-14',
      venueName:   'The Grand Palace',
      venueCity:   'Mumbai',
      budgetTotal: 1_500_000,
    });

    expect(result.wedding.id).toBe('wedding-1');
    expect(result.wedding.status).toBe('PLANNING');

    // Plan must be written to mockStore
    const stored = _mockStore.get('wedding_plan:wedding-1');
    expect(stored).not.toBeNull();
    const plan = stored?.['plan'] as Record<string, unknown>;
    expect(plan).toBeDefined();
    expect((plan?.['budget'] as Record<string, unknown>)?.['categories']).toHaveLength(10);
  });

  it('throws PROFILE_NOT_FOUND when user has no profile', async () => {
    mockDb.select.mockReturnValueOnce(buildSelectChain([]));

    const { createWedding } = await import('../service.js');

    await expect(
      createWedding('ghost-user', { weddingDate: '2027-02-14' }),
    ).rejects.toThrow('PROFILE_NOT_FOUND');
  });
});

describe('weddings/service — getWedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('returns combined data with taskProgress', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();
    const tasks      = [
      { status: 'TODO' },
      { status: 'DONE' },
      { status: 'DONE' },
    ];

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))     // resolve profile
      .mockReturnValueOnce(buildSelectChain([weddingRow]))  // fetch wedding
      .mockReturnValueOnce(buildSelectChain(tasks))         // task statuses
      .mockReturnValueOnce(buildSelectChain([{ id: 'gl-1' }])); // guest list

    // Pre-populate mock store with a plan
    _mockStore.set('wedding_plan:wedding-1', {
      plan: {
        weddingId: 'wedding-1',
        theme:     { name: null, colorPalette: [], style: null },
        budget:    { total: 1_500_000, currency: 'INR', categories: [] },
        ceremonies: [], checklist: [], muhuratDates: [],
      },
    });

    const { getWedding } = await import('../service.js');

    const result = await getWedding('user-1', 'wedding-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('wedding-1');
    expect(result!.taskProgress.total).toBe(3);
    expect(result!.taskProgress.done).toBe(2);
    expect(result!.plan).not.toBeNull();
  });

  it('returns null when wedding not owned by user', async () => {
    const profile = makeProfile();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))  // resolve profile
      .mockReturnValueOnce(buildSelectChain([]));        // wedding not found

    const { getWedding } = await import('../service.js');

    const result = await getWedding('user-1', 'other-wedding');

    expect(result).toBeNull();
  });
});

describe('weddings/service — updateBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('updates MongoDB categories correctly in mock mode', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    // resolveOwnedWedding calls: profile select, wedding select
    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]));

    const newCategories = [
      { name: 'Venue',       allocated: 500_000, spent: 250_000 },
      { name: 'Photography', allocated: 100_000, spent: 0 },
    ];

    const { updateBudget } = await import('../service.js');

    const result = await updateBudget('user-1', 'wedding-1', {
      categories: newCategories,
    });

    expect(result).toEqual(newCategories);

    // Verify mockStore was updated
    const stored = _mockStore.get('wedding_plan:wedding-1');
    expect(stored).not.toBeNull();
    const plan = stored?.['plan'] as Record<string, unknown> | undefined;
    const budgetCats = (plan?.['budget'] as Record<string, unknown> | undefined)?.['categories'];
    expect(budgetCats).toEqual(newCategories);
  });
});

describe('weddings/service — getTaskBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('groups tasks by status correctly', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    const tasks = [
      makeTask({ id: 't1', status: 'TODO' }),
      makeTask({ id: 't2', status: 'IN_PROGRESS' }),
      makeTask({ id: 't3', status: 'DONE' }),
      makeTask({ id: 't4', status: 'DONE' }),
    ];

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]))
      .mockReturnValueOnce(buildSelectChain(tasks));

    const { getTaskBoard } = await import('../service.js');

    const board = await getTaskBoard('user-1', 'wedding-1');

    expect(board).not.toBeNull();
    expect(board!.TODO).toHaveLength(1);
    expect(board!.IN_PROGRESS).toHaveLength(1);
    expect(board!.DONE).toHaveLength(2);
    expect(board!.TODO[0]!.id).toBe('t1');
    expect(board!.DONE[0]!.id).toBe('t3');
  });

  it('returns empty columns when no tasks', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]))
      .mockReturnValueOnce(buildSelectChain([]));

    const { getTaskBoard } = await import('../service.js');

    const board = await getTaskBoard('user-1', 'wedding-1');

    expect(board!.TODO).toHaveLength(0);
    expect(board!.IN_PROGRESS).toHaveLength(0);
    expect(board!.DONE).toHaveLength(0);
  });
});

describe('weddings/service — autoGenerateChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('generates correct tasks for 6-month window', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]));

    // Return inserted rows matching count
    const insertedRows = [{ id: 'task-a' }, { id: 'task-b' }, { id: 'task-c' }];
    mockDb.insert.mockReturnValueOnce(buildInsertChain(insertedRows));

    // 7 months from now → falls in 6-12 bucket → 3 tasks
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 7);
    const dateStr = futureDate.toISOString().slice(0, 10);

    const { autoGenerateChecklist } = await import('../service.js');

    const result = await autoGenerateChecklist('user-1', 'wedding-1', dateStr);

    expect(result.created).toBe(3);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('generates tasks for <1-month window', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]));

    const insertedRows = [{ id: 'task-x' }, { id: 'task-y' }, { id: 'task-z' }];
    mockDb.insert.mockReturnValueOnce(buildInsertChain(insertedRows));

    // 2 weeks from now → < 1 month bucket
    const soon = new Date();
    soon.setDate(soon.getDate() + 14);
    const dateStr = soon.toISOString().slice(0, 10);

    const { autoGenerateChecklist } = await import('../service.js');

    const result = await autoGenerateChecklist('user-1', 'wedding-1', dateStr);

    expect(result.created).toBe(3);
  });

  it('returns 0 when no tasks apply (past date / 0 months)', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]));

    // Past date — negative months → no bucket matches
    const { autoGenerateChecklist } = await import('../service.js');

    const result = await autoGenerateChecklist('user-1', 'wedding-1', '2020-01-01');

    expect(result.created).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
