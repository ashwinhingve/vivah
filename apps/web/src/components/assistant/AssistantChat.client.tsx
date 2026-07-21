'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('assistant');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** Friendly "thinking" line shown while the assistant runs a data tool. */
  const toolActivityLabel = (tool: string): string => {
    const toolKey = tool as keyof typeof toolLabels;
    return toolLabels[toolKey] ?? t('tools.default');
  };

  const toolLabels: Record<string, string> = {
    get_my_profile: t('tools.get_my_profile'),
    get_my_matches: t('tools.get_my_matches'),
    get_pending_requests: t('tools.get_pending_requests'),
    get_who_liked_me: t('tools.get_who_liked_me'),
    get_match_status: t('tools.get_match_status'),
    list_conversations: t('tools.list_conversations'),
    get_unread_count: t('tools.get_unread_count'),
    list_weddings: t('tools.list_weddings'),
    get_wedding_budget: t('tools.get_wedding_budget'),
    get_wedding_tasks: t('tools.get_wedding_tasks'),
    get_wedding_ceremonies: t('tools.get_wedding_ceremonies'),
    suggest_muhurat_dates: t('tools.suggest_muhurat_dates'),
    find_similar_matches: t('tools.find_similar_matches'),
  };

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
      setActivity(null);
    }
  }, [draft, streaming, conversationId]);

  function applyEvent(event: AssistantSSEEvent, assistantId: string) {
    if (event.type === 'delta') {
      setActivity(null); // first answer tokens — stop showing tool activity
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, content: m.content + event.content } : m)),
      );
    } else if (event.type === 'tool_progress') {
      setActivity(toolActivityLabel(event.tool));
    } else if (event.type === 'error') {
      // Genuine live failure surfaced by the ai-service — show it honestly
      // instead of leaving a fabricated/blank answer.
      setActivity(null);
      setError(event.message);
    } else if (event.type === 'done') {
      setActivity(null);
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
            {t('chat.greeting')}
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-xl bg-primary text-white px-4 py-2 text-sm'
                : 'mr-auto max-w-[85%] rounded-2xl bg-surface border border-gold/20 text-foreground px-4 py-2 text-sm shadow-card'
            }
          >
            {m.content || (m.role === 'assistant' && streaming ? (
              <span className="text-muted-foreground italic">…</span>
            ) : null)}
          </div>
        ))}
        {activity && streaming && (
          <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground italic px-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            {activity}
          </div>
        )}
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
          placeholder={t('chat.placeholder')}
          disabled={streaming}
          aria-label={t('chat.messageLabel')}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={streaming || !draft.trim()}
          aria-label={t('chat.sendLabel')}
          className="min-h-[44px] min-w-[44px]"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
