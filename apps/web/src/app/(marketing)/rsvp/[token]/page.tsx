import { notFound } from 'next/navigation';
import { fetchPublicRsvp } from '@/lib/wedding-api';
import { RsvpForm } from './RsvpForm.client';

interface PageProps { params: Promise<{ token: string }> }

function fmtDate(iso: string | null): string {
  if (!iso) return 'TBA';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function PublicRsvpPage({ params }: PageProps) {
  const { token } = await params;
  const view = await fetchPublicRsvp(token);
  if (!view) notFound();

  const { wedding, ceremonies, guest } = view;
  const accentColor = wedding.primaryColor ?? 'var(--color-primary)';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold mb-3">You are invited</p>
          <h1 className="font-heading text-4xl mb-2" style={{ color: accentColor }}>
            {wedding.brideName && wedding.groomName
              ? <>{wedding.brideName} <span className="opacity-60">&</span> {wedding.groomName}</>
              : wedding.title ?? 'Our Wedding'}
          </h1>
          <p className="text-sm text-muted-foreground">{fmtDate(wedding.weddingDate)}</p>
          {wedding.venueName && <p className="text-sm text-muted-foreground">{wedding.venueName}{wedding.venueCity ? ` · ${wedding.venueCity}` : ''}</p>}
        </div>

        {/* Ceremonies card */}
        {ceremonies.length > 0 && (
          <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-semibold mb-3" style={{ color: accentColor }}>Schedule</h2>
            <ul className="divide-y divide-[#C5A47E]/10">
              {ceremonies.map((c, idx) => (
                <li key={idx} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{c.type}</p>
                    {c.dressCode && <p className="text-xs text-muted-foreground">Dress: {c.dressCode}</p>}
                    {c.venue && <p className="text-xs text-muted-foreground">{c.venue}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBA'}
                    {c.startTime && ` · ${c.startTime}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RSVP form */}
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-1" style={{ color: accentColor }}>Hello, {guest.name}!</h2>
          <p className="text-sm text-muted-foreground mb-5">Please RSVP below — we can&apos;t wait to celebrate with you.</p>
          <RsvpForm token={token} view={view} />
        </div>
      </div>
    </div>
  );
}
