import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { AssistantChat } from '@/components/assistant/AssistantChat.client';

export default async function AssistantPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) redirect('/login');

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-12rem)]">
      <header className="mb-4">
        <h1 className="text-xl sm:text-2xl font-heading text-primary">Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Apke matches, profile tips, aur platform questions ka instant guidance.
        </p>
      </header>
      <div className="h-full border border-gold/20 rounded-xl bg-surface shadow-card overflow-hidden">
        <AssistantChat />
      </div>
    </main>
  );
}
