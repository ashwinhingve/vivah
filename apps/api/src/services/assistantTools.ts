/**
 * Assistant tool registry — the authorized data layer behind the AI assistant.
 *
 * Each entry wraps an EXISTING user-filtered service function and returns a
 * compact, redacted projection. The internal bridge (routes/internal.ts) re-
 * resolves userId->profileId and passes the server-derived ProfileId as ctx, so
 * a tool can only ever read the authenticated caller's own data. Phone numbers
 * and email addresses are structurally excluded from every projection
 * (CLAUDE.md rule 5). The assistant is READ-ONLY — no tool here mutates state.
 *
 * Tool names must stay in lockstep with the Python catalog
 * (apps/ai-service/src/services/assistant_tools.py).
 */
import { or, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { matchScores } from '@smartshaadi/db';
import { asProfileId, type ProfileId } from '@smartshaadi/types';
import { db } from '../lib/db.js';
import { getMyProfile, type ProfileResponse } from '../profiles/service.js';
import {
  getReceivedRequests,
  getSentRequests,
  getWhoLikedMe,
  getMatchStatusWith,
} from '../matchmaking/requests/service.js';
import {
  listUserWeddings,
  getBudget,
  getTaskBoard,
  getCeremonies,
  getMuhuratSuggestions,
} from '../weddings/service.js';
import { listConversations, getTotalUnreadCount } from '../chat/conversations.service.js';
import { findSimilarMatches } from '../matchmaking/semanticSearch.js';

/** Semantic search is gated — default off. Flip ASSISTANT_SEMANTIC_SEARCH_ENABLED=true to enable. */
function isSemanticEnabled(): boolean {
  return (process.env['ASSISTANT_SEMANTIC_SEARCH_ENABLED'] ?? '').toLowerCase() === 'true';
}

export interface ToolContext {
  userId: string;
  profileId: ProfileId;
}

/** A tool runner validates its own raw args then executes. */
type ToolRunner = (rawArgs: unknown, ctx: ToolContext) => Promise<unknown>;

function tool<A>(
  schema: z.ZodType<A>,
  handler: (args: A, ctx: ToolContext) => Promise<unknown>,
): ToolRunner {
  return async (rawArgs, ctx) => {
    const parsed = schema.parse(rawArgs ?? {});
    return handler(parsed, ctx);
  };
}

const EMPTY = z.object({}).strip();

// ── Redaction helpers ─────────────────────────────────────────────────────────

/** The user's OWN profile minus contact + binary-asset fields. */
function compactProfile(p: ProfileResponse): Record<string, unknown> {
  const {
    phoneNumber: _phone,
    email: _email,
    photos,
    audioIntroKey: _audio,
    videoIntroKey: _video,
    userId: _uid,
    ...rest
  } = p;
  return { ...rest, has_photos: photos.length > 0, photo_count: photos.length };
}

function maskedName(profileId: string): string {
  return `Match ${profileId.slice(0, 8)}`;
}

// ── Focused queries ───────────────────────────────────────────────────────────

async function topMatches(profileId: ProfileId, limit: number) {
  const rows = await db
    .select({
      profileA: matchScores.profileA,
      profileB: matchScores.profileB,
      totalScore: matchScores.totalScore,
    })
    .from(matchScores)
    .where(or(eq(matchScores.profileA, profileId), eq(matchScores.profileB, profileId)))
    .orderBy(desc(matchScores.totalScore))
    .limit(limit)
    .catch(() => []);
  return rows.map((row) => {
    const otherId = row.profileA === profileId ? row.profileB : row.profileA;
    return {
      profile_id: otherId,
      display_name: maskedName(otherId),
      compatibility_pct: Math.max(0, Math.min(100, row.totalScore ?? 0)),
    };
  });
}

// ── Element-type helpers (avoid `any`, no need for un-exported named types) ─────

type ReceivedRequest = Awaited<ReturnType<typeof getReceivedRequests>>['requests'][number];
type WhoLikedItem = Awaited<ReturnType<typeof getWhoLikedMe>>['items'][number];
type ConversationItem = Awaited<ReturnType<typeof listConversations>>[number];

// ── Registry ──────────────────────────────────────────────────────────────────

export const ASSISTANT_TOOLS: Record<string, ToolRunner> = {
  get_my_profile: tool(EMPTY, async (_args, { userId }) => {
    const p = await getMyProfile(userId);
    if (!p) return { error: 'profile_not_found' };
    return compactProfile(p);
  }),

  get_my_matches: tool(EMPTY, async (_args, { profileId }) => {
    const matches = await topMatches(profileId, 5);
    return { count: matches.length, matches };
  }),

  get_pending_requests: tool(
    z.object({ direction: z.enum(['received', 'sent']).optional() }).strip(),
    async ({ direction }, { profileId }) => {
      const dir = direction ?? 'received';
      const page =
        dir === 'sent'
          ? await getSentRequests(profileId, 1, 20)
          : await getReceivedRequests(profileId, 1, 20);
      const items = page.requests.map((r: ReceivedRequest) => ({
        request_id: r.id,
        status: r.status,
        created_at: r.createdAt,
        message: r.message ?? null,
      }));
      return { direction: dir, total: page.total, count: items.length, requests: items };
    },
  ),

  get_who_liked_me: tool(EMPTY, async (_args, { profileId }) => {
    const { items, total } = await getWhoLikedMe(profileId, 20);
    const people = items.map((i: WhoLikedItem) => ({
      sender_profile_id: i.senderProfileId,
      name: i.name,
      age: i.age,
      city: i.city,
      is_verified: i.isVerified,
      created_at: i.createdAt,
    }));
    return { total, count: people.length, people };
  }),

  get_match_status: tool(
    z.object({ other_profile_id: z.string().uuid() }).strip(),
    async ({ other_profile_id }, { profileId }) => {
      const result = await getMatchStatusWith(profileId, asProfileId(other_profile_id));
      return { status: result.status, request_id: result.requestId };
    },
  ),

  list_conversations: tool(EMPTY, async (_args, { profileId }) => {
    const items = await listConversations({ profileId, limit: 20 });
    const conversations = items.map((c: ConversationItem) => ({
      match_request_id: c.matchRequestId,
      other_name: c.other?.firstName ?? null,
      last_message: c.lastMessage?.content ?? null,
      unread_count: c.unreadCount,
      updated_at: c.updatedAt,
    }));
    return { count: conversations.length, conversations };
  }),

  get_unread_count: tool(EMPTY, async (_args, { profileId }) => {
    const unread = await getTotalUnreadCount(profileId);
    return { unread_total: unread };
  }),

  list_weddings: tool(EMPTY, async (_args, { userId }) => {
    const weddings = await listUserWeddings(userId);
    return { count: weddings.length, weddings };
  }),

  get_wedding_budget: tool(
    z.object({ wedding_id: z.string() }).strip(),
    async ({ wedding_id }, { userId }) => {
      const budget = await getBudget(userId, wedding_id);
      if (!budget) return { error: 'wedding_not_found' };
      return budget;
    },
  ),

  get_wedding_tasks: tool(
    z.object({ wedding_id: z.string() }).strip(),
    async ({ wedding_id }, { userId }) => {
      const board = await getTaskBoard(userId, wedding_id);
      if (!board) return { error: 'wedding_not_found' };
      return {
        counts: {
          todo: board.TODO.length,
          in_progress: board.IN_PROGRESS.length,
          done: board.DONE.length,
        },
        todo: board.TODO.slice(0, 20),
        in_progress: board.IN_PROGRESS.slice(0, 20),
      };
    },
  ),

  get_wedding_ceremonies: tool(
    z.object({ wedding_id: z.string() }).strip(),
    async ({ wedding_id }, { userId }) => {
      try {
        const ceremonies = await getCeremonies(userId, wedding_id);
        return { count: ceremonies.length, ceremonies };
      } catch {
        return { error: 'wedding_not_found' };
      }
    },
  ),

  suggest_muhurat_dates: tool(
    z.object({ wedding_date: z.string() }).strip(),
    async ({ wedding_date }) => {
      const dates = getMuhuratSuggestions(wedding_date);
      return { count: dates.length, dates };
    },
  ),

  find_similar_matches: tool(
    z.object({ limit: z.number().int().min(1).max(10).optional() }).strip(),
    async ({ limit }, { userId }) => {
      if (!isSemanticEnabled()) return { error: 'not_enabled' };
      return findSimilarMatches(userId, limit ?? 5);
    },
  ),
};

/** True when the named tool exists in the registry. */
export function isKnownTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ASSISTANT_TOOLS, name);
}
