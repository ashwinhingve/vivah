/**
 * Virtual Date System (Phase 7 Sprint F, Unit 7.3).
 *
 * A "virtual date" is the durable wrapper around the existing ephemeral
 * Daily.co room + Redis meeting proposal: it persists the scheduled experience,
 * its status lifecycle, the chosen icebreaker set, and per-participant post-date
 * feedback. Dates on the wire carry ISO-8601 timestamp strings.
 */

export type VirtualDateStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface VirtualDate {
  id:               string;
  matchId:          string;
  proposedBy:       string;   // profiles.id of the proposer
  scheduledAt:      string;   // ISO-8601
  durationMin:      number;
  status:           VirtualDateStatus;
  roomName:         string | null;
  icebreakerSetKey: string | null;
  notes:            string | null;
  proposerRating:   number | null;   // 1..5
  inviteeRating:    number | null;   // 1..5
  proposerContinue: boolean | null;
  inviteeContinue:  boolean | null;
  completedAt:      string | null;
  createdAt:        string;
  updatedAt:        string;
}

/** One participant's post-date feedback submission. */
export interface VirtualDateFeedback {
  rating:   number;    // 1..5
  continue: boolean;   // wants to keep talking
}

/** A curated, deterministic set of conversation prompts (no LLM). */
export interface IcebreakerSet {
  key:     string;
  label:   string;
  prompts: string[];
}
