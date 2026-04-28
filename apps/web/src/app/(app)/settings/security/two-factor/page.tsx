import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ShieldCheck } from 'lucide-react';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { TwoFactorManager } from './TwoFactorManager.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Two-Factor Authentication — Smart Shaadi' };

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Overview {
  twoFactor: { enabled: boolean };
}

async function fetchOverview(cookieHeader: string): Promise<Overview | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/me/security/overview`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: Overview };
    return json.success ? json.data : null;
  } catch { return null; }
}

export default async function TwoFactorPage() {
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);
  const cookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : '';
  const overview = await fetchOverview(cookieHeader);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <header className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">Two-Factor Authentication</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Adds an authenticator-app code on top of your phone OTP. Strongly recommended.
            </p>
          </div>
        </header>

        <TwoFactorManager initialEnabled={overview?.twoFactor.enabled ?? false} />

        <a
          href="/settings/security"
          className="inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to Security
        </a>
      </div>
    </main>
  );
}
