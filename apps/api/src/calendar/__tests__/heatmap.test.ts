import { describe, it, expect } from 'vitest';

/**
 * Heatmap aggregation logic tests.
 *
 * These tests focus on the data transformation logic:
 * - Date range expansion (handling endDate)
 * - Per-day aggregation (bands, kinds)
 * - Demand metric calculation
 * - Month grid generation
 */

// Mock data type matching the DB schema
interface MockCalendarEvent {
  id: string;
  kind: string;
  name: string;
  eventDate: string;
  endDate: string | null;
  region: string | null;
  source: string;
  auspiciousBand: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

describe('Heatmap aggregation logic', () => {
  it('should expand single-day events', () => {
    const event: MockCalendarEvent = {
      id: '1',
      kind: 'MUHURAT',
      name: 'Diwali',
      eventDate: '2024-11-01',
      endDate: null,
      region: null,
      source: 'DrikPanchang',
      auspiciousBand: 'PEAK',
      metadata: null,
      createdAt: new Date(),
    };

    const dayMap = new Map<string, { bands: Set<string>; kinds: Map<string, number> }>();
    const start = new Date(event.eventDate);
    const end = event.endDate ? new Date(event.endDate) : start;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (dateStr) {
        if (!dayMap.has(dateStr)) {
          dayMap.set(dateStr, { bands: new Set(), kinds: new Map() });
        }
        const entry = dayMap.get(dateStr)!;
        entry.bands.add(event.auspiciousBand);
        entry.kinds.set(event.kind, (entry.kinds.get(event.kind) ?? 0) + 1);
      }
    }

    expect(dayMap.size).toBe(1);
    expect(dayMap.get('2024-11-01')).toBeDefined();
    const entry = dayMap.get('2024-11-01')!;
    expect(Array.from(entry.bands)).toContain('PEAK');
    expect(entry.kinds.get('MUHURAT')).toBe(1);
  });

  it('should expand multi-day events correctly', () => {
    const event: MockCalendarEvent = {
      id: '2',
      kind: 'FESTIVAL',
      name: 'Dussehra',
      eventDate: '2024-10-12',
      endDate: '2024-10-14',
      region: null,
      source: 'Indian Calendar',
      auspiciousBand: 'HIGH',
      metadata: null,
      createdAt: new Date(),
    };

    const dayMap = new Map<string, { bands: Set<string>; kinds: Map<string, number> }>();
    const start = new Date(event.eventDate);
    const end = event.endDate ? new Date(event.endDate) : start;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (dateStr) {
        if (!dayMap.has(dateStr)) {
          dayMap.set(dateStr, { bands: new Set(), kinds: new Map() });
        }
        const entry = dayMap.get(dateStr)!;
        entry.bands.add(event.auspiciousBand);
        entry.kinds.set(event.kind, (entry.kinds.get(event.kind) ?? 0) + 1);
      }
    }

    expect(dayMap.size).toBe(3);
    expect(dayMap.get('2024-10-12')).toBeDefined();
    expect(dayMap.get('2024-10-13')).toBeDefined();
    expect(dayMap.get('2024-10-14')).toBeDefined();
  });

  it('should correctly select highest auspicious band on a day', () => {
    const events: MockCalendarEvent[] = [
      {
        id: '1',
        kind: 'MUHURAT',
        name: 'Muhurat Window 1',
        eventDate: '2024-11-15',
        endDate: null,
        region: null,
        source: 'DrikPanchang',
        auspiciousBand: 'MEDIUM',
        metadata: null,
        createdAt: new Date(),
      },
      {
        id: '2',
        kind: 'MUHURAT',
        name: 'Muhurat Window 2',
        eventDate: '2024-11-15',
        endDate: null,
        region: null,
        source: 'DrikPanchang',
        auspiciousBand: 'PEAK',
        metadata: null,
        createdAt: new Date(),
      },
    ];

    const dayMap = new Map<string, { bands: Set<string>; kinds: Map<string, number> }>();

    events.forEach(event => {
      const dateStr = event.eventDate;
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { bands: new Set(), kinds: new Map() });
      }
      const entry = dayMap.get(dateStr)!;
      entry.bands.add(event.auspiciousBand);
      entry.kinds.set(event.kind, (entry.kinds.get(event.kind) ?? 0) + 1);
    });

    const bandRank: Record<string, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      PEAK: 4,
    };

    const entry = dayMap.get('2024-11-15')!;
    const bands = Array.from(entry.bands);
    const highestBand = bands.sort((a, b) => (bandRank[b] ?? 0) - (bandRank[a] ?? 0))[0] ?? 'NONE';

    expect(highestBand).toBe('PEAK');
  });

  it('should calculate demand metric correctly', () => {
    const bandRank: Record<string, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      PEAK: 4,
    };

    // Test PEAK band with 2 kinds: (4/4)*0.6 + (2/6)*0.4 = 0.6 + 0.133 = 0.733
    const band1 = 'PEAK';
    const kindCount1 = 2;
    const bandContribution1 = (bandRank[band1] ?? 0) / 4 * 0.6;
    const kindContribution1 = (kindCount1 / 6) * 0.4;
    const demand1 = Math.min(bandContribution1 + kindContribution1, 1.0);

    expect(demand1).toBeGreaterThan(0.7);
    expect(demand1).toBeLessThanOrEqual(1.0);

    // Test NONE band with 0 kinds
    const band2 = 'NONE';
    const kindCount2 = 0;
    const bandContribution2 = (bandRank[band2] ?? 0) / 4 * 0.6;
    const kindContribution2 = (kindCount2 / 6) * 0.4;
    const demand2 = Math.min(bandContribution2 + kindContribution2, 1.0);

    expect(demand2).toBe(0);

    // Test MEDIUM band with 1 kind: (2/4)*0.6 + (1/6)*0.4 = 0.3 + 0.067 = 0.367
    const band3 = 'MEDIUM';
    const kindCount3 = 1;
    const bandContribution3 = (bandRank[band3] ?? 0) / 4 * 0.6;
    const kindContribution3 = (kindCount3 / 6) * 0.4;
    const demand3 = Math.min(bandContribution3 + kindContribution3, 1.0);

    expect(demand3).toBeGreaterThan(0.3);
    expect(demand3).toBeLessThan(0.5);
  });

  it('should aggregate multiple kinds on the same day', () => {
    const events: MockCalendarEvent[] = [
      {
        id: '1',
        kind: 'MUHURAT',
        name: 'Muhurat',
        eventDate: '2024-11-20',
        endDate: null,
        region: null,
        source: 'DrikPanchang',
        auspiciousBand: 'HIGH',
        metadata: null,
        createdAt: new Date(),
      },
      {
        id: '2',
        kind: 'FESTIVAL',
        name: 'Kartik Month',
        eventDate: '2024-11-20',
        endDate: null,
        region: null,
        source: 'Hindu Calendar',
        auspiciousBand: 'LOW',
        metadata: null,
        createdAt: new Date(),
      },
      {
        id: '3',
        kind: 'SCHOOL',
        name: 'School Holiday',
        eventDate: '2024-11-20',
        endDate: null,
        region: null,
        source: 'Government',
        auspiciousBand: 'NONE',
        metadata: null,
        createdAt: new Date(),
      },
    ];

    const dayMap = new Map<string, { bands: Set<string>; kinds: Map<string, number> }>();

    events.forEach(event => {
      const dateStr = event.eventDate;
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { bands: new Set(), kinds: new Map() });
      }
      const entry = dayMap.get(dateStr)!;
      entry.bands.add(event.auspiciousBand);
      entry.kinds.set(event.kind, (entry.kinds.get(event.kind) ?? 0) + 1);
    });

    const entry = dayMap.get('2024-11-20')!;
    expect(entry.bands.size).toBe(3);
    expect(entry.kinds.size).toBe(3);
    expect(entry.kinds.get('MUHURAT')).toBe(1);
    expect(entry.kinds.get('FESTIVAL')).toBe(1);
    expect(entry.kinds.get('SCHOOL')).toBe(1);
  });

  it('should generate correct calendar grid for month', () => {
    const year = 2024;
    const monthNum = 11; // November

    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    expect(daysInMonth).toBe(30); // November has 30 days
    expect(startingDayOfWeek).toBeGreaterThanOrEqual(0);
    expect(startingDayOfWeek).toBeLessThan(7);

    // Build grid
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(startingDayOfWeek).fill(null);

    for (let i = 1; i <= daysInMonth; i++) {
      week.push(i);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    // Count total days in grid
    const totalDaysInGrid = weeks.reduce((sum, w) => sum + w.filter(d => d !== null).length, 0);
    expect(totalDaysInGrid).toBe(daysInMonth);

    // All weeks should have 7 days
    weeks.forEach(w => {
      expect(w.length).toBe(7);
    });
  });
});
