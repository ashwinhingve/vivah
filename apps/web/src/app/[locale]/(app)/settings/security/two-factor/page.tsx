import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { TwoFactorManager } from './TwoFactorManager.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Two-Factor Authentication — Smart Shaadi' };

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Overview {
  twoFactor: { enabled: boolean };
}

async function fetchOverview(cookieHeader: string): Promise<Overview | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/me/security/overview`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: Overview };
    return json.success ? json.data : null;
  } catch { return null; }
}

export default async function TwoFactorPage() {
  const t = await getTranslations('settings');
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);
  const cookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : '';
  const overview = await fetchOverview(cookieHeader);

  return (
    <PageTransition>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          <FadeUp>
            <PageHeader
              title={t('twoFactor')}
              subtitle={t('twoFactorDesc')}
            />
          </FadeUp>

          <FadeUp delay={0.1}>
            <TwoFactorManager initialEnabled={overview?.twoFactor.enabled ?? false} />
          </FadeUp>

          <FadeUp delay={0.2}>
            <Link
              href="/settings/security"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('backToSecurity')}
            </Link>
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
