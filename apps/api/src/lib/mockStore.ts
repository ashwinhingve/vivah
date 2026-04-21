// Shared in-memory store for USE_MOCK_SERVICES=true mode.
// Keyed by userId; each value is the full ProfileContent document shape.
//
// Persists to disk so dev-server restarts (tsx watch) don't wipe saved
// onboarding data, which would otherwise trigger computeAndUpdateCompleteness
// to overwrite profileSections with all-false on the next /profiles/me call.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const STORE_FILE = resolve(process.cwd(), 'apps/api/.data/mockStore.json');

function loadFromDisk(): Map<string, Record<string, unknown>> {
  try {
    const raw = readFileSync(STORE_FILE, 'utf8');
    const obj = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function persistToDisk(): void {
  try {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    const obj = Object.fromEntries(mockStore.entries());
    writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {
    // Best-effort persistence — don't crash the request on disk errors.
  }
}

export const mockStore: Map<string, Record<string, unknown>> = loadFromDisk();

export function mockUpsertField(userId: string, field: string, value: unknown): Record<string, unknown> {
  const doc = mockStore.get(userId) ?? { userId };
  doc[field] = value;
  mockStore.set(userId, doc);
  persistToDisk();
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
  persistToDisk();
  return doc;
}

export function mockGet(userId: string): Record<string, unknown> | null {
  return mockStore.get(userId) ?? null;
}
