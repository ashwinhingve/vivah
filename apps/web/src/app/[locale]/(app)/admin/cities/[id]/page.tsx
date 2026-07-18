import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { CityDetail } from './CityDetail.client';
import type { CityDensityReport } from '@smartshaadi/types';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminCities.cityDetail' });
  return { title: t('heading') };
}

export default async function CityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: cityId } = await params;
  const t = await getTranslations('adminCities.cityDetail');

  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me?.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const density = await fetchAuth<CityDensityReport>(`/api/v1/admin/cities/${cityId}/density`);
  if (!density) {
    return notFound();
  }

  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/cities"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToNetwork')}
        </Link>

        <PageHeader
          title={density.city.name}
          subtitle={density.city.state}
        />

        <div className="mt-6">
          <CityDetail density={density} />
        </div>
      </div>
    </PageTransition>
  );
}
