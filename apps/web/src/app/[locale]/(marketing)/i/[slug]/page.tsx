import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InviteCard } from '@/components/invite/InviteCard';
import type { PublicInviteView } from '@/lib/invites/types';
import { RsvpForm } from './RsvpForm.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchInvite(slug: string): Promise<PublicInviteView | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/invites/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as PublicInviteView;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await fetchInvite(slug);
  if (!view) return { title: 'Invitation — Smart Shaadi' };
  const couple =
    view.brideName && view.groomName
      ? `${view.brideName} & ${view.groomName}`
      : (view.title ?? 'Our Wedding');
  const description = view.message ?? `You are invited to celebrate with ${couple}.`;
  return {
    title: `${couple} — You're Invited`,
    description,
    openGraph: {
      title: `${couple} — You're Invited`,
      description,
      type: 'website',
      ...(view.assetUrl ? { images: [{ url: view.assetUrl }] } : {}),
    },
  };
}

export default async function PublicInvitePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const view = await fetchInvite(slug);
  if (!view) notFound();

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <InviteCard view={view} />

        {view.assetUrl && (
          <div className="text-center">
            <a
              href={view.assetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-lg border border-gold px-5 text-sm text-primary"
            >
              Download invitation (PDF)
            </a>
          </div>
        )}

        {view.rsvpEnabled ? (
          <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
            <h2 className="font-heading text-xl text-primary mb-1 text-center">RSVP</h2>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Kindly let the couple know if you can make it.
            </p>
            <RsvpForm slug={slug} apiBase={API_BASE} />
          </section>
        ) : (
          <p className="text-center text-sm text-muted-foreground">RSVP is currently closed.</p>
        )}
      </div>
    </main>
  );
}
