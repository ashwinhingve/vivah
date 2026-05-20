import type { ReactNode } from 'react';
import Link from 'next/link';
import { UserMenu } from '@/components/ui/UserMenu.client';
import { AppNav } from '@/components/layout/AppNav.client';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-28">
      <header className="border-b border-gold/20 bg-surface px-4 py-3 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="font-bold text-primary text-xl font-heading"
          >
            Smart Shaadi
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground">Complete your profile</span>
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
      <AppNav />
    </div>
  );
}
