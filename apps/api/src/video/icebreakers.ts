/**
 * Curated icebreaker sets for the Virtual Date System (Unit 7.3).
 *
 * Deterministic, hand-curated prompt lists — NO LLM (Architecture Rule 1 keeps
 * all model calls in ai-service / web/lib/ai; this is static data). A date can
 * optionally pick a set; the key is stored on the virtual_dates row.
 *
 * Tone is warm/family-first, matching Smart Shaadi (a marriage platform, not a
 * dating app) — prompts encourage values, family, and life-goal conversation.
 */

import type { IcebreakerSet } from '@smartshaadi/types';

export const ICEBREAKER_SETS: readonly IcebreakerSet[] = [
  {
    key: 'getting-to-know',
    label: 'Getting to know each other',
    prompts: [
      'What does a perfect weekend look like for you?',
      'Which family tradition means the most to you?',
      'What are you most passionate about outside of work?',
      'Who has shaped the person you are today?',
    ],
  },
  {
    key: 'values-and-family',
    label: 'Values & family',
    prompts: [
      'How do you imagine celebrating festivals together?',
      'What role do you hope family plays in your daily life?',
      'What values do you most want to build a home around?',
      'How do you like to support the people you love?',
    ],
  },
  {
    key: 'life-goals',
    label: 'Dreams & the future',
    prompts: [
      'Where do you hope to be five years from now?',
      'Is there a place you have always dreamed of travelling to?',
      'What does a fulfilling life mean to you?',
      'What is a goal you are working towards right now?',
    ],
  },
  {
    key: 'lighthearted',
    label: 'Keep it light',
    prompts: [
      'What is your comfort food after a long day?',
      'Are you a morning person or a night owl?',
      'What song always lifts your mood?',
      'What is the last thing that made you laugh out loud?',
    ],
  },
] as const;

const BY_KEY = new Map<string, IcebreakerSet>(ICEBREAKER_SETS.map((s) => [s.key, s]));

/** All curated sets (for the schedule UI to choose from). */
export function listIcebreakerSets(): readonly IcebreakerSet[] {
  return ICEBREAKER_SETS;
}

/** A single set by key, or null if the key is unknown. */
export function getIcebreakerSet(key: string): IcebreakerSet | null {
  return BY_KEY.get(key) ?? null;
}

/** Validate a client-supplied set key against the curated catalogue. */
export function isValidIcebreakerKey(key: string): boolean {
  return BY_KEY.has(key);
}
