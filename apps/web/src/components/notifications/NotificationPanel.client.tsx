'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/notifications/NotificationsProvider.client';
import { NotificationItem } from './NotificationItem.client';
import { timeBucket, type TimeBucket } from './notification-ui';

const BUCKETS: TimeBucket[] = ['Today', 'Yesterday', 'Earlier'];

/** Shared bell-panel body — used inside the desktop Popover and mobile Sheet. */
export function NotificationPanel({ onClose }: { onClose?: () => void }) {
  const { items, unreadCount, markRead, markUnread, markAllRead, remove, clearAll } = useNotifications();
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const ref = now || Date.now();
    const g: Record<TimeBucket, typeof items> = { Today: [], Yesterday: [], Earlier: [] };
    for (const n of items) g[timeBucket(n.createdAt, ref)].push(n);
    return g;
  }, [items, now]);

  const onOpen = (id: string) => { markRead(id); onClose?.(); };

  return (
    <div className="flex max-h-[70vh] flex-col sm:max-h-[32rem]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-primary">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-teal px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-teal transition-colors hover:bg-teal/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
              <Bell className="h-6 w-6 text-gold-muted" />
            </span>
            <p className="font-medium text-foreground">You&rsquo;re all caught up</p>
            <p className="text-sm text-muted-foreground">New activity will show up here.</p>
          </div>
        ) : (
          BUCKETS.filter((b) => grouped[b].length > 0).map((b) => (
            <div key={b} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gold-muted">{b}</p>
              {grouped[b].map((n) => (
                <NotificationItem
                  key={n.id}
                  item={n}
                  now={now || Date.now()}
                  onOpen={onOpen}
                  onToggle={(id, read) => (read ? markUnread(id) : markRead(id))}
                  onRemove={remove}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border px-2 pt-2">
        <Link
          href="/notifications"
          onClick={onClose}
          className={cn('block rounded-md py-2 text-center text-sm font-medium text-teal transition-colors hover:bg-teal/10')}
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
