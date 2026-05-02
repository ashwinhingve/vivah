/**
 * Smart Shaadi — Seating greedy assignment smoke tests
 *
 * Validates the auto-assign sort order + capacity-fill algorithm. Pure
 * function over arrays — no DB needed.
 */

import { describe, expect, it } from 'vitest';

interface Guest {
  id: string;
  side: string | null;
  relationship: string | null;
  isVip: boolean;
  plusOnes: number;
}

interface Table {
  id: string;
  capacity: number;
  used: number;
}

function sortGuests(guests: Guest[]): Guest[] {
  return [...guests].sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    const sideCmp = (a.side ?? '').localeCompare(b.side ?? '');
    if (sideCmp !== 0) return sideCmp;
    return (a.relationship ?? '').localeCompare(b.relationship ?? '');
  });
}

function greedyAssign(guests: Guest[], tables: Table[]): { assigned: number; unassigned: number } {
  let assigned = 0;
  let unassigned = 0;
  for (const g of sortGuests(guests)) {
    const seatsNeeded = 1 + g.plusOnes;
    const target = tables.find(t => (t.capacity - t.used) >= seatsNeeded);
    if (!target) { unassigned++; continue; }
    target.used += seatsNeeded;
    assigned++;
  }
  return { assigned, unassigned };
}

describe('seating greedy auto-assign', () => {
  it('seats VIPs first', () => {
    const guests: Guest[] = [
      { id: 'a', side: 'BRIDE', relationship: 'friend', isVip: false, plusOnes: 0 },
      { id: 'b', side: 'GROOM', relationship: 'parent', isVip: true,  plusOnes: 0 },
    ];
    const sorted = sortGuests(guests);
    expect(sorted[0]?.id).toBe('b');
  });

  it('groups guests by side then relationship', () => {
    const guests: Guest[] = [
      { id: 'a', side: 'GROOM', relationship: 'cousin',  isVip: false, plusOnes: 0 },
      { id: 'b', side: 'BRIDE', relationship: 'aunt',    isVip: false, plusOnes: 0 },
      { id: 'c', side: 'BRIDE', relationship: 'cousin',  isVip: false, plusOnes: 0 },
    ];
    const sorted = sortGuests(guests);
    expect(sorted.map(g => g.id)).toEqual(['b', 'c', 'a']);
  });

  it('counts plusOnes against table capacity', () => {
    const guests: Guest[] = [
      { id: 'a', side: null, relationship: null, isVip: false, plusOnes: 3 },  // needs 4 seats
      { id: 'b', side: null, relationship: null, isVip: false, plusOnes: 0 },  // needs 1 seat
    ];
    const tables: Table[] = [{ id: 'T1', capacity: 4, used: 0 }];
    const out = greedyAssign(guests, tables);
    expect(out.assigned).toBe(1);
    expect(out.unassigned).toBe(1);
  });

  it('falls back to next table if first is full', () => {
    const guests: Guest[] = Array.from({ length: 5 }, (_, i) => ({
      id: `g${i}`, side: null, relationship: null, isVip: false, plusOnes: 0,
    }));
    const tables: Table[] = [
      { id: 'T1', capacity: 2, used: 0 },
      { id: 'T2', capacity: 4, used: 0 },
    ];
    const out = greedyAssign(guests, tables);
    expect(out.assigned).toBe(5);
    expect(out.unassigned).toBe(0);
    expect(tables[0]!.used).toBe(2);
    expect(tables[1]!.used).toBe(3);
  });

  it('reports unassigned guests when no table fits', () => {
    const guests: Guest[] = Array.from({ length: 10 }, (_, i) => ({
      id: `g${i}`, side: null, relationship: null, isVip: false, plusOnes: 0,
    }));
    const tables: Table[] = [{ id: 'T1', capacity: 4, used: 0 }];
    const out = greedyAssign(guests, tables);
    expect(out.assigned).toBe(4);
    expect(out.unassigned).toBe(6);
  });
});
