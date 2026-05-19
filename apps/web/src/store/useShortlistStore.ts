'use client';

/**
 * useShortlistStore — persisted Zustand store for match feed interaction state.
 *
 * Tracks two sets of profile IDs:
 *   - shortlisted: profiles the user has shortlisted (synced to API)
 *   - hidden: profiles the user has "passed" / hidden
 *
 * IMPORTANT: Hidden profiles are client-only. There is no POST /hide endpoint
 * in the matchmaking router. Hidden IDs are persisted to localStorage so they
 * survive navigation, but are NOT sent to the server.
 *
 * Also tracks optimistic request state (profileId → 'pending' | 'sent') for
 * showing "Request Sent" pills on Connect interactions.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ShortlistState {
  /** Profile IDs the user has shortlisted (synced to server). */
  shortlistedIds: Set<string>;
  /**
   * Profile IDs the user has hidden/passed — CLIENT ONLY.
   * No server endpoint exists; persisted to localStorage only.
   */
  hiddenIds: Set<string>;
  /** Profiles where a connect request has been sent (optimistic). */
  requestSentIds: Set<string>;

  // Actions
  addShortlisted: (profileId: string) => void;
  removeShortlisted: (profileId: string) => void;
  isShortlisted: (profileId: string) => boolean;

  addHidden: (profileId: string) => void;
  removeHidden: (profileId: string) => void;
  isHidden: (profileId: string) => boolean;
  clearHidden: () => void;

  addRequestSent: (profileId: string) => void;
  isRequestSent: (profileId: string) => boolean;
}

// Zustand v5 persist with Set serialization (Sets are not JSON-serializable natively)
type PersistedState = {
  shortlistedIds: string[];
  hiddenIds: string[];
  requestSentIds: string[];
};

export const useShortlistStore = create<ShortlistState>()(
  persist(
    (set, get) => ({
      shortlistedIds: new Set<string>(),
      hiddenIds: new Set<string>(),
      requestSentIds: new Set<string>(),

      addShortlisted: (profileId) =>
        set((s) => ({ shortlistedIds: new Set([...s.shortlistedIds, profileId]) })),

      removeShortlisted: (profileId) =>
        set((s) => {
          const next = new Set(s.shortlistedIds);
          next.delete(profileId);
          return { shortlistedIds: next };
        }),

      isShortlisted: (profileId) => get().shortlistedIds.has(profileId),

      addHidden: (profileId) =>
        set((s) => ({ hiddenIds: new Set([...s.hiddenIds, profileId]) })),

      removeHidden: (profileId) =>
        set((s) => {
          const next = new Set(s.hiddenIds);
          next.delete(profileId);
          return { hiddenIds: next };
        }),

      isHidden: (profileId) => get().hiddenIds.has(profileId),

      clearHidden: () => set({ hiddenIds: new Set<string>() }),

      addRequestSent: (profileId) =>
        set((s) => ({ requestSentIds: new Set([...s.requestSentIds, profileId]) })),

      isRequestSent: (profileId) => get().requestSentIds.has(profileId),
    }),
    {
      name: 'smartshaadi-shortlist',
      storage: createJSONStorage(() => localStorage),
      // Custom serializer: convert Sets → arrays for JSON storage
      partialize: (state): PersistedState => ({
        shortlistedIds: [...state.shortlistedIds],
        hiddenIds: [...state.hiddenIds],
        requestSentIds: [...state.requestSentIds],
      }),
      // Custom deserializer: convert arrays → Sets on rehydration
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedState>;
        return {
          ...current,
          shortlistedIds: new Set<string>(p.shortlistedIds ?? []),
          hiddenIds: new Set<string>(p.hiddenIds ?? []),
          requestSentIds: new Set<string>(p.requestSentIds ?? []),
        };
      },
    }
  )
);
