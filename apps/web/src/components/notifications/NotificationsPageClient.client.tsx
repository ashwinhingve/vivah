'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Trash2 } from 'lucide-react';
import { notificationMeta, type NotificationCategory } from '@smartshaadi/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/notifications/NotificationsProvider.client';
import { NotificationItem } from './NotificationItem.client';
import { rowCategory, timeBucket, type TimeBucket } from './notification-ui';

const BUCKETS: TimeBucket[] = ['Today', 'Yesterday', 'Earlier'];
type Filter = 'ALL' | 'UNREAD' | NotificationCategory;

export function NotificationsPageClient() {
  const { items, unreadCount, markRead, markUnread, markAllRead, remove, clearAll } = useNotifications();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<NotificationCategory>();
    for (const n of items) set.add(rowCategory(n));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    if (filter === 'UNREAD') return items.filter((n) => !n.read);
    return items.filter((n) => rowCategory(n) === filter);
  }, [items, filter]);

  const grouped = useMemo(() => {
    const ref = now || Date.now();
    const g: Record<TimeBucket, typeof items> = { Today: [], Yesterday: [], Earlier: [] };
    for (const n of filtered) g[timeBucket(n.createdAt, ref)].push(n);
    return g;
  }, [filtered, now]);

  const tabs: Array<{ key: Filter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'UNREAD', label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
    ...categories.map((c) => ({ key: c as Filter, label: notificationMeta[c].label })),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-primary">Notifications</h1>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCheck className="h-4 w-4" /> <span className="hidden sm:inline">Mark all read</span>
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Clear all</span>
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter notifications">
        {tabs.map((t) => (
          <button
            key={String(t.key)}
            type="button"
            role="tab"
            aria-selected={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'inline-flex min-h-[44px] items-center rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === t.key
                ? 'bg-primary text-white'
                : 'border border-border bg-surface text-muted-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState variant="no-notifications" />
      ) : (
        <div className="rounded-2xl border border-gold/20 bg-surface p-2 shadow-card">
          {BUCKETS.filter((b) => grouped[b].length > 0).map((b) => (
            <div key={b} className="mb-2 last:mb-0">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gold-muted">{b}</p>
              {grouped[b].map((n) => (
                <NotificationItem
                  key={n.id}
                  item={n}
                  now={now || Date.now()}
                  onOpen={markRead}
                  onToggle={(id, read) => (read ? markUnread(id) : markRead(id))}
                  onRemove={remove}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
