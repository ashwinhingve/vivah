import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LoginForm from './LoginForm.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.login.metadata' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: { canonical: '/login' },
  };
}

export default function LoginPage() {
  return <LoginForm />;
}
