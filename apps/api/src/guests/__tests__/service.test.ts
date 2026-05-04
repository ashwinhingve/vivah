/**
 * Guest service unit tests.
 * All DB calls are mocked — no real I/O.
 * Runs with USE_MOCK_SERVICES=true.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks — must be declared with vi.hoisted so they are available
//    inside vi.mock factory callbacks (which are hoisted before imports). ────

const { mockSelect, mockInsert, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

vi.mock('@smartshaadi/db', () => ({
  guestLists:  {},
  guests:      {},
  invitations: {},
  rsvpTokens:  {},
  weddings:    {},
  profiles:    {},
}));

vi.mock('../../weddings/activity.service.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('drizzle-orm', () => ({
  eq:      vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:     vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ type: 'inArray', _col, _vals })),
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    USE_MOCK_SERVICES: true,
    REDIS_URL: 'redis://localhost:6379',
  },
}));

// ── DB chain builders ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeSelectChain(rows: Row[]) {
  return {
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockReturnThis(),
    limit:  vi.fn().mockResolvedValue(rows),
  };
}

function makeSelectNoLimit(rows: Row[]) {
  return {
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockResolvedValue(rows),
  };
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

const USER_ID       = 'user-uuid-1';
const WEDDING_ID    = 'wedding-uuid-1';
const GUEST_LIST_ID = 'guestlist-uuid-1';
const GUEST_ID      = 'guest-uuid-1';
const TOKEN         = 'rsvp-token-abc-123';

const weddingRow = {
  id:        WEDDING_ID,
  profileId: USER_ID,
  status:    'PLANNING',
};

const guestListRow = {
  id:        GUEST_LIST_ID,
  weddingId: WEDDING_ID,
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const guestRow = {
  id:             GUEST_ID,
  guestListId:    GUEST_LIST_ID,
  name:           'Priya Sharma',
  phone:          '+919876543210',
  email:          'priya@example.com',
  relationship:   'Cousin',
  rsvpStatus:     'PENDING',
  mealPreference: 'VEG',
  roomNumber:     null,
  plusOnes:       0,
  notes:          null,
  side:           null,
  createdAt:      new Date(),
  updatedAt:      new Date(),
};

const invitationRow = {
  id:        'inv-uuid-1',
  guestId:   GUEST_ID,
  sentAt:    new Date(),
  channel:   'EMAIL',
  messageId: TOKEN,
  openedAt:  null,
  rsvpAt:    null,
};

// ── Service imports (after mocks) ─────────────────────────────────────────────

import {
  addGuest,
  bulkImportGuests,
  updateRsvp,
  getRsvpStats,
} from '../service.js';
import { sendInvitations } from '../invitation.js';

// ── addGuest ──────────────────────────────────────────────────────────────────

describe('addGuest', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates guest list if none exists, then inserts guest', async () => {
    // assertWeddingOwner → ensureGuestList (no existing gl) → insert gl → insert guest
    mockSelect
      .mockReturnValueOnce(makeSelectChain([weddingRow]))   // assertWeddingOwner

      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]))  // assertWeddingOwner → profile lookup
      .mockReturnValueOnce(makeSelectChain([]));            // ensureGuestList — no existing gl

    mockInsert
      .mockReturnValueOnce(makeInsertChain([guestListRow])) // insert guestList
      .mockReturnValueOnce(makeInsertChain([guestRow]));    // insert guest

    const result = await addGuest(WEDDING_ID, USER_ID, {
      name:  'Priya Sharma',
      phone: '+919876543210',
      email: 'priya@example.com',
    });

    expect(result.name).toBe('Priya Sharma');
    expect(result.rsvpStatus).toBe('PENDING');
    expect(mockInsert).toHaveBeenCalledTimes(2); // gl + guest
  });

  it('reuses existing guest list on second add', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([weddingRow]))    // assertWeddingOwner

      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]))  // assertWeddingOwner → profile lookup
      .mockReturnValueOnce(makeSelectChain([guestListRow])); // ensureGuestList — already exists

    mockInsert.mockReturnValueOnce(makeInsertChain([guestRow]));

    const result = await addGuest(WEDDING_ID, USER_ID, { name: 'Priya Sharma' });

    expect(result.id).toBe(GUEST_ID);
    expect(mockInsert).toHaveBeenCalledTimes(1); // only guest insert
  });

  it('rejects if wedding does not belong to user', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ ...weddingRow, profileId: 'other-user' }]))  // wedding owned by someone else
      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]));                             // caller's profile — mismatch → forbidden

    await expect(addGuest(WEDDING_ID, USER_ID, { name: 'Test' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

// ── bulkImportGuests ──────────────────────────────────────────────────────────

describe('bulkImportGuests', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('imports up to 500 guests in one call (boundary)', async () => {
    const guestInputs = Array.from({ length: 500 }, (_, i) => ({ name: `Guest ${i}` }));
    const insertedRows = guestInputs.map((g, i) => ({ ...guestRow, id: `g-${i}`, name: g.name }));

    mockSelect
      .mockReturnValueOnce(makeSelectChain([weddingRow]))

      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]))  // assertWeddingOwner → profile lookup
      .mockReturnValueOnce(makeSelectChain([guestListRow]));

    mockInsert.mockReturnValueOnce(makeInsertChain(insertedRows));

    const result = await bulkImportGuests(WEDDING_ID, USER_ID, { guests: guestInputs });

    expect(result.imported).toBe(500);
    expect(result.guests).toHaveLength(500);
  });

  it('creates guest list on first bulk import', async () => {
    const guestInputs = [{ name: 'Guest A' }, { name: 'Guest B' }];
    const insertedRows = guestInputs.map((g, i) => ({ ...guestRow, id: `g-${i}`, name: g.name }));

    mockSelect
      .mockReturnValueOnce(makeSelectChain([weddingRow]))

      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]))  // assertWeddingOwner → profile lookup
      .mockReturnValueOnce(makeSelectChain([])); // no existing gl

    mockInsert
      .mockReturnValueOnce(makeInsertChain([guestListRow]))
      .mockReturnValueOnce(makeInsertChain(insertedRows));

    const result = await bulkImportGuests(WEDDING_ID, USER_ID, { guests: guestInputs });

    expect(result.imported).toBe(2);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});

// ── updateRsvp ────────────────────────────────────────────────────────────────

describe('updateRsvp (public token-based endpoint)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates rsvp status for valid token (legacy invitations path)', async () => {
    const confirmedGuest = { ...guestRow, rsvpStatus: 'YES', mealPreference: 'VEG' };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([])) // rsvpTokens lookup → empty (legacy fallback)
      .mockReturnValueOnce(makeSelectChain([invitationRow]));
    mockUpdate
      .mockReturnValueOnce(makeUpdateChain([]))             // invitations.rsvpAt
      .mockReturnValueOnce(makeUpdateChain([confirmedGuest])); // guests.rsvpStatus

    const result = await updateRsvp(TOKEN, { rsvpStatus: 'YES', mealPref: 'VEG' });

    expect(result.rsvpStatus).toBe('YES');
  });

  it('rejects unknown token', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))  // rsvpTokens
      .mockReturnValueOnce(makeSelectChain([])); // invitations fallback

    await expect(updateRsvp('bad-token-xyz', { rsvpStatus: 'YES' })).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('works without optional mealPref', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([])) // rsvpTokens empty
      .mockReturnValueOnce(makeSelectChain([invitationRow]));
    mockUpdate
      .mockReturnValueOnce(makeUpdateChain([]))
      .mockReturnValueOnce(makeUpdateChain([{ ...guestRow, rsvpStatus: 'NO' }]));

    const result = await updateRsvp(TOKEN, { rsvpStatus: 'NO' });
    expect(result.rsvpStatus).toBe('NO');
  });

  it('honours canonical rsvp_tokens path before legacy fallback', async () => {
    const tokRow = { id: 't1', guestId: guestRow.id, token: TOKEN, expiresAt: new Date(Date.now() + 60_000) };
    const updatedGuest = { ...guestRow, rsvpStatus: 'YES' };

    mockSelect.mockReturnValueOnce(makeSelectChain([tokRow]));  // rsvp_tokens hit
    mockUpdate
      .mockReturnValueOnce(makeUpdateChain([])) // rsvpTokens.usedAt
      .mockReturnValueOnce(makeUpdateChain([updatedGuest])); // guests.rsvpStatus

    const result = await updateRsvp(TOKEN, { rsvpStatus: 'YES' });
    expect(result.rsvpStatus).toBe('YES');
  });

  it('rejects expired rsvp_tokens with 410', async () => {
    const expired = { id: 't1', guestId: guestRow.id, token: TOKEN, expiresAt: new Date(Date.now() - 60_000) };
    mockSelect.mockReturnValueOnce(makeSelectChain([expired]));

    await expect(updateRsvp(TOKEN, { rsvpStatus: 'YES' })).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 410,
    });
  });
});

// ── getRsvpStats ──────────────────────────────────────────────────────────────

describe('getRsvpStats', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct aggregation', async () => {
    const guestRows = [
      { rsvpStatus: 'YES',     mealPreference: 'VEG',           roomNumber: '101' },
      { rsvpStatus: 'YES',     mealPreference: 'NON_VEG',       roomNumber: '102' },
      { rsvpStatus: 'NO',      mealPreference: 'JAIN',          roomNumber: null  },
      { rsvpStatus: 'PENDING', mealPreference: 'VEGAN',         roomNumber: null  },
      { rsvpStatus: 'MAYBE',   mealPreference: 'NO_PREFERENCE', roomNumber: '103' },
    ];

    mockSelect
      .mockReturnValueOnce(makeSelectChain([weddingRow]))            // assertWeddingOwner

      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]))  // assertWeddingOwner → profile lookup
      .mockReturnValueOnce(makeSelectChain([{ id: GUEST_LIST_ID }])) // find guestList
      .mockReturnValueOnce(makeSelectNoLimit(guestRows));             // guests query

    const stats = await getRsvpStats(WEDDING_ID, USER_ID);

    expect(stats.total).toBe(5);
    expect(stats.confirmed).toBe(2);
    expect(stats.declined).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.maybe).toBe(1);
    expect(stats.mealBreakdown.veg).toBe(1);
    expect(stats.mealBreakdown.nonVeg).toBe(1);
    expect(stats.mealBreakdown.jain).toBe(1);
    expect(stats.mealBreakdown.vegan).toBe(1);
    expect(stats.mealBreakdown.noPreference).toBe(1);
    expect(stats.roomsAllocated).toBe(3);
  });

  it('returns zero stats when no guest list exists', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([weddingRow]))

      .mockReturnValueOnce(makeSelectChain([{ id: USER_ID }]))  // assertWeddingOwner → profile lookup
      .mockReturnValueOnce(makeSelectChain([])); // no guestList

    const stats = await getRsvpStats(WEDDING_ID, USER_ID);
    expect(stats.total).toBe(0);
    expect(stats.confirmed).toBe(0);
  });
});

// ── sendInvitations ───────────────────────────────────────────────────────────

describe('sendInvitations (mock mode)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('persists invitation row and returns ok in mock mode', async () => {
    // guestList lookup
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: GUEST_LIST_ID }]))
      // guests query: and(eq guestListId, inArray ids) — no .limit
      .mockReturnValueOnce(makeSelectNoLimit([guestRow]))
      // existing invitation check
      .mockReturnValueOnce(makeSelectChain([]));

    mockInsert.mockReturnValueOnce({ values: vi.fn().mockReturnThis() });

    const result = await sendInvitations(WEDDING_ID, {
      guestIds: [GUEST_ID],
      channel:  'EMAIL',
      type:     'INVITATION',
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.details[0]?.delivered).toBe(true);
    // RSVP token is intentionally omitted from the API response — it would
    // let the caller impersonate every guest's RSVP. Tokens travel only
    // through the delivery channel (SMS / email).
    expect(result.details[0]).not.toHaveProperty('token');
  });

  it('returns failed count for guest not in list', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: GUEST_LIST_ID }]))
      .mockReturnValueOnce(makeSelectNoLimit([])); // guest not found

    const result = await sendInvitations(WEDDING_ID, {
      guestIds: ['nonexistent-id'],
      channel:  'SMS',
      type:     'INVITATION',
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details[0]?.error).toBeDefined();
  });

  it('returns all failed when guest list does not exist', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]));

    const result = await sendInvitations(WEDDING_ID, {
      guestIds: [GUEST_ID],
      channel:  'EMAIL',
      type:     'INVITATION',
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });
});
