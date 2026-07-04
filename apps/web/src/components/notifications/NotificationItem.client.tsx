'use client';

import { Check, Undo2, X } from 'lucide-react';
import { notificationMeta, type NotificationRow } from '@smartshaadi/types';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { CATEGORY_ICON, TONE_CLASSES, rowCategory, rowHref, formatAge } from './notification-ui';

interface Props {
  item:     NotificationRow;
  now:      number;
  onOpen:   (id: string) => void;
  onToggle: (id: string, read: boolean) => void;
  onRemove: (id: string) => void;
}

export function NotificationItem({ item, now, onOpen, onToggle, onRemove }: Props) {
  const category = rowCategory(item);
  const href = rowHref(item);
  const Icon = CATEGORY_ICON[category];
  const tone = TONE_CLASSES[notificationMeta[category].tone];
  const age = formatAge(item.createdAt, now);

  const body = (
    <>
      <span
        className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone.bg)}
        aria-hidden="true"
      >
        <Icon className={cn('h-[18px] w-[18px]', tone.text)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-sm', item.read ? 'font-medium text-foreground' : 'font-semibold text-foreground')}>
            {item.title}
          </span>
          {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-teal" aria-label="Unread" />}
        </span>
        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
        <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-gold-muted">
          {notificationMeta[category].label} · {age}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={cn(
        'group relative flex gap-3 rounded-lg px-3 py-2.5 transition-colors',
        item.read ? 'hover:bg-muted/60' : 'bg-teal/5 hover:bg-teal/10',
      )}
    >
      {href ? (
        <Link href={href} onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 gap-3 focus:outline-none">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 gap-3 text-left focus:outline-none">
          {body}
        </button>
      )}

      <div className="flex shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onToggle(item.id, item.read)}
          title={item.read ? 'Mark as unread' : 'Mark as read'}
          aria-label={item.read ? 'Mark as unread' : 'Mark as read'}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.read ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          title="Clear"
          aria-label="Clear notification"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
