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
  aadhaarVerified: boolean | null;
  duplicateFlag: boolean | null;
  duplicateReason: string | null;
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

  // Role guard — redirect non-admins
  const me = await fetchAuth<AuthMe>('/api/auth/me', token);
  if (!me || me.role !== 'ADMIN') {
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
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">Admin Dashboard</h1>
          <p className="text-sm text-[#6B6B76] mt-0.5">Platform overview and moderation</p>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Total Users</p>
            <p className="text-2xl font-bold font-heading text-[#0E7C7B]">{totalUsers}</p>
            <p className="text-xs text-[#6B6B76]">registered</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Pending KYC</p>
            <p className="text-2xl font-bold font-heading text-[#D97706]">{kycQueue.length}</p>
            <p className="text-xs text-[#6B6B76]">need review</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Active Vendors</p>
            <p className="text-2xl font-bold font-heading text-[#0E7C7B]">{activeVendors}</p>
            <p className="text-xs text-[#6B6B76]">on platform</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Bookings</p>
            <p className="text-2xl font-bold font-heading text-[#0E7C7B]">{bookingsThisMonth}</p>
            <p className="text-xs text-[#6B6B76]">this month</p>
          </div>
        </div>

        {/* KYC pending queue */}
        <div>
          <h2 className="text-lg font-semibold text-[#7B2D42] font-heading mb-3">
            KYC Pending Review
            {kycQueue.length > 0 && (
              <span className="ml-2 text-xs font-semibold text-[#D97706] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {kycQueue.length}
              </span>
            )}
          </h2>
          <KycQueueTable initialRows={kycQueue} />
        </div>

        {/* Recent audit logs placeholder */}
        <div>
          <h2 className="text-lg font-semibold text-[#7B2D42] font-heading mb-3">
            Recent Audit Logs
          </h2>
          <div className="rounded-xl border border-[#C5A47E]/30 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E0D8] bg-[#FEFAF6]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide hidden sm:table-cell">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-[#6B6B76]">
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
