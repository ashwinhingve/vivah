import { z } from 'zod';

export const CreateVideoRoomSchema = z.object({
  matchId:     z.string().uuid(),
  durationMin: z.number().int().min(15).max(120).default(60),
});

// FIX 4: Add Zod refinements for scheduledAt:
//   - Must be > now + 5 minutes
//   - Must be < now + 30 days
export const ScheduleMeetingSchema = z.object({
  matchId:     z.string().uuid(),
  scheduledAt: z.string().datetime().refine(
    (val) => new Date(val).getTime() > Date.now() + 5 * 60 * 1000,
    { message: 'scheduledAt must be at least 5 minutes in the future' },
  ).refine(
    (val) => new Date(val).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000,
    { message: 'scheduledAt must be within 30 days from now' },
  ),
  durationMin: z.number().int().min(15).max(120).default(60),
  notes:       z.string().max(500).optional(),
  // Phase 7 Sprint F — optional curated icebreaker set to seed the date.
  icebreakerSetKey: z.string().max(60).optional(),
});

export const RespondMeetingSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  notes:  z.string().max(500).optional(),
});

// Phase 7 Sprint F — one participant's post-date feedback.
export const VirtualDateFeedbackSchema = z.object({
  rating:   z.number().int().min(1).max(5),
  continue: z.boolean(),
});

export type CreateVideoRoomInput     = z.infer<typeof CreateVideoRoomSchema>;
export type ScheduleMeetingInput     = z.infer<typeof ScheduleMeetingSchema>;
export type RespondMeetingInput      = z.infer<typeof RespondMeetingSchema>;
export type VirtualDateFeedbackInput = z.infer<typeof VirtualDateFeedbackSchema>;
