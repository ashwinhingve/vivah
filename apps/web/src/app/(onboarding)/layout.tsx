import type { ReactNode } from 'react';
import Link from 'next/link';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gold/20 bg-surface px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-bold text-primary text-xl font-heading"
          >
            Smart Shaadi
          </Link>
          <span className="text-xs text-muted-foreground">Complete your profile</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
