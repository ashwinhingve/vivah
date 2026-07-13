import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { PageHeader } from '@/components/ui/PageHeader';
import { AssistantChat } from '@/components/assistant/AssistantChat.client';

export default async function AssistantPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-12rem)]">
      <PageHeader
        title="Assistant"
        subtitle="Apke matches, profile tips, aur platform questions ka instant guidance."
        className="mb-4"
      />
      <div className="h-full border border-gold/20 rounded-2xl bg-surface shadow-card overflow-hidden">
        <AssistantChat />
      </div>
    </main>
  );
}
