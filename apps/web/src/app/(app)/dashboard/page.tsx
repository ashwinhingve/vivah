import { cookies } from 'next/headers';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import type { ProfileSectionCompletion } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileData {
  profileCompleteness: number;
  sectionCompletion: ProfileSectionCompletion;
  premiumTier: string;
}

async function getProfileData(): Promise<ProfileData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data: ProfileData };
  return json.success ? json.data : null;
}

export default async function DashboardPage() {
  const profile = await getProfileData();
  const completeness = profile?.profileCompleteness ?? 0;
  const sections = profile?.sectionCompletion;
  const tier = profile?.premiumTier ?? 'FREE';

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[#0A1F4D]"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Dashboard
            </h1>
            <p className="text-sm text-[#6B6B76] mt-0.5">Smart Shaadi</p>
          </div>
          {tier !== 'FREE' && (
            <span className="rounded-full bg-[#FFF3E0] text-[#D97706] text-xs font-semibold px-3 py-1 border border-[#FDE68A]">
              {tier}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatsCard
            label="Profile"
            value={`${completeness}%`}
            sub="complete"
            accent={completeness >= 70}
          />
          <StatsCard label="Matches" value="—" sub="coming in Week 3" />
          <StatsCard label="Bookings" value="—" sub="no bookings yet" />
        </div>

        {/* Completeness bar */}
        {sections ? (
          <CompletenessBar sections={sections} />
        ) : (
          <div className="rounded-xl border border-[#E8E0D8] bg-white p-4 text-center">
            <p className="text-sm text-[#6B6B76]">Complete your profile to see your score</p>
            <Link
              href="/profile/create"
              className="mt-3 inline-block bg-[#1848C8] text-white text-sm font-semibold rounded-lg px-5 py-2.5 min-h-[44px] flex items-center justify-center hover:bg-[#1338A8] transition-colors"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {/* Quick actions */}
        <QuickActions />

        {/* Activity feed */}
        <ActivityFeed />
      </div>
    </main>
  );
}
