import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import RegisterForm from './RegisterForm.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.register.metadata' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: { canonical: '/register' },
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
