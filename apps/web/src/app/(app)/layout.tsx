import type { ReactNode } from 'react';
import Link from 'next/link';
import { UserMenu } from '@/components/ui/UserMenu.client';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <header className="sticky top-0 z-30 border-b border-[#C5A47E]/20 bg-white/90 backdrop-blur-sm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-bold text-[#7B2D42] text-lg font-heading"
          >
            Smart Shaadi
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/requests"
              className="text-xs font-medium text-[#6B6B76] hover:text-[#2E2E38] transition-colors"
            >
              Requests
            </Link>
            <Link
              href="/profile/personal"
              className="text-xs font-medium text-[#0E7C7B] hover:text-[#149998] transition-colors"
            >
              My Profile
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
