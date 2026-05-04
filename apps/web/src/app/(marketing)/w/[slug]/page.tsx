import { notFound } from 'next/navigation';
import Image from 'next/image';
import { fetchPublicWebsite } from '@/lib/wedding-api';
import { ClaimRegistryButton } from './ClaimRegistryButton.client';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ password?: string }>;
}

interface SiteView {
  slug: string;
  title: string;
  story: string | null;
  heroImageUrl: string | null;
  theme: { primary: string; accent: string; font: string } | null;
  passwordProtected: boolean;
  rsvpEnabled: boolean;
  registryEnabled: boolean;
  ceremonies: Array<{ type: string; date: string | null; venue: string | null; startTime: string | null; dressCode: string | null }>;
  galleryUrls: string[];
  registry: Array<{ id: string; label: string; description: string | null; price: number | null; imageUrl: string | null; externalUrl: string | null; status: string; claimedByName: string | null }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'TBA';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function PublicWebsitePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { password } = await searchParams;
  const view = await fetchPublicWebsite(slug, password) as SiteView | null;
  if (!view) notFound();

  const accent = view.theme?.primary ?? 'var(--color-primary)';
  const muted  = view.theme?.accent ?? 'var(--color-gold)';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[320px] flex items-center justify-center overflow-hidden">
        {view.heroImageUrl ? (
          <Image src={view.heroImageUrl} alt="" fill className="object-cover" sizes="100vw" priority />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}33, ${muted}33)` }} />
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative text-center text-white px-6">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: muted }}>Save the date</p>
          <h1 className="font-heading text-5xl md:text-6xl">{view.title}</h1>
        </div>
      </section>

      {/* Story */}
      {view.story && (
        <section className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h2 className="font-heading text-2xl mb-4" style={{ color: accent }}>Our Story</h2>
          <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">{view.story}</p>
        </section>
      )}

      {/* Schedule */}
      {view.ceremonies.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="font-heading text-2xl mb-6 text-center" style={{ color: accent }}>Schedule of Events</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {view.ceremonies.map((c, i) => (
              <div key={i} className="bg-surface border border-gold/20 rounded-xl p-5">
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: muted }}>{c.type}</p>
                <p className="font-semibold">{fmtDate(c.date)}</p>
                {c.startTime && <p className="text-sm text-muted-foreground">{c.startTime}</p>}
                {c.venue && <p className="text-sm text-muted-foreground mt-1">{c.venue}</p>}
                {c.dressCode && <p className="text-xs text-muted-foreground mt-1">Dress: {c.dressCode}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {view.galleryUrls.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="font-heading text-2xl mb-6 text-center" style={{ color: accent }}>Inspiration</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {view.galleryUrls.map((url, i) => (
              <div key={i} className="aspect-square relative rounded-lg overflow-hidden">
                <Image src={url} alt="" fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Registry */}
      {view.registryEnabled && view.registry.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="font-heading text-2xl mb-6 text-center" style={{ color: accent }}>Gift Registry</h2>
          <div className="space-y-3">
            {view.registry.map(r => (
              <div key={r.id} className="bg-surface border border-gold/20 rounded-xl p-4 flex items-center gap-4">
                {r.imageUrl && (
                  <div className="h-16 w-16 relative rounded overflow-hidden shrink-0">
                    <Image src={r.imageUrl} alt="" fill className="object-cover" sizes="64px" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{r.label}</p>
                  {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                  {r.price && <p className="text-sm">₹{r.price.toLocaleString('en-IN')}</p>}
                </div>
                {r.status === 'AVAILABLE' ? (
                  <ClaimRegistryButton itemId={r.id} accent={accent} />
                ) : (
                  <span className="text-xs text-muted-foreground italic">claimed{r.claimedByName ? ` by ${r.claimedByName}` : ''}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RSVP CTA */}
      {view.rsvpEnabled && (
        <section className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h2 className="font-heading text-2xl mb-3" style={{ color: accent }}>Will you join us?</h2>
          <p className="text-sm text-muted-foreground mb-5">Use the personal RSVP link sent to you in the invitation.</p>
        </section>
      )}

      <footer className="text-center text-xs text-muted-foreground py-8">
        With love · Built on Smart Shaadi
      </footer>
    </div>
  );
}
