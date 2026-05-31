import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import type { InviteRecord, PublicInviteView } from '@/lib/invites/types';
import { InviteBuilder } from './InviteBuilder.client';

export const metadata: Metadata = { title: 'Digital Invitation — Smart Shaadi' };

interface InvitePreviewResponse {
  invite: InviteRecord | null;
  preview: PublicInviteView | null;
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  const data = await fetchAuth<InvitePreviewResponse>(`/api/v1/weddings/${id}/invite`);
  if (!data || !data.preview) notFound();

  const appBase = process.env['NEXT_PUBLIC_APP_URL'] ?? '';

  return (
    <InviteBuilder
      weddingId={id}
      locale={locale}
      invite={data.invite}
      previewBase={data.preview}
      appBaseUrl={appBase}
    />
  );
}
