import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import RolePicker from './RolePicker.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.role.metadata' });
  return { title: t('title') };
}

export default function RolePage() {
  return <RolePicker />;
}
