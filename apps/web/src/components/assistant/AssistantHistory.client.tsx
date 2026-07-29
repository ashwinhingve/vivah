'use client';

import { useTranslations } from 'next-intl';
import { Trash2, MessageSquare } from 'lucide-react';
import type { ConversationSummary } from '@/lib/assistant-api';

interface AssistantHistoryProps {
  conversations: ConversationSummary[] | null;
  activeId: string | null;
  /** Id currently awaiting a second tap to confirm deletion. */
  confirmDeleteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Conversation list panel shown inside the assistant sheet. Purely
 * presentational — AssistantChat owns the data and handlers. Delete is
 * two-tap: first tap arms (button turns destructive), second tap deletes.
 */
export function AssistantHistory({
  conversations,
  activeId,
  confirmDeleteId,
  onSelect,
  onDelete,
}: AssistantHistoryProps) {
  const t = useTranslations('assistant.history');

  if (conversations === null) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground text-center">{t('loading')}</div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center space-y-2">
        <MessageSquare className="h-8 w-8 mx-auto text-gold" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gold/10 overflow-y-auto">
      {conversations.map((c) => (
        <li key={c.id} className={c.id === activeId ? 'bg-gold/10' : ''}>
          <div className="flex items-center gap-1 px-3 py-2">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex-1 min-w-0 text-left rounded-lg px-1 py-1.5 hover:bg-gold/10 transition-colors"
            >
              <span className="block text-sm font-medium text-foreground truncate">
                {c.title}
              </span>
              <span className="block text-xs text-muted-foreground truncate">
                {c.preview}
              </span>
              <span className="block text-[11px] text-gold-muted mt-0.5">
                {new Date(c.updated_at).toLocaleDateString()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              aria-label={confirmDeleteId === c.id ? t('confirmDelete') : t('delete')}
              className={`shrink-0 flex items-center justify-center h-11 w-11 rounded-lg transition-colors ${
                confirmDeleteId === c.id
                  ? 'bg-destructive text-white'
                  : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
              }`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
