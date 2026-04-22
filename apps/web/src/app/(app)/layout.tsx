import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserMenu } from '@/components/ui/UserMenu.client';
import { AppNav } from '@/components/layout/AppNav.client';
import { CartButton } from '@/components/store/CartButton.client';
import { RoleSwitcher } from '@/components/dev/RoleSwitcher.client';
import { CreateMatchButton } from '@/components/dev/CreateMatchButton.client';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) redirect('/login');

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-gold/20 bg-surface/90 backdrop-blur-sm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-bold text-primary text-lg font-heading"
          >
            Smart Shaadi
          </Link>
          <div className="flex items-center gap-3">
            {process.env.NODE_ENV === 'development' && (
              <>
                <CreateMatchButton />
                <RoleSwitcher />
              </>
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
