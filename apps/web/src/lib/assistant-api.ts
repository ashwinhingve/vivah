/**
 * Client helper for streaming the Matrimony AI Assistant chat.
 *
 * Posts to /api/v1/assistant/chat and yields each parsed SSE event from
 * the server. The Express handler proxies SSE bytes from the ai-service
 * unchanged, so the wire format is `data: {...}\n\n` lines.
 */

import { API_URL } from '@/lib/api-url';
const API_BASE = API_URL;

export type AssistantSSEEvent =
  | { type: 'context';       context: Record<string, unknown> }
  | { type: 'delta';         content: string }
  | { type: 'tool_progress'; tool: string }
  | { type: 'error';         message: string; recoverable?: boolean }
  | { type: 'done';          conversation_id: string };

import type { AssistantPageContext } from '@/lib/assistant-page-context';

export interface AssistantStreamInput {
  message: string;
  conversationId: string | null;
  pageContext?: AssistantPageContext;
}

export class AssistantError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

// ── Conversation history ─────────────────────────────────────────────────────

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

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
}

async function historyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let code = 'REQUEST_FAILED';
    try {
      const json = (await res.json()) as Envelope<never>;
      code = json.error?.code ?? code;
    } catch {
      // ignore body parse errors — surface the HTTP status code
    }
    throw new AssistantError(code, `Assistant history request failed (${res.status})`);
  }
  const json = (await res.json()) as Envelope<T>;
  return json.data;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const data = await historyFetch<{ conversations: ConversationSummary[] }>(
    '/api/v1/assistant/conversations',
  );
  return data.conversations;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const data = await historyFetch<{ conversation: ConversationDetail }>(
    `/api/v1/assistant/conversations/${id}`,
  );
  return data.conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  await historyFetch<{ deleted: boolean }>(`/api/v1/assistant/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function* streamAssistantChat(
  { message, conversationId, pageContext }: AssistantStreamInput,
): AsyncGenerator<AssistantSSEEvent> {
  const res = await fetch(`${API_BASE}/api/v1/assistant/chat`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      ...(pageContext ? { page_context: pageContext } : {}),
    }),
  });

  if (!res.ok) {
    let code = 'REQUEST_FAILED';
    try {
      const json = (await res.json()) as { error?: { code?: string } };
      code = json.error?.code ?? code;
    } catch {
      // ignore body parse errors — surface the HTTP status code
    }
    throw new AssistantError(code, `Assistant request failed (${res.status})`);
  }

  if (!res.body) {
    throw new AssistantError('NO_STREAM', 'No response stream from assistant');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            yield JSON.parse(payload) as AssistantSSEEvent;
          } catch {
            // skip malformed frames silently
          }
        }
        separator = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
