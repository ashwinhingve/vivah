'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { streamAssistantChat, type AssistantSSEEvent } from '@/lib/assistant-api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function AssistantChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setError(null);
    setDraft('');

    const userMsg: ChatMessage = { id: newId(), role: 'user', content: text };
    const assistantId = newId();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      for await (const event of streamAssistantChat({ message: text, conversationId })) {
        applyEvent(event, assistantId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setStreaming(false);
    }
  }, [draft, streaming, conversationId]);

  function applyEvent(event: AssistantSSEEvent, assistantId: string) {
    if (event.type === 'delta') {
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, content: m.content + event.content } : m)),
      );
    } else if (event.type === 'done') {
      setConversationId(event.conversation_id);
    }
  }

  return (
    <div className={`flex flex-col h-full ${compact ? '' : 'max-w-2xl mx-auto'}`}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            Hi! Pucho kuch — top matches, profile tips, ya next steps about your journey on Smart Shaadi.
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-xl bg-primary text-white px-4 py-2 text-sm'
                : 'mr-auto max-w-[85%] rounded-xl bg-surface border border-gold/20 text-foreground px-4 py-2 text-sm shadow-card'
            }
          >
            {m.content || (m.role === 'assistant' && streaming ? (
              <span className="text-muted-foreground italic">…</span>
            ) : null)}
          </div>
        ))}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <form
        className="border-t border-gold/20 bg-surface px-3 py-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Ask the assistant…"
          disabled={streaming}
          aria-label="Message"
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={streaming || !draft.trim()}
          aria-label="Send message"
          className="min-h-[44px] min-w-[44px]"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
