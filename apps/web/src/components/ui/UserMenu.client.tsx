'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

const ROLE_LABELS: Record<string, string> = {
  INDIVIDUAL:        'Member',
  FAMILY_MEMBER:     'Family',
  VENDOR:            'Vendor',
  EVENT_COORDINATOR: 'Coordinator',
  ADMIN:             'Admin',
  SUPPORT:           'Support',
};

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  async function handleLogout() {
    setLoading(true);
    try {
      await authClient.signOut();
    } catch {
      // ignore network errors — still redirect
    }
    router.push('/login');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
        aria-label="User menu"
      >
        <span className="w-8 h-8 rounded-full bg-[#7B2D42] text-white text-xs font-bold flex items-center justify-center select-none">
          {initials}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl bg-white border border-[#E8E0D8] shadow-lg py-1">
            {user?.name && (
              <div className="px-4 py-2 border-b border-[#E8E0D8]">
                <p className="text-sm font-semibold text-[#2E2E38] truncate">{user.name}</p>
                <span className="inline-block mt-0.5 rounded-full bg-[#0E7C7B]/10 px-2 py-0.5 text-xs font-medium text-[#0E7C7B]">
                  {ROLE_LABELS[role] ?? role}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="w-full text-left px-4 py-2 text-sm text-[#7B2D42] hover:bg-[#FEFAF6] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
