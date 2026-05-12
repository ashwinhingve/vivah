/**
 * Tests for routeVendorToEvent — covers the four key scoring branches:
 * blocked date, event-type disabled, location match, same-week capacity drag.
 *
 * Drizzle is mocked at the table level — each `db.select().from().where()...`
 * chain is queued to return a specific row set. The four awaited promises
 * inside the function run in parallel via Promise.all and pull from the
 * queue in deterministic call order: [vendorRow, eventTypeRow, blockedRow,
 * nearbyBookings].
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResults } = vi.hoisted(() => ({
  mockResults: { queue: [] as unknown[] },
}));

function nextResult<T>(): T {
  if (mockResults.queue.length === 0) return [] as unknown as T;
  return mockResults.queue.shift() as T;
}

vi.mock('../../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const result = nextResult<unknown[]>();
          // .limit() chain — returns thenable for first three queries
          const thenable = {
            limit: vi.fn(() => Promise.resolve(result)),
            then: (resolve: (v: unknown) => void) => resolve(result),
            catch: vi.fn(() => Promise.resolve(result)),
          };
          return thenable;
        }),
      })),
    })),
  },
}));

import { routeVendorToEvent } from '../eventRouter.js';

const VENDOR_ID = '550e8400-e29b-41d4-a716-446655440111';
const EVENT_DATE = new Date('2026-08-15T00:00:00Z');

function queue(
  vendor: unknown[] | undefined,
  eventType: unknown[] | undefined,
  blocked: unknown[] | undefined,
  nearby: unknown[] | undefined,
) {
  mockResults.queue = [vendor ?? [], eventType ?? [], blocked ?? [], nearby ?? []];
}

describe('routeVendorToEvent', () => {
  beforeEach(() => {
    mockResults.queue = [];
  });

  it('returns routable=false with score 0 when the date is blocked', async () => {
    queue(
      [{ id: VENDOR_ID, city: 'Mumbai', state: 'MH', isActive: true }],
      [{ available: true }],
      [{ date: '2026-08-15' }],
      [],
    );

    const result = await routeVendorToEvent(
      VENDOR_ID,
      'WEDDING',
      EVENT_DATE,
      { city: 'Mumbai', state: 'MH' },
    );

    expect(result.routable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons).toContain('date_blocked');
  });

  it('returns routable=false when the event type is explicitly disabled', async () => {
    queue(
      [{ id: VENDOR_ID, city: 'Mumbai', state: 'MH', isActive: true }],
      [{ available: false }],
      [],
      [],
    );

    const result = await routeVendorToEvent(VENDOR_ID, 'CORPORATE', EVENT_DATE);

    expect(result.routable).toBe(false);
    expect(result.reasons).toContain('event_type_disabled');
  });

  it('boosts the score when the event city matches the vendor city', async () => {
    queue(
      [{ id: VENDOR_ID, city: 'Mumbai', state: 'MH', isActive: true }],
      [{ available: true }],
      [],
      [],
    );

    const result = await routeVendorToEvent(
      VENDOR_ID,
      'WEDDING',
      EVENT_DATE,
      { city: 'Mumbai', state: 'MH' },
    );

    // base 50 + event_type 20 + city 15 = 85
    expect(result.routable).toBe(true);
    expect(result.score).toBe(85);
    expect(result.reasons).toContain('city_match');
  });

  it('reduces the score for same-week bookings (capacity drag)', async () => {
    queue(
      [{ id: VENDOR_ID, city: 'Mumbai', state: 'MH', isActive: true }],
      [{ available: true }],
      [],
      [{ id: 'b1', eventDate: '2026-08-14' }, { id: 'b2', eventDate: '2026-08-16' }],
    );

    const result = await routeVendorToEvent(
      VENDOR_ID,
      'WEDDING',
      EVENT_DATE,
      { city: 'Mumbai', state: 'MH' },
    );

    // base 50 + event_type 20 + city 15 - drag 20 = 65
    expect(result.routable).toBe(true);
    expect(result.score).toBe(65);
    expect(result.estimated_capacity_pct).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.startsWith('same_week_bookings:'))).toBe(true);
  });
});
