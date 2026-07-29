/**
 * Assistant conversation history — list / load / delete.
 *
 * Documents are WRITTEN by the ai-service (persist_turn); this service is the
 * read side behind GET/DELETE /api/v1/assistant/conversations*. Every query
 * filters by user_id (ownership — a conversation id from another user 404s).
 *
 * Mock-guarded per CLAUDE.md rule 11: in mock mode (no Mongo connection) all
 * functions return empty results instead of letting Mongoose buffer for 10s.
 *
 * Titles are derived, not stored: first user message, truncated. Keeps the
 * Python writer untouched.
 */
import { shouldUseMockMongo } from '../lib/env.js';
import { AssistantConversation } from '../infrastructure/mongo/models/AssistantConversation.js';

const TITLE_MAX_CHARS = 60;
const PREVIEW_MAX_CHARS = 100;
const LIST_LIMIT = 50;

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
}

interface ConversationDoc {
  conversation_id: string;
  user_id: string;
  profile_id: string;
  messages: StoredMessage[];
  created_at: Date;
  updated_at: Date;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  message_count: number;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>;
  created_at: string;
  updated_at: string;
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  return firstUser ? truncate(firstUser.content, TITLE_MAX_CHARS) : 'Conversation';
}

type LeanQuery<T> = { lean: () => Promise<T> };
interface ConversationModel {
  find: (filter: object, projection?: object, opts?: object) => {
    sort: (s: object) => { limit: (n: number) => LeanQuery<ConversationDoc[]> };
  };
  findOne: (filter: object) => LeanQuery<ConversationDoc | null>;
  deleteOne: (filter: object) => Promise<{ deletedCount?: number }>;
}

const model = AssistantConversation as unknown as ConversationModel;

/** Newest-first summaries of the user's assistant conversations. */
export async function listAssistantConversations(userId: string): Promise<ConversationSummary[]> {
  if (shouldUseMockMongo) return [];
  const docs = await model
    .find({ user_id: userId })
    .sort({ updated_at: -1 })
    .limit(LIST_LIMIT)
    .lean();

  return docs.map((doc) => {
    const last = doc.messages[doc.messages.length - 1];
    return {
      id: doc.conversation_id,
      title: deriveTitle(doc.messages),
      preview: last ? truncate(last.content, PREVIEW_MAX_CHARS) : '',
      message_count: doc.messages.length,
      updated_at: new Date(doc.updated_at).toISOString(),
    };
  });
}

/** Full message history for one conversation — ownership enforced via user_id. */
export async function getAssistantConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  if (shouldUseMockMongo) return null;
  const doc = await model
    .findOne({ conversation_id: conversationId, user_id: userId })
    .lean();
  if (!doc) return null;

  return {
    id: doc.conversation_id,
    title: deriveTitle(doc.messages),
    messages: doc.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ts: new Date(m.ts).toISOString(),
    })),
    created_at: new Date(doc.created_at).toISOString(),
    updated_at: new Date(doc.updated_at).toISOString(),
  };
}

/** Delete one conversation — ownership enforced via user_id. */
export async function deleteAssistantConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  if (shouldUseMockMongo) return false;
  const result = await model.deleteOne({ conversation_id: conversationId, user_id: userId });
  return (result.deletedCount ?? 0) > 0;
}
