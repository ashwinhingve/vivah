import type { ReactNode } from 'react';
import Link from 'next/link';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <header className="border-b border-[#C5A47E]/20 bg-white px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-bold text-[#7B2D42] text-xl"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Smart Shaadi
          </Link>
          <span className="text-xs text-[#6B6B76]">Complete your profile</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
