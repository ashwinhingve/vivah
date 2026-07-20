import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { PlatformSettingsForm } from './PlatformSettingsForm.client';

export const dynamic = 'force-dynamic';

interface AuthMe { userId: string; role: string; status: string }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRole' });
  return { title: `${t('navTiles.settings.label')} — Admin | Smart Shaadi` };
}

interface PlatformSettingRow {
  key:        string;
  value:      unknown;
  updatedAt:  string;
  updatedBy:  string | null;
}

export default async function AdminPlatformSettingsPage() {
  const t = await getTranslations('adminRole');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    return await redirect('/login');
  }
  // Defense-in-depth: middleware fail-opens if /api/auth/me errors, so re-check
  // the role here and redirect any non-admin off the page.
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const wrapped = await fetchAuth<{ settings: PlatformSettingRow[] }>(
    '/api/v1/admin/platform-settings',
  );
  const settings = wrapped?.settings ?? [];
  const lgbtqRow = settings.find((s) => s.key === 'lgbtq_matching_enabled');
  const lgbtqEnabled = lgbtqRow?.value === true;

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.adminConsole')}
        </Link>

        <FadeUp>
          <PageHeader
            title={t('settings.title')}
            subtitle={t('settings.subtitle')}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('settings.breadcrumb') }]}
          />
        </FadeUp>

        <FadeUp>
          <PlatformSettingsForm
            lgbtqEnabled={lgbtqEnabled}
            lgbtqUpdatedAt={lgbtqRow?.updatedAt ?? null}
          />
        </FadeUp>
      </main>
    </PageTransition>
  );
}
