import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { mutateApi } from '@/lib/wedding-api';

interface PageProps { params: Promise<{ token: string }> }

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params;
  const res = await mutateApi<{ weddingId: string; role: string }>(`/api/v1/weddings/invites/accept`, {
    method: 'POST',
    body: { token },
  });

  if (res.ok && res.data) {
    return await redirect(`/weddings/${res.data.weddingId}?welcome=1`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-surface border border-gold/20 rounded-xl shadow-card p-8 max-w-md text-center">
        <h1 className="font-heading text-xl text-primary mb-2">Invite link issue</h1>
        <p className="text-sm text-muted-foreground">{res.error ?? 'This invite is invalid, expired, or for a different account.'}</p>
        <Link href="/dashboard" className="inline-block mt-4 text-sm text-teal hover:underline">Go to dashboard</Link>
      </div>
    </div>
  );
}
