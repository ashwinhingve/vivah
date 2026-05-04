import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { KycQueueTable } from '@/components/admin/KycQueueTable.client';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe {
  id: string;
  role: string;
  status: string;
}

interface AdminStats {
  totalUsers:        number;
  activeVendors:     number;
  bookingsThisMonth: number;
}

interface KycRow {
  profileId: string;
  userId: string;
  verificationStatus: string;
  verificationLevel: string | null;
  aadhaarVerified: boolean | null;
  panVerified: boolean | null;
  bankVerified: boolean | null;
  livenessScore: number | null;
  faceMatchScore: number | null;
  riskScore: number | null;
  duplicateFlag: boolean | null;
  duplicateReason: string | null;
  sanctionsHit: boolean | null;
  attemptCount: number | null;
  submittedAt: string | null;
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
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  // Role guard — middleware already verified ADMIN/SUPPORT; redirect only if
  // /api/auth/me positively identifies a non-admin role (prevents a loop when
  // the API is unreachable and fetchAuth returns null).
  const me = await fetchAuth<AuthMe>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN' && me.role !== 'SUPPORT') {
    redirect('/dashboard');
  }

  const [kycData, stats] = await Promise.all([
    fetchAuth<{ profiles: KycRow[]; total: number }>('/api/v1/admin/kyc/pending', token),
    fetchAuth<AdminStats>('/api/v1/admin/stats', token),
  ]);
  const kycQueue = kycData?.profiles ?? [];
  const totalUsers = stats?.totalUsers ?? 0;
  const activeVendors = stats?.activeVendors ?? 0;
  const bookingsThisMonth = stats?.bookingsThisMonth ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-primary font-heading">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform overview and moderation</p>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Users</p>
            <p className="text-2xl font-bold font-heading text-teal">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">registered</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending KYC</p>
            <p className="text-2xl font-bold font-heading text-warning">{kycQueue.length}</p>
            <p className="text-xs text-muted-foreground">need review</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Vendors</p>
            <p className="text-2xl font-bold font-heading text-teal">{activeVendors}</p>
            <p className="text-xs text-muted-foreground">on platform</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bookings</p>
            <p className="text-2xl font-bold font-heading text-teal">{bookingsThisMonth}</p>
            <p className="text-xs text-muted-foreground">this month</p>
          </div>
        </div>

        {/* KYC pending queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary font-heading">
              KYC Pending Review
              {kycQueue.length > 0 && (
                <span className="ml-2 text-xs font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/30">
                  {kycQueue.length}
                </span>
              )}
            </h2>
            <Link href="/admin/kyc" className="text-xs font-semibold text-teal hover:text-teal-hover">
              Open full KYC console →
            </Link>
          </div>
          <KycQueueTable initialRows={kycQueue} />
        </div>

        {/* Recent audit logs placeholder */}
        <div>
          <h2 className="text-lg font-semibold text-primary font-heading mb-3">
            Recent Audit Logs
          </h2>
          <div className="rounded-xl border border-gold/30 bg-surface overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide hidden sm:table-cell">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Audit log endpoint coming in Phase 2 — Week 6
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
