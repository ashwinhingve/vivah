import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DocumentsClient } from './DocumentsClient.client';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const ESIGN_LIVE = process.env['NEXT_PUBLIC_ESIGN_LIVE'] === 'true';

interface Contract {
  id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID';
  provider: 'DIGILOCKER' | 'SIGNZY' | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

async function fetchContracts(): Promise<Contract[]> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/documents`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data?: { contracts?: Contract[] } };
    return json.data?.contracts ?? [];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';

interface DocumentsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'documents.list.metadata' });
  return { title: t('title') };
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { locale } = await params;
  const t = await getTranslations('documents.list');

  const contracts = await fetchContracts();
  const isMockEsign = !ESIGN_LIVE;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />

          {/* Content */}
          <DocumentsClient initialContracts={contracts} isMockEsign={isMockEsign} />
        </div>
      </div>
    </PageTransition>
  );
}
