/**
 * assistantService.ts — Node client for the Python ai-service assistant.
 *
 * Streams Server-Sent Events from POST /ai/assistant/chat. The Python side
 * yields lines like `data: { ... }\n\n`; this client returns the raw
 * ReadableStream chunks so the Express handler can pipe them straight to
 * the browser without buffering.
 */
import { env } from '../lib/env.js';
import type { RagContext } from './assistantContext.js';

interface AppError extends Error {
  code: string;
  status: number;
}

function makeAppError(code: string, message: string, status: number): AppError {
  const e = new Error(message) as AppError;
  e.code = code;
  e.status = status;
  return e;
}

export interface AssistantChatPayload {
  user_id: string;
  profile_id: string;
  message: string;
  conversation_id: string | null;
  context: RagContext;
}

export interface AssistantUpstream {
  body: ReadableStream<Uint8Array>;
}

/**
 * Open a streaming connection to the ai-service. Returns the upstream body
 * stream (UTF-8 SSE bytes). Caller drains it and writes each chunk to the
 * Express response.
 *
 * Throws AppError('AI_SERVICE_UNAVAILABLE') on non-2xx — caller should
 * surface a typed error JSON before any SSE bytes are flushed.
 */
export async function openAssistantStream(
  payload: AssistantChatPayload,
): Promise<AssistantUpstream> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
      'Accept':        'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok || !response.body) {
    throw makeAppError(
      'AI_SERVICE_UNAVAILABLE',
      'Assistant temporarily unavailable',
      503,
    );
  }
  return { body: response.body };
}
