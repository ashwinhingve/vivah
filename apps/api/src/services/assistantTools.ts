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
import { or, eq, desc, sql, isNotNull, inArray, and, cosineDistance } from 'drizzle-orm';
import { z } from 'zod';
import { matchScores, knowledgeChunks, type KnowledgeSourceType } from '@smartshaadi/db';
import { asProfileId, type ProfileId } from '@smartshaadi/types';
import { db } from '../lib/db.js';
import { callAiService } from '../lib/ai.js';
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

/** Knowledge-base search — default ON; set ASSISTANT_KNOWLEDGE_ENABLED=false to kill-switch. */
function isKnowledgeEnabled(): boolean {
  return (process.env['ASSISTANT_KNOWLEDGE_ENABLED'] ?? 'true').toLowerCase() !== 'false';
}

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

  search_knowledge: tool(
    z
      .object({
        query: z.string().trim().min(2).max(500),
        source_types: z
          .array(z.enum(['i18n_page', 'seo_page', 'vendor', 'faq', 'legal', 'plan_pricing']))
          .max(6)
          .optional(),
        source_id: z.string().trim().max(256).optional(),
      })
      .strip(),
    async ({ query, source_types, source_id }) => {
      // Global public content — deliberately NOT per-user (see knowledgeBase.ts).
      if (!isKnowledgeEnabled()) return { error: 'not_enabled' };

      // Exact-entity lookup: when the caller knows WHICH source it wants (the
      // page-context vendor id, a seo slug), semantic ranking of a UUID query
      // is useless — return that source's chunks directly.
      if (source_id) {
        const filters = [eq(knowledgeChunks.sourceId, source_id)];
        if (source_types?.length) {
          filters.push(inArray(knowledgeChunks.sourceType, source_types as KnowledgeSourceType[]));
        }
        const rows = await db
          .select({
            title: knowledgeChunks.title,
            url: knowledgeChunks.url,
            content: knowledgeChunks.content,
            sourceType: knowledgeChunks.sourceType,
            locale: knowledgeChunks.locale,
            chunkIndex: knowledgeChunks.chunkIndex,
          })
          .from(knowledgeChunks)
          .where(and(...filters))
          .orderBy(knowledgeChunks.chunkIndex)
          .limit(envInt('KNOWLEDGE_MAX_RESULTS', 6));
        return {
          count: rows.length,
          results: rows.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content.length > 600 ? `${r.content.slice(0, 600)}…` : r.content,
            source_type: r.sourceType,
            locale: r.locale,
          })),
        };
      }

      const embRes = await callAiService<{
        embeddings?: number[][];
        available?: boolean;
      }>('/ai/embedding/batch', { texts: [query] });
      const queryVec = embRes.embeddings?.[0];
      if (!embRes.available || !queryVec || queryVec.length !== 768) {
        return { error: 'search_unavailable' };
      }

      const maxResults = envInt('KNOWLEDGE_MAX_RESULTS', 6);
      const minSimilarity = Number.parseFloat(process.env['KNOWLEDGE_MIN_SIMILARITY'] ?? '0.3');
      const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, queryVec)})`;

      const filters = [isNotNull(knowledgeChunks.embedding)];
      if (source_types?.length) {
        filters.push(inArray(knowledgeChunks.sourceType, source_types as KnowledgeSourceType[]));
      }

      const rows = await db
        .select({
          title: knowledgeChunks.title,
          url: knowledgeChunks.url,
          content: knowledgeChunks.content,
          sourceType: knowledgeChunks.sourceType,
          locale: knowledgeChunks.locale,
          similarity,
        })
        .from(knowledgeChunks)
        .where(and(...filters))
        .orderBy(desc(similarity))
        .limit(maxResults);

      const results = rows
        .filter((r) => r.similarity >= minSimilarity)
        .map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content.length > 600 ? `${r.content.slice(0, 600)}…` : r.content,
          source_type: r.sourceType,
          locale: r.locale,
          similarity: Math.round(r.similarity * 100) / 100,
        }));

      return { count: results.length, results };
    },
  ),
};

/** True when the named tool exists in the registry. */
export function isKnownTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ASSISTANT_TOOLS, name);
}
