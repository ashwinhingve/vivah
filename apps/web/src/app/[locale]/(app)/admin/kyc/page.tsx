import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { KycQueueTable } from '@/components/admin/KycQueueTable.client';
import { KycStatsBar } from '@/components/admin/KycStatsBar';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe { userId: string; role: string; status: string }

interface KycRow {
  profileId: string; userId: string; verificationStatus: string; verificationLevel: string | null;
  aadhaarVerified: boolean | null; panVerified: boolean | null; bankVerified: boolean | null;
  livenessScore: number | null; faceMatchScore: number | null; riskScore: number | null;
  duplicateFlag: boolean | null; duplicateReason: string | null; sanctionsHit: boolean | null;
  attemptCount: number | null; submittedAt: string | null;
}

interface Stats {
  pending: number; verified: number; rejected: number; infoRequested: number;
  pendingAppeals: number; duplicates: number; sanctions: number;
}

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch { return null; }
}

export default async function AdminKycPage() {
  const t = await getTranslations('adminRole');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const me = await fetchAuth<AuthMe>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN' && me.role !== 'SUPPORT') return await redirect('/dashboard');

  const [queue, stats] = await Promise.all([
    fetchAuth<{ profiles: KycRow[]; total: number }>('/api/v1/admin/kyc/pending', token),
    fetchAuth<Stats>('/api/v1/admin/kyc/stats', token),
  ]);

  const fallbackStats: Stats = {
    pending: 0, verified: 0, rejected: 0, infoRequested: 0, pendingAppeals: 0, duplicates: 0, sanctions: 0,
  };

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.adminConsole')}
        </Link>

        <FadeUp>
          <PageHeader
            title={t('kyc.title')}
            subtitle={t('kyc.subtitle')}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('kyc.breadcrumb') }]}
          />
        </FadeUp>

        <FadeUp>
          <KycStatsBar stats={stats ?? fallbackStats} />
        </FadeUp>

        <FadeUp>
          <div>
            <h2 className="text-base font-semibold text-primary font-heading mb-3">{t('kyc.pendingQueueLabel')}</h2>
            <KycQueueTable initialRows={queue?.profiles ?? []} />
          </div>
        </FadeUp>
      </main>
    </PageTransition>
  );
}
