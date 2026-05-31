import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the Digital Invitation Builder service (contract Item 16).
 *
 * The Drizzle client is replaced with a fluent mock: every chain method
 * (.from/.where/.limit/.values/.set/.returning) is a no-op that records its
 * args, and `await`-ing any builder shifts the next canned result off a queue.
 * Each test seeds `state.queue` with exactly the rows its code path reads,
 * in call order. `@smartshaadi/db` and `drizzle-orm` are left real (table
 * objects + eq/and are pure and never touch a connection).
 */

const h = vi.hoisted(() => {
  const state: { queue: unknown[]; calls: Array<{ method: string; args: unknown[] }> } = {
    queue: [],
    calls: [],
  };
  return { state };
});

vi.mock('../../lib/db.js', () => {
  const { state } = h;
  const handler: ProxyHandler<() => void> = {
    get(_t, prop, receiver) {
      if (prop === 'then') {
        const item = state.queue.shift();
        return (onF: (v: unknown) => unknown, onR: (e: unknown) => unknown) =>
          Promise.resolve(item).then(onF, onR);
      }
      return (...args: unknown[]) => {
        state.calls.push({ method: String(prop), args });
        return receiver;
      };
    },
  };
  const proxy = new Proxy(function () {}, handler);
  const record = (method: string) => (...args: unknown[]) => {
    state.calls.push({ method, args });
    return proxy;
  };
  return {
    db: {
      select: record('select'),
      insert: record('insert'),
      update: record('update'),
      delete: record('delete'),
    },
  };
});

vi.mock('../../lib/mockStore.js', () => ({
  mockGet: vi.fn(() => null),
}));

vi.mock('../../infrastructure/mongo/models/WeddingPlan.js', () => ({
  WeddingPlan: { findOne: () => ({ lean: async () => null }) },
}));

vi.mock('../../storage/service.js', () => ({
  getPresignedUploadUrl: vi.fn(async () => ({ uploadUrl: 'https://r2/put', r2Key: 'invitations/x.pdf' })),
  getPhotoUrl: vi.fn(async () => 'https://r2/signed-get'),
}));

// Mock the PDF module so pdfkit is never loaded in the unit test.
vi.mock('../invite-pdf.js', () => ({
  generateInvitePdf: vi.fn(async () => Buffer.from('%PDF-mock')),
}));

import {
  submitPublicInviteRsvp, getPublicInvite, InviteError,
} from '../invite.service.js';

function valuesArg(): Record<string, unknown> | undefined {
  const c = h.state.calls.filter((x) => x.method === 'values').pop();
  return c?.args[0] as Record<string, unknown> | undefined;
}
function setArg(): Record<string, unknown> | undefined {
  const c = h.state.calls.filter((x) => x.method === 'set').pop();
  return c?.args[0] as Record<string, unknown> | undefined;
}

const publishedInvite = (over: Record<string, unknown> = {}) => ({
  id: 'inv1', weddingId: 'wed1', slug: 's', templateId: 'classic-royal',
  status: 'PUBLISHED', title: null, message: null, rsvpEnabled: true,
  assetKey: null, publishedAt: new Date(), ...over,
});
const wedding = (over: Record<string, unknown> = {}) => ({
  id: 'wed1', profileId: 'prof1', deletedAt: null,
  brideName: 'Asha', groomName: 'Vikram', weddingDate: '2026-12-01',
  venueName: 'Grand Hall', venueCity: 'Pune', venueAddress: 'MG Road',
  hashtag: '#AshaVikram', primaryColor: '#7B2D42', ...over,
});

beforeEach(() => {
  h.state.queue = [];
  h.state.calls = [];
});

describe('submitPublicInviteRsvp — self-registration into guests', () => {
  it('creates a new guest row when no matching phone exists', async () => {
    h.state.queue = [
      [publishedInvite({ slug: 'create1' })], // select invite by slug
      [wedding()],                            // select wedding
      [{ id: 'list1' }],                      // select guestList (exists)
      [],                                     // select guest by phone (none)
      undefined,                              // insert guests
    ];
    const res = await submitPublicInviteRsvp('create1', {
      name: 'Ravi', phone: '9991112222', attending: 'YES', plusOnes: 2,
    });
    expect(res).toEqual({ ok: true, created: true });
    const v = valuesArg();
    expect(v?.name).toBe('Ravi');
    expect(v?.guestListId).toBe('list1');
    expect(v?.rsvpStatus).toBe('YES');
    expect(v?.plusOnes).toBe(2);
  });

  it('dedupes by phone — updates the existing guest instead of inserting', async () => {
    h.state.queue = [
      [publishedInvite({ slug: 'dedupe1' })], // invite
      [wedding()],                            // wedding
      [{ id: 'list1' }],                      // guestList
      [{ id: 'guestExisting' }],              // guest by phone (exists)
      undefined,                              // update guests
    ];
    const res = await submitPublicInviteRsvp('dedupe1', {
      name: 'Ravi Updated', phone: '9991112222', attending: 'NO',
    });
    expect(res).toEqual({ ok: true, created: false });
    expect(setArg()?.rsvpStatus).toBe('NO');
    expect(h.state.calls.some((c) => c.method === 'insert')).toBe(false);
  });

  it('rejects when RSVP is disabled for the invite', async () => {
    h.state.queue = [[publishedInvite({ slug: 'off1', rsvpEnabled: false })]];
    await expect(
      submitPublicInviteRsvp('off1', { name: 'X', attending: 'YES' }),
    ).rejects.toMatchObject({ code: 'RSVP_DISABLED' });
  });

  it('404s when the slug has no published invite', async () => {
    h.state.queue = [[], []]; // two calls below, each reads one empty invite result
    await expect(
      submitPublicInviteRsvp('missing', { name: 'X', attending: 'YES' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      submitPublicInviteRsvp('missing2', { name: 'X', attending: 'YES' }),
    ).rejects.toBeInstanceOf(InviteError);
  });
});

describe('getPublicInvite — public view', () => {
  it('returns display data and never leaks owner PII', async () => {
    h.state.queue = [
      [publishedInvite({ slug: 'view1' })], // invite by slug
      [wedding()],                          // wedding
      [{ id: 'c1', type: 'WEDDING', date: '2026-12-01', startTime: '18:30', venue: 'Grand Hall' }], // ceremonies
    ];
    const view = await getPublicInvite('view1');
    expect(view).not.toBeNull();
    expect(view?.brideName).toBe('Asha');
    expect(view?.groomName).toBe('Vikram');
    expect(view?.ceremonies).toHaveLength(1);
    const keys = Object.keys(view!);
    expect(keys).not.toContain('userId');
    expect(keys).not.toContain('profileId');
    expect(keys).not.toContain('ownerPhone');
  });

  it('returns null for an unpublished / unknown slug', async () => {
    h.state.queue = [[]]; // no invite (status filter / not found)
    expect(await getPublicInvite('nope')).toBeNull();
  });
});
