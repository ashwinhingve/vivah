/**
 * useEntitlement — security-behaviour tests (no @testing-library dependency).
 *
 * Covers two audit fixes:
 *  - fail-closed: an undefined feature flag is treated as LOCKED
 *  - refresh() keeps existing entitlements when the refetch fails
 *
 * Module-level cache is reset per test via vi.resetModules() + dynamic import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Tell React this is an act()-aware environment so effect flushing is
// deterministic (jsdom env without @testing-library doesn't set this).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookModule = typeof import('../useEntitlement');
type HookReturn = ReturnType<HookModule['useEntitlement']>;

const SAMPLE = (entitlements: Record<string, boolean>) => ({
  tier: 'PREMIUM',
  entitlements,
  quotas: { interestsToday: { used: 0, limit: null, remaining: null } },
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function freshHook(): Promise<HookModule> {
  vi.resetModules();
  return import('../useEntitlement');
}

/** Mount a probe component that calls the hook; flush effects + microtasks. */
async function renderHook(mod: HookModule): Promise<{ current: HookReturn }> {
  const ref = { current: undefined as unknown as HookReturn };
  function Probe(): null {
    ref.current = mod.useEntitlement();
    return null;
  }
  await act(async () => {
    root.render(createElement(Probe));
  });
  // settle the loadEntitlements fetch + json microtasks + effect setState
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return ref;
}

describe('useEntitlement — fail-closed', () => {
  it('isLocked() returns true for an undefined feature', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: SAMPLE({ knownFeature: true }) }),
      }),
    );
    const mod = await freshHook();
    const ref = await renderHook(mod);

    // known feature present + true → not locked
    expect(ref.current.isLocked('knownFeature' as never)).toBe(false);
    // undefined feature → fail-closed → locked
    expect(ref.current.isLocked('totallyUnknownFeature' as never)).toBe(true);
  });
});

describe('useEntitlement — refresh keeps state on failure', () => {
  it('does not clear entitlements when the refetch fails', async () => {
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: SAMPLE({ premiumChat: true }) }),
    });
    vi.stubGlobal('fetch', okFetch);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await freshHook();
    const ref = await renderHook(mod);

    const before = ref.current.state;
    expect(before).not.toBeNull();
    expect(ref.current.isLocked('premiumChat' as never)).toBe(false);

    // Now the refetch fails (!res.ok → loadEntitlements resolves null).
    okFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    await act(async () => { await ref.current.refresh(); });
    await act(async () => { await Promise.resolve(); });

    // State preserved — same good entitlements, still unlocked.
    expect(ref.current.state).toEqual(before);
    expect(ref.current.isLocked('premiumChat' as never)).toBe(false);
    expect(errSpy).toHaveBeenCalled();
  });
});
