'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCheck, Trash2 } from 'lucide-react';
import { notificationMeta, type NotificationCategory } from '@smartshaadi/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/notifications/NotificationsProvider.client';
import { NotificationItem } from './NotificationItem.client';
import { rowCategory, timeBucket, TIME_BUCKETS, type TimeBucket } from './notification-ui';

type Filter = 'ALL' | 'UNREAD' | NotificationCategory;

export function NotificationsPageClient() {
  const t = useTranslations('notifications');
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

  const bucketLabel: Record<TimeBucket, string> = {
    today: t('buckets.today'),
    yesterday: t('buckets.yesterday'),
    earlier: t('buckets.earlier'),
  };

  const grouped = useMemo(() => {
    const ref = now || Date.now();
    const g: Record<TimeBucket, typeof items> = { today: [], yesterday: [], earlier: [] };
    for (const n of filtered) g[timeBucket(n.createdAt, ref)].push(n);
    return g;
  }, [filtered, now]);

  const tabs: Array<{ key: Filter; label: string }> = [
    { key: 'ALL', label: t('tabs.all') },
    { key: 'UNREAD', label: unreadCount > 0 ? t('tabs.unreadWithCount', { count: unreadCount }) : t('tabs.unread') },
    ...categories.map((c) => ({ key: c as Filter, label: notificationMeta[c].label })),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <PageHeader
        title={t('page.title')}
        actions={
          items.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CheckCheck className="h-4 w-4" /> <span className="hidden sm:inline">{t('actions.markAllRead')}</span>
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">{t('actions.clearAll')}</span>
              </button>
            </div>
          ) : undefined
        }
      />

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
          {TIME_BUCKETS.filter((b) => grouped[b].length > 0).map((b) => (
            <div key={b} className="mb-2 last:mb-0">
              <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-gold-muted">{bucketLabel[b]}</p>
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
