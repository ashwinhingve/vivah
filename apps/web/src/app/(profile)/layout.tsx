import type { ReactNode } from 'react';
import Link from 'next/link';
import { UserMenu } from '@/components/ui/UserMenu.client';
import { AppNav } from '@/components/layout/AppNav.client';

export default function ProfileLayout({ children }: { children: ReactNode }) {
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
          <UserMenu />
        </div>
      </header>
      <main className="px-4 py-8 flex flex-col items-center">
        {children}
      </main>
      <AppNav />
    </div>
  );
}
