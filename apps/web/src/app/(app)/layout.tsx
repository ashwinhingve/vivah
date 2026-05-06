import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserMenu } from '@/components/ui/UserMenu.client';
import { AppNav } from '@/components/layout/AppNav.client';
import { TopNav } from '@/components/layout/TopNav.client';
import { CartButton } from '@/components/store/CartButton.client';
import { RoleSwitcher } from '@/components/dev/RoleSwitcher.client';
import { CreateMatchButton } from '@/components/dev/CreateMatchButton.client';
import { readSessionCookie } from '@/lib/auth/session-cookie';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);
  if (!sessionCookie) redirect('/login');

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-28">
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
            <CartButton />
            <UserMenu />
          </div>
        </div>
      </header>
      {children}
      <AppNav />
    </div>
  );
}
