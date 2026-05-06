import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { CompatibilityDisplay } from '@/components/profile/CompatibilityDisplay';
import { ProfileTabs } from '@/components/profile/ProfileTabs.client';
import { PhotoGallery } from '@/components/profile/PhotoGallery.client';
import { ContactSection } from '@/components/profile/ContactSection';
import { SendInterestButton } from '@/components/matching/SendInterestButton.client';
import type { ProfileDetailResponse, MatchExplainer } from '@smartshaadi/types';
import { getEntitlementsForCurrentUser } from '@/lib/entitlements-server';
import { SimilarProfiles } from '@/components/matchmaking/SimilarProfiles';

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

interface MatchScoreSlice { explainer: MatchExplainer | null; distanceKm: number | null }

async function getMatchScore(profileId: string): Promise<MatchScoreSlice | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/score/${profileId}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data?: { explainer?: MatchExplainer | null; distanceKm?: number | null };
    };
    if (!json.success) return null;
    return {
      explainer: json.data?.explainer ?? null,
      distanceKm: json.data?.distanceKm ?? null,
    };
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
  const [profile, entitlements, matchScore] = await Promise.all([
    getProfile(profileId),
    getEntitlementsForCurrentUser(),
    getMatchScore(profileId),
  ]);
  if (!profile) notFound();

  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;
  const primaryPhoto = profile.photos.find((p) => p.isPrimary) ?? profile.photos[0];
  const city =
    profile.location
      ? [profile.location.city, profile.location.state].filter(Boolean).join(', ')
      : '';

  // isSelf: API only exposes phone/email when viewing your own profile
  const isSelf = profile.phoneNumber != null || profile.email != null;

  // Name: prefer MongoDB personal.fullName — profile.name is the raw phone from OTP signup
  const displayName = profile.personal?.fullName ?? 'Complete your profile';

  // Guna score — only show ring when horoscope data exists
  const hasHoroscope = Boolean(profile.horoscope?.rashi ?? profile.horoscope?.nakshatra);
  const gunaScore = profile.horoscope?.gunaScore ?? null;

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-lg">

        {/* ── Profile Hero ────────────────────────────────── */}
        <ProfileHero
          name={displayName}
          age={age}
          city={city}
          occupation={profile.profession?.occupation}
          primaryPhotoUrl={primaryPhoto?.url}
          isVerified={profile.verificationStatus === 'VERIFIED'}
          completeness={profile.profileCompleteness}
          premiumTier={profile.premiumTier}
          manglik={profile.horoscope?.manglik ?? null}
          lastActiveAt={profile.lastActiveAt ?? null}
          showsPreciseLastActive={isSelf || (entitlements?.entitlements.showsPreciseLastActive ?? false)}
          explainer={isSelf ? null : matchScore?.explainer ?? null}
          distanceKm={isSelf ? null : matchScore?.distanceKm ?? null}
          viewerTier={(entitlements?.tier ?? 'FREE') as 'FREE' | 'STANDARD' | 'PREMIUM'}
        />

        <div className="px-4 space-y-4 mt-4">

          {/* ── Photo gallery — additional photos strip ─────── */}
          {profile.photos.length > 1 && (
            <PhotoGallery photos={profile.photos} name={displayName} />
          )}

          {/* ── Compatibility (non-self only, Week 3 will wire real scores) ── */}
          {!isSelf && hasHoroscope && gunaScore != null && (
            <CompatibilityDisplay
              gunaScore={gunaScore}
              isLoading={false}
            />
          )}
          {!isSelf && !hasHoroscope && (
            <div className="bg-surface rounded-xl shadow-sm border border-border p-5 text-center">
              <p className="text-sm font-medium text-primary font-heading">
                Guna compatibility not available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add horoscope data to see Guna score
              </p>
            </div>
          )}

          {/* ── Safety Mode badge (non-self, contact hidden) ── */}
          {!isSelf && (
            <div className="flex items-center gap-2.5 rounded-xl bg-surface border border-border px-4 py-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Contact details hidden</p>
                <p className="text-xs text-muted-foreground">Visible after mutual interest</p>
              </div>
            </div>
          )}

          {/* ── About Me ──────────────────────────────────── */}
          {profile.aboutMe && (
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
              <h2 className="text-lg font-semibold text-primary mb-2 font-heading">
                About
              </h2>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &ldquo;{profile.aboutMe}&rdquo;
              </p>
            </div>
          )}

          {/* ── Quick trait pills ─────────────────────────── */}
          {(profile.personal || profile.education) && (
            <div className="flex flex-wrap gap-2">
              {profile.personal?.religion && (
                <span className="rounded-full bg-surface border border-gold/50 px-3 py-1 text-xs text-foreground">
                  {profile.personal.religion}
                </span>
              )}
              {profile.personal?.caste && (
                <span className="rounded-full bg-surface border border-gold/50 px-3 py-1 text-xs text-foreground">
                  {profile.personal.caste}
                </span>
              )}
              {profile.personal?.height && (
                <span className="rounded-full bg-surface border border-gold/50 px-3 py-1 text-xs text-foreground">
                  {(() => {
                    const totalInches = Math.round((profile.personal.height ?? 0) / 2.54);
                    const ft = Math.floor(totalInches / 12);
                    const inches = totalInches % 12;
                    return `${ft}'${inches}"`;
                  })()}
                </span>
              )}
              {profile.education?.degree && (
                <span className="rounded-full bg-surface border border-gold/50 px-3 py-1 text-xs text-foreground">
                  {profile.education.degree}
                </span>
              )}
              {profile.family?.familyType && (
                <span className="rounded-full bg-surface border border-gold/50 px-3 py-1 text-xs text-foreground">
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
            kundliUrl={profile.kundliUrl ?? null}
          />

          {/* ── Contact (self-view only) ───────────────────── */}
          {isSelf && (
            <ContactSection
              phone={profile.phoneNumber ?? null}
              email={profile.email ?? null}
              isSelf={isSelf}
            />
          )}

          {/* ── Similar profiles ────────────────────────── */}
          {!isSelf && <SimilarProfiles sourceProfileId={profileId} />}

        </div>
      </div>

      {/* ── Sticky Bottom Action Bar (non-self only) ────── */}
      {!isSelf && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border px-4 py-3 shadow-2xl">
          <div className="mx-auto max-w-lg flex items-center gap-3">
            <SendInterestButton profileId={profileId} />
            <button
              type="button"
              aria-label="Bookmark profile"
              className="w-12 h-12 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:border-gold hover:text-gold transition-colors"
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
