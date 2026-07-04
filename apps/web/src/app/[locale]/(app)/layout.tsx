import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { UserMenu } from '@/components/ui/UserMenu.client';
import { AppNav } from '@/components/layout/AppNav.client';
import { TopNav } from '@/components/layout/TopNav.client';
import { CartButton } from '@/components/store/CartButton.client';
import { LanguageToggle } from '@/components/i18n/LanguageToggle.client';
import { AssistantToggle } from '@/components/assistant/AssistantToggle.client';
import { RoleSwitcher } from '@/components/dev/RoleSwitcher.client';
import { CreateMatchButton } from '@/components/dev/CreateMatchButton.client';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { fetchAuth } from '@/lib/server-fetch';
import { NotificationsProvider } from '@/lib/notifications/NotificationsProvider.client';
import { NotificationBell } from '@/components/notifications/NotificationBell.client';
import type { NotificationRow } from '@smartshaadi/types';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);
  if (!sessionCookie) return await redirect('/login');

  // Seed the realtime notification provider from the server so the bell badge
  // and panel render with data on first paint (then stay live over the socket).
  const initial = (await fetchAuth<{ items: NotificationRow[]; unreadCount: number }>(
    '/api/v1/users/me/notifications?limit=50',
  )) ?? { items: [], unreadCount: 0 };

  return (
    <NotificationsProvider initial={initial}>
    <div className="min-h-screen bg-background pb-24 sm:pb-28 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-gold/20 bg-surface/90 backdrop-blur-sm px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="font-bold text-primary text-base sm:text-lg font-heading truncate"
          >
            Smart Shaadi
          </Link>
          <TopNav />
          <div className="flex items-center gap-1.5 sm:gap-3">
            {process.env.NODE_ENV === 'development' && (
              <div className="hidden md:flex items-center gap-2">
                <CreateMatchButton />
                <RoleSwitcher />
              </div>
            )}
            <LanguageToggle />
            <CartButton />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <div id="main-content">{children}</div>
      <AppNav />
      <AssistantToggle />
    </div>
    </NotificationsProvider>
  );
}
