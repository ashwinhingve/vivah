/**
 * Client helper for streaming the Matrimony AI Assistant chat.
 *
 * Posts to /api/v1/assistant/chat and yields each parsed SSE event from
 * the server. The Express handler proxies SSE bytes from the ai-service
 * unchanged, so the wire format is `data: {...}\n\n` lines.
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export type AssistantSSEEvent =
  | { type: 'context'; context: Record<string, unknown> }
  | { type: 'delta';   content: string }
  | { type: 'done';    conversation_id: string };

export interface AssistantStreamInput {
  message: string;
  conversationId: string | null;
}

export class AssistantError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export async function* streamAssistantChat(
  { message, conversationId }: AssistantStreamInput,
): AsyncGenerator<AssistantSSEEvent> {
  const res = await fetch(`${API_BASE}/api/v1/assistant/chat`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id: conversationId }),
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
