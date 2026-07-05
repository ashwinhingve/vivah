import { fetchActivity } from '@/lib/wedding-api';
import { EmptyState } from '@/components/ui/EmptyState';

const ACTION_LABEL: Record<string, string> = {
  'guest.add':                  'added a guest',
  'guest.update':               'updated a guest',
  'guest.delete':               'removed a guest',
  'guest.bulkImport':           'bulk-imported guests',
  'guest.checkIn':              'checked in a guest',
  'guest.checkOut':             'reverted a check-in',
  'guest.address.upsert':       'updated a guest address',
  'guest.ceremonyPrefs.upsert': 'updated ceremony prefs',
  'rsvpQuestion.add':           'added an RSVP question',
  'rsvpQuestion.update':        'updated an RSVP question',
  'rsvpQuestion.delete':        'deleted an RSVP question',
  'rsvpDeadline.upsert':        'set the RSVP deadline',
  'rsvp.public.submit':         'a guest submitted RSVP',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export async function ActivityFeed({ weddingId, limit = 20 }: { weddingId: string; limit?: number }) {
  const data = await fetchActivity(weddingId, limit);
  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-gold/25 bg-surface shadow-card">
        <EmptyState
          variant="no-tasks"
          title="No activity yet"
          description="Changes you and your collaborators make will show up here."
          className="py-10"
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/25 bg-surface p-5 shadow-card">
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-gold/20 before:content-['']">
        {entries.map((e) => {
          const label = ACTION_LABEL[e.action] ?? e.action;
          const initials = (e.actorName ?? 'S').slice(0, 1).toUpperCase();
          return (
            <li key={e.id} className="relative flex gap-3">
              <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal ring-2 ring-surface">
                {initials}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{e.actorName ?? 'Someone'}</span>{' '}
                  <span className="text-muted-foreground">{label}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
