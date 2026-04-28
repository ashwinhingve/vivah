import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ShieldCheck } from 'lucide-react';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { SecurityDashboard } from './SecurityDashboard.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account Security — Smart Shaadi' };

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface OverviewResponse {
  account: {
    phoneNumber: string | null;
    phoneNumberVerified: boolean;
    email: string | null;
    emailVerified: boolean;
    memberSince: string;
    deletionRequestedAt: string | null;
  };
  twoFactor: { enabled: boolean };
  sessions: { active: number };
  lastActivity: { type: string; createdAt: string } | null;
}

interface SessionRow {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface EventRow {
  id: string;
  type: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

async function fetchJson<T>(url: string, cookieHeader: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function SecuritySettingsPage() {
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);
  const cookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : '';

  const [overview, sessionsData, eventsData] = await Promise.all([
    fetchJson<OverviewResponse>(`${API_URL}/api/v1/me/security/overview`, cookieHeader),
    fetchJson<{ sessions: SessionRow[] }>(`${API_URL}/api/v1/me/sessions`, cookieHeader),
    fetchJson<{ events: EventRow[] }>(`${API_URL}/api/v1/me/security/events?limit=20`, cookieHeader),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">Account &amp; Security</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage devices, two-factor authentication, account recovery, and your sign-in history.
            </p>
          </div>
        </header>

        <SecurityDashboard
          overview={overview}
          sessions={sessionsData?.sessions ?? []}
          events={eventsData?.events ?? []}
        />
      </div>
    </main>
  );
}
