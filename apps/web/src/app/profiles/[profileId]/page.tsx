import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { CompatibilityDisplay } from '@/components/profile/CompatibilityDisplay';
import { ProfileTabs } from '@/components/profile/ProfileTabs.client';
import { PhotoGallery } from '@/components/profile/PhotoGallery.client';
import { ContactSection } from '@/components/profile/ContactSection';
import type { ProfileDetailResponse } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getProfile(profileId: string): Promise<ProfileDetailResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  try {
    const res = await fetch(`${API_URL}/api/v1/profiles/${profileId}`, {
      headers: token ? { Cookie: `better-auth.session_token=${token}` } : {},
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: ProfileDetailResponse };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

interface Props {
  params: Promise<{ profileId: string }>;
}

export default async function ProfileViewPage({ params }: Props) {
  const { profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) notFound();

  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;
  const primaryPhoto = profile.photos.find((p) => p.isPrimary) ?? profile.photos[0];
  const city =
    profile.location
      ? [profile.location.city, profile.location.state].filter(Boolean).join(', ')
      : '';

  // isSelf: API only exposes phone/email when viewing your own profile
  const isSelf = profile.phoneNumber != null || profile.email != null;

  // Guna score — own horoscope field until Week 3 matching engine provides pairwise score
  const gunaScore = profile.horoscope?.gunaScore ?? 0;

  return (
    <div className="min-h-screen bg-[#FEFAF6] pb-28">
      <div className="mx-auto max-w-lg">

        {/* ── Profile Hero ────────────────────────────────── */}
        <ProfileHero
          name={profile.name}
          age={age ?? 0}
          city={city}
          occupation={profile.profession?.occupation}
          primaryPhotoUrl={primaryPhoto?.url}
          isVerified={profile.verificationStatus === 'VERIFIED'}
          completeness={profile.profileCompleteness}
          premiumTier={profile.premiumTier}
        />

        <div className="px-4 space-y-4 mt-4">

          {/* ── Photo gallery — additional photos strip ─────── */}
          {profile.photos.length > 1 && (
            <PhotoGallery photos={profile.photos} name={profile.name} />
          )}

          {/* ── Compatibility (non-self only, Week 3 will wire real scores) ── */}
          {!isSelf && (
            <CompatibilityDisplay
              gunaScore={gunaScore}
              isLoading={false}
            />
          )}

          {/* ── Safety Mode badge (non-self, contact hidden) ── */}
          {!isSelf && (
            <div className="flex items-center gap-2.5 rounded-xl bg-white border border-[#E8E0D8] px-4 py-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#0E7C7B]/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[#0E7C7B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#2E2E38]">Contact details hidden</p>
                <p className="text-xs text-[#6B6B76]">Visible after mutual interest</p>
              </div>
            </div>
          )}

          {/* ── About Me ──────────────────────────────────── */}
          {profile.aboutMe && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="text-lg font-semibold text-[#7B2D42] mb-2 font-heading">
                About
              </h2>
              <p className="text-sm text-[#6B6B76] italic leading-relaxed">
                &ldquo;{profile.aboutMe}&rdquo;
              </p>
            </div>
          )}

          {/* ── Quick trait pills ─────────────────────────── */}
          {(profile.personal || profile.education) && (
            <div className="flex flex-wrap gap-2">
              {profile.personal?.religion && (
                <span className="rounded-full bg-white border border-[#C5A47E]/50 px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.personal.religion}
                </span>
              )}
              {profile.personal?.caste && (
                <span className="rounded-full bg-white border border-[#C5A47E]/50 px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.personal.caste}
                </span>
              )}
              {profile.personal?.height && (
                <span className="rounded-full bg-white border border-[#C5A47E]/50 px-3 py-1 text-xs text-[#2E2E38]">
                  {(() => {
                    const totalInches = Math.round((profile.personal.height ?? 0) / 2.54);
                    const ft = Math.floor(totalInches / 12);
                    const inches = totalInches % 12;
                    return `${ft}'${inches}"`;
                  })()}
                </span>
              )}
              {profile.education?.degree && (
                <span className="rounded-full bg-white border border-[#C5A47E]/50 px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.education.degree}
                </span>
              )}
              {profile.family?.familyType && (
                <span className="rounded-full bg-white border border-[#C5A47E]/50 px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.family.familyType.replace('_', ' ')} Family
                </span>
              )}
            </div>
          )}

          {/* ── Tabbed Details ─────────────────────────────── */}
          <ProfileTabs
            personal={profile.personal}
            family={profile.family}
            education={profile.education}
            profession={profile.profession}
            lifestyle={profile.lifestyle}
            horoscope={profile.horoscope}
            partnerPreferences={profile.partnerPreferences}
          />

          {/* ── Contact (self-view only) ───────────────────── */}
          {isSelf && (
            <ContactSection
              phone={profile.phoneNumber ?? null}
              email={profile.email ?? null}
              isSelf={isSelf}
            />
          )}

        </div>
      </div>

      {/* ── Sticky Bottom Action Bar (non-self only) ────── */}
      {!isSelf && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E8E0D8] px-4 py-3 shadow-2xl">
          <div className="mx-auto max-w-lg flex items-center gap-3">
            <button
              type="button"
              className="flex-1 bg-[#0E7C7B] hover:bg-[#149998] active:scale-[0.97] text-white font-semibold rounded-lg py-3 text-sm min-h-[48px] transition-colors"
            >
              Send Interest
            </button>
            <button
              type="button"
              aria-label="Bookmark profile"
              className="w-12 h-12 rounded-lg border border-[#E8E0D8] flex items-center justify-center text-[#6B6B76] hover:border-[#C5A47E] hover:text-[#C5A47E] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
