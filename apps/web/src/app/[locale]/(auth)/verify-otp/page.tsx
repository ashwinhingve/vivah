import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getPlatformSettings } from '@/lib/platform-settings';
import VerifyOtpForm from './VerifyOtpForm.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.verifyOtp.metadata' });
  return { title: t('title') };
}

export default async function VerifyOtpPage() {
  const settings = await getPlatformSettings();
  return (
    <Suspense>
      <VerifyOtpForm isMock={settings.isMockMode} />
    </Suspense>
  );
}
