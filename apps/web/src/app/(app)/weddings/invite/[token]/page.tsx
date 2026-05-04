import { redirect } from 'next/navigation';
import { mutateApi } from '@/lib/wedding-api';

interface PageProps { params: Promise<{ token: string }> }

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params;
  const res = await mutateApi<{ weddingId: string; role: string }>(`/api/v1/weddings/invites/accept`, {
    method: 'POST',
    body: { token },
  });

  if (res.ok && res.data) {
    redirect(`/weddings/${res.data.weddingId}?welcome=1`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-8 max-w-md text-center">
        <h1 className="font-heading text-xl text-primary mb-2">Invite link issue</h1>
        <p className="text-sm text-muted-foreground">{res.error ?? 'This invite is invalid, expired, or for a different account.'}</p>
        <a href="/dashboard" className="inline-block mt-4 text-sm text-teal hover:underline">Go to dashboard</a>
      </div>
    </div>
  );
}
