// Shared in-memory store for USE_MOCK_SERVICES=true mode.
// Keyed by userId; each value is the full ProfileContent document shape.
export const mockStore = new Map<string, Record<string, unknown>>();

export function mockUpsertField(userId: string, field: string, value: unknown): Record<string, unknown> {
  const doc = mockStore.get(userId) ?? { userId };
  doc[field] = value;
  mockStore.set(userId, doc);
  return doc;
}

export function mockUpsertDotFields(userId: string, dotFields: Record<string, unknown>): Record<string, unknown> {
  const doc = mockStore.get(userId) ?? { userId };
  for (const [dotKey, val] of Object.entries(dotFields)) {
    const [section, ...rest] = dotKey.split('.');
    if (!section) continue;
    if (rest.length === 0) {
      doc[section] = val;
    } else {
      if (typeof doc[section] !== 'object' || doc[section] === null) doc[section] = {};
      (doc[section] as Record<string, unknown>)[rest.join('.')] = val;
    }
  }
  mockStore.set(userId, doc);
  return doc;
}

export function mockGet(userId: string): Record<string, unknown> | null {
  return mockStore.get(userId) ?? null;
}
