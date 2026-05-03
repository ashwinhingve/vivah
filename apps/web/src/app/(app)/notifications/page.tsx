import { headers } from 'next/headers';
import Link from 'next/link';

interface NotificationRow {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  read:      boolean;
  data:      Record<string, unknown> | null;
  createdAt: string;
}

async function fetchNotifications(): Promise<NotificationRow[]> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  try {
    const res = await fetch(`${apiBase}/api/v1/users/me/notifications?limit=50`, {
      cache: 'no-store',
      headers: { cookie },
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { items?: NotificationRow[] } };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  NEW_MATCH:           '💞',
  MATCH_ACCEPTED:      '✨',
  MATCH_DECLINED:      '🚫',
  NEW_MESSAGE:         '💬',
  BOOKING_CONFIRMED:   '✅',
  BOOKING_CANCELLED:   '❌',
  PAYMENT_RECEIVED:    '💳',
  PAYMENT_FAILED:      '⚠️',
  ESCROW_RELEASED:     '🔓',
  RSVP_RECEIVED:       '🎉',
  TASK_DUE:            '📋',
  REFUND_REQUESTED:    '↩️',
  REFUND_PROCESSED:    '✅',
  PAYOUT_INITIATED:    '🏦',
  INVOICE_AVAILABLE:   '🧾',
  WALLET_CREDITED:     '💰',
  WALLET_DEBITED:      '💸',
  SYSTEM:              '🔔',
};

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const items = await fetchNotifications();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Notifications</h1>
        <Link href="/settings/notifications" className="text-sm text-teal hover:underline">Settings</Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No notifications yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(n => {
            const cta = (n.data?.['ctaUrl'] ?? n.data?.['matchUrl'] ?? n.data?.['receiptUrl']) as string | undefined;
            const Wrapper = ({ children }: { children: React.ReactNode }) =>
              cta ? <Link href={cta} className="block">{children}</Link> : <div>{children}</div>;
            return (
              <li key={n.id}>
                <Wrapper>
                  <article className={`rounded-xl border p-4 transition-colors ${
                    n.read ? 'border-border bg-surface' : 'border-teal/30 bg-teal/5'
                  } hover:bg-secondary`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0" aria-hidden>{TYPE_ICON[n.type] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h2 className="font-semibold text-primary truncate">{n.title}</h2>
                          <span className="text-xs text-muted-foreground shrink-0">{formatAge(n.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-foreground line-clamp-2">{n.body}</p>
                      </div>
                    </div>
                  </article>
                </Wrapper>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
