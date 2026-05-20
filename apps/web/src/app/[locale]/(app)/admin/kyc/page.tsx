import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KycQueueTable } from '@/components/admin/KycQueueTable.client';
import { KycStatsBar } from '@/components/admin/KycStatsBar';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe { id: string; role: string; status: string }

interface KycRow {
  profileId: string; userId: string; verificationStatus: string; verificationLevel: string | null;
  aadhaarVerified: boolean | null; panVerified: boolean | null; bankVerified: boolean | null;
  livenessScore: number | null; faceMatchScore: number | null; riskScore: number | null;
  duplicateFlag: boolean | null; duplicateReason: string | null; sanctionsHit: boolean | null;
  attemptCount: number | null; submittedAt: string | null;
}

interface Stats {
  pending: number; verified: number; rejected: number; infoRequested: number;
  pendingAppeals: number; duplicates: number; sanctions: number;
}

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch { return null; }
}

export default async function AdminKycPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const me = await fetchAuth<AuthMe>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN' && me.role !== 'SUPPORT') redirect('/dashboard');

  const [queue, stats] = await Promise.all([
    fetchAuth<{ profiles: KycRow[]; total: number }>('/api/v1/admin/kyc/pending', token),
    fetchAuth<Stats>('/api/v1/admin/kyc/stats', token),
  ]);

  const fallbackStats: Stats = {
    pending: 0, verified: 0, rejected: 0, infoRequested: 0, pendingAppeals: 0, duplicates: 0, sanctions: 0,
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Admin
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-primary font-heading">KYC & Identity Console</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review pending verifications, resolve appeals, monitor fraud signals.</p>
        </div>

        <KycStatsBar stats={stats ?? fallbackStats} />

        <div>
          <h2 className="text-base font-semibold text-primary font-heading mb-3">Pending review queue</h2>
          <KycQueueTable initialRows={queue?.profiles ?? []} />
        </div>
      </div>
    </main>
  );
}
