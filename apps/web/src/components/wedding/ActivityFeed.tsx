import { fetchActivity } from '@/lib/wedding-api';
import { History } from 'lucide-react';

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
      <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-4 text-center">
        <History className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-4">
      <h3 className="font-medium text-sm text-primary mb-3 flex items-center gap-1.5">
        <History className="h-4 w-4" /> Recent activity
      </h3>
      <ul className="space-y-2">
        {entries.map((e) => {
          const label = ACTION_LABEL[e.action] ?? e.action;
          const initials = (e.actorName ?? 'S').slice(0, 1).toUpperCase();
          return (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="h-7 w-7 rounded-full bg-teal/10 text-teal text-xs font-semibold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{e.actorName ?? 'Someone'}</span>{' '}
                  <span className="text-muted-foreground">{label}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
