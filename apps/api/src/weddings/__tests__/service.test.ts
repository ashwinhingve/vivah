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
    updatedAt: {},
  },
  weddingTasks: {
    id: {}, weddingId: {}, title: {}, description: {}, dueDate: {},
    status: {}, priority: {}, assignedTo: {}, createdAt: {}, updatedAt: {},
  },
  profiles:   { id: {}, userId: {} },
  guestLists: { id: {}, weddingId: {} },
  ceremonies: {
    id: {}, weddingId: {}, type: {}, date: {}, venue: {},
    startTime: {}, endTime: {}, notes: {}, createdAt: {},
  },
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

// ── ceremonies ────────────────────────────────────────────────────────────────

describe('weddings/service — addCeremony', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('creates PG ceremonies row and syncs to mockStore', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();
    const ceremonyRow = {
      id:        'ceremony-1',
      weddingId: 'wedding-1',
      type:      'HALDI',
      date:      '2027-02-12',
      venue:     'The Rooftop Garden',
      startTime: '10:00',
      endTime:   '13:00',
      notes:     null,
      createdAt: new Date(),
    };

    // resolveOwnedWedding: profile + wedding
    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]));

    mockDb.insert.mockReturnValueOnce(buildInsertChain([ceremonyRow]));

    const { addCeremony } = await import('../service.js');

    const result = await addCeremony('user-1', 'wedding-1', {
      type:      'HALDI',
      date:      '2027-02-12',
      venue:     'The Rooftop Garden',
      startTime: '10:00',
      endTime:   '13:00',
    });

    expect(result.id).toBe('ceremony-1');
    expect(result.type).toBe('HALDI');
    expect(result.weddingId).toBe('wedding-1');
  });

  it('throws WEDDING_NOT_FOUND when wedding not owned', async () => {
    const profile = makeProfile();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([])); // no wedding

    const { addCeremony } = await import('../service.js');

    await expect(
      addCeremony('user-1', 'bad-wedding', { type: 'MEHNDI' })
    ).rejects.toThrow('WEDDING_NOT_FOUND');
  });
});

describe('weddings/service — getCeremonies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('returns ceremonies scoped to the wedding', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();
    const ceremonies = [
      { id: 'c1', weddingId: 'wedding-1', type: 'HALDI',  date: '2027-02-12', venue: null, startTime: null, endTime: null, notes: null, createdAt: new Date() },
      { id: 'c2', weddingId: 'wedding-1', type: 'SANGEET', date: '2027-02-13', venue: null, startTime: null, endTime: null, notes: null, createdAt: new Date() },
    ];

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]))
      .mockReturnValueOnce(buildSelectChain(ceremonies));

    const { getCeremonies } = await import('../service.js');

    const result = await getCeremonies('user-1', 'wedding-1');

    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe('HALDI');
    expect(result[1]!.type).toBe('SANGEET');
  });

  it('returns empty array when no ceremonies', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]))
      .mockReturnValueOnce(buildSelectChain([]));

    const { getCeremonies } = await import('../service.js');

    const result = await getCeremonies('user-1', 'wedding-1');
    expect(result).toHaveLength(0);
  });
});

describe('weddings/service — selectMuhurat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('marks selected date as selected:true and deselects others in mockStore', async () => {
    const profile    = makeProfile();
    const weddingRow = makeWedding();

    // Pre-populate mockStore with 3 muhurat dates
    _mockStore.set('wedding_plan:wedding-1', {
      plan: {
        weddingId:   'wedding-1',
        theme:       { name: null, colorPalette: [], style: null },
        budget:      { total: 0, currency: 'INR', categories: [] },
        ceremonies:  [],
        checklist:   [],
        muhuratDates: [
          { date: '2027-02-14', muhurat: 'Brahma Muhurat',  tithi: null, selected: false },
          { date: '2027-02-21', muhurat: 'Vijay Muhurat',   tithi: null, selected: false },
          { date: '2027-02-28', muhurat: 'Abhijit Muhurat', tithi: null, selected: false },
        ],
      },
    });

    // resolveOwnedWedding: profile + wedding
    mockDb.select
      .mockReturnValueOnce(buildSelectChain([profile]))
      .mockReturnValueOnce(buildSelectChain([weddingRow]));

    // weddings.update for weddingDate sync
    const updateChain = {
      set:   vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update.mockReturnValueOnce(updateChain);

    const { selectMuhurat } = await import('../service.js');

    const result = await selectMuhurat('user-1', 'wedding-1', {
      date:    '2027-02-21',
      muhurat: 'Vijay Muhurat',
    });

    const selectedOnes = result.filter((d) => d.selected);
    const unselected   = result.filter((d) => !d.selected);

    expect(selectedOnes).toHaveLength(1);
    expect(selectedOnes[0]!.date).toBe('2027-02-21');
    expect(unselected).toHaveLength(2);
  });
});

describe('weddings/service — getMuhuratSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockStore.clear();
  });

  it('returns exactly 5 MuhuratDate objects', async () => {
    const { getMuhuratSuggestions } = await import('../service.js');

    const result = await getMuhuratSuggestions('2027-02-14');

    expect(result).toHaveLength(5);
  });

  it('each suggestion has date, muhurat name, and selected:false by default', async () => {
    const { getMuhuratSuggestions } = await import('../service.js');

    const result = await getMuhuratSuggestions('2027-06-15');

    for (const d of result) {
      expect(typeof d.date).toBe('string');
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.muhurat).toBe('string');
      expect(d.muhurat.length).toBeGreaterThan(0);
      expect(d.selected).toBe(false);
    }
  });

  it('prefers Saturday/Sunday dates in suggestions', async () => {
    const { getMuhuratSuggestions } = await import('../service.js');

    const result = await getMuhuratSuggestions('2027-03-20');

    // At least one weekend day should be present
    const hasWeekend = result.some((d) => {
      const dow = new Date(d.date).getDay();
      return dow === 0 || dow === 6; // Sunday or Saturday
    });
    expect(hasWeekend).toBe(true);
  });
});
