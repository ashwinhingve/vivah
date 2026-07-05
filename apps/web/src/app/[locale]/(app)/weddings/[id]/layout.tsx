import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingSummary } from '@smartshaadi/types';
import { WeddingSidebar } from '@/components/wedding/WeddingSidebar.client';

const STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Planning',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * Shared wedding shell: a persistent section nav (desktop left rail / mobile
 * segmented tabs) wrapping the dashboard and every sub-page. The summary fetch
 * is deduped with the page's identical request within the same render.
 */
export default async function WeddingLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const wedding = await fetchAuth<WeddingSummary>(`/api/v1/weddings/${id}`);
  if (!wedding) notFound();

  const name = wedding.weddingName ?? wedding.venueName ?? 'Wedding plan';

  return (
    <div className="lg:mx-auto lg:flex lg:max-w-6xl lg:gap-6 lg:px-4 lg:py-6">
      <WeddingSidebar
        id={id}
        weddingName={name}
        status={wedding.status}
        statusLabel={STATUS_LABELS[wedding.status] ?? wedding.status}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
