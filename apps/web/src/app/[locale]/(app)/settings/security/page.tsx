import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
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
  const t = await getTranslations('settings');
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);
  const cookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : '';

  const [overview, sessionsData, eventsData] = await Promise.all([
    fetchJson<OverviewResponse>(`${API_URL}/api/v1/me/security/overview`, cookieHeader),
    fetchJson<{ sessions: SessionRow[] }>(`${API_URL}/api/v1/me/sessions`, cookieHeader),
    fetchJson<{ events: EventRow[] }>(`${API_URL}/api/v1/me/security/events?limit=20`, cookieHeader),
  ]);

  return (
    <PageTransition>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
          <FadeUp>
            <PageHeader
              title={t('security')}
              subtitle={t('securityDesc')}
            />
          </FadeUp>

          <FadeUp delay={0.1}>
            <SecurityDashboard
              overview={overview}
              sessions={sessionsData?.sessions ?? []}
              events={eventsData?.events ?? []}
            />
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
