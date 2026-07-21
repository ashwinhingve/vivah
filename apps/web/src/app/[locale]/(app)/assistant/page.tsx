import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { PageHeader } from '@/components/ui/PageHeader';
import { AssistantChat } from '@/components/assistant/AssistantChat.client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'assistant.metadata' });
  return { title: t('title') };
}

export default async function AssistantPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const t = await getTranslations('assistant.page');

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-12rem)]">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        className="mb-4"
      />
      <div className="h-full border border-gold/20 rounded-2xl bg-surface shadow-card overflow-hidden">
        <AssistantChat />
      </div>
    </main>
  );
}
