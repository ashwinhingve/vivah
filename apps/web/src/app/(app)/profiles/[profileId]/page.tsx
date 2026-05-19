import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { CheckCircle2, Phone, BadgeCheck, Camera, CreditCard, Sparkles } from 'lucide-react';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { PhotoGallery } from '@/components/profile/PhotoGallery.client';
import { ProfileCompatibilityCard } from '@/components/profile/ProfileCompatibilityCard';
import { ProfileDetailTabs } from '@/components/profile/ProfileDetailTabs.client';
import { ProfileActions } from '@/components/profile/ProfileActions.client';
import { ContactSection } from '@/components/profile/ContactSection';
import { ManglikChip } from '@/components/profile/ManglikChip';
import { LastActiveBadge } from '@/components/profile/LastActiveBadge';
import { DistancePill } from '@/components/profile/DistancePill';
import { SimilarProfiles } from '@/components/matchmaking/SimilarProfiles';
import { getEntitlementsForCurrentUser } from '@/lib/entitlements-server';
import type { ProfileDetailResponse, CompatibilityScore, MatchExplainer } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// ─────────────────────────────────────────────────────
//  Data fetchers
// ─────────────────────────────────────────────────────

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

async function getMatchStatusWithProfile(
  profileId: string,
): Promise<{ status: 'none' | 'sent_pending' | 'received_pending' | 'matched'; requestId: string | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return { status: 'none', requestId: null };
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/requests/status/${profileId}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'none', requestId: null };
    const json = (await res.json()) as {
      success: boolean;
      data?: { status: 'none' | 'sent_pending' | 'received_pending' | 'matched'; requestId: string | null };
    };
    return json.success && json.data ? json.data : { status: 'none', requestId: null };
  } catch {
    return { status: 'none', requestId: null };
  }
}

/** Full CompatibilityScore shape from GET /api/v1/matchmaking/score/:profileId */
interface FullMatchScore {
  compatibility: CompatibilityScore;
  explainer: MatchExplainer | null;
  distanceKm: number | null;
}

async function getFullMatchScore(profileId: string): Promise<FullMatchScore | null> {
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
      data?: {
        totalScore?: number;
        breakdown?: CompatibilityScore['breakdown'];
        gunaScore?: number;
        tier?: CompatibilityScore['tier'];
        flags?: string[];
        explainer?: MatchExplainer | null;
        distanceKm?: number | null;
      };
    };
    if (!json.success || !json.data) return null;
    const d = json.data;
    // Require minimum shape to render the card
    if (
      d.totalScore == null ||
      !d.breakdown ||
      d.gunaScore == null ||
      !d.tier
    ) {
      return null;
    }
    return {
      compatibility: {
        totalScore: d.totalScore,
        breakdown: d.breakdown,
        gunaScore: d.gunaScore,
        tier: d.tier,
        flags: d.flags ?? [],
      },
      explainer: d.explainer ?? null,
      distanceKm: d.distanceKm ?? null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

/** Verification trust strip — only renders flags present on verificationStatus */
function VerificationStrip({ verificationStatus }: { verificationStatus: string }) {
  const verified = verificationStatus === 'VERIFIED';

  const checks = [
    {
      key: 'phone',
      icon: Phone,
      label: 'Phone',
      active: verified, // phone is verified as part of OTP onboarding
    },
    {
      key: 'kyc',
      icon: BadgeCheck,
      label: 'KYC',
      active: verified,
    },
    {
      key: 'photo',
      icon: Camera,
      label: 'Photo',
      active: verified,
    },
    {
      key: 'govt',
      icon: CreditCard,
      label: 'Govt ID',
      active: verified,
    },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {checks.map(({ key, icon: Icon, label, active }) => (
        <div
          key={key}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            active
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border-light bg-muted/30 text-muted-foreground'
          }`}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          {label}
          {active && (
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

/** Quick trait pills row */
function TraitPills({ profile }: { profile: ProfileDetailResponse }) {
  const pills: string[] = [];

  if (profile.personal?.religion) pills.push(profile.personal.religion);
  if (profile.personal?.caste) pills.push(profile.personal.caste);
  if (profile.personal?.height != null) {
    const totalInches = Math.round((profile.personal.height) / 2.54);
    const ft = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    pills.push(`${ft}'${inches}"`);
  }
  if (profile.education?.degree) pills.push(profile.education.degree);
  if (profile.family?.familyType) pills.push(`${profile.family.familyType.replace('_', ' ')} Family`);

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <span
          key={pill}
          className="rounded-full bg-surface border border-gold/40 px-3 py-1 text-xs text-foreground"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────

interface Props {
  params: Promise<{ profileId: string }>;
}

export default async function ProfileViewPage({ params }: Props) {
  const { profileId } = await params;
  const [profile, entitlements, fullScore, matchStatus] = await Promise.all([
    getProfile(profileId),
    getEntitlementsForCurrentUser(),
    getFullMatchScore(profileId),
    getMatchStatusWithProfile(profileId),
  ]);

  if (!profile) notFound();

  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;
  const city = profile.location
    ? [profile.location.city, profile.location.state].filter(Boolean).join(', ')
    : '';

  // isSelf: API only exposes phone/email when viewing your own profile
  const isSelf = profile.phoneNumber != null || profile.email != null;

  // Name: prefer MongoDB personal.fullName
  const displayName = profile.personal?.fullName ?? 'Complete your profile';

  // Sort photos by isPrimary then displayOrder
  const sortedPhotos = [...profile.photos].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.displayOrder - b.displayOrder;
  });

  const viewerTier = (entitlements?.tier ?? 'FREE') as 'FREE' | 'STANDARD' | 'PREMIUM';
  const showsPreciseLastActive = isSelf || (entitlements?.entitlements.showsPreciseLastActive ?? false);

  return (
    <PageTransition>
      {/* Desktop: 2-col (60%/40%). Mobile: single column stacked */}
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">

          {/* ── LEFT COLUMN: Photos + Identity Hero ──────────────── */}
          <div className="space-y-4">

            {/* Photo gallery — or protected placeholder if empty */}
            <PhotoGallery
              photos={sortedPhotos}
              name={displayName}
              isVerified={profile.verificationStatus === 'VERIFIED'}
            />

            {/* Identity hero card */}
            <div className="rounded-2xl border border-gold/20 bg-surface shadow-card p-5 space-y-4">
              {/* Premium tier badge */}
              {profile.premiumTier && profile.premiumTier !== 'FREE' && (
                <div className="flex">
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-muted">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {profile.premiumTier}
                  </span>
                </div>
              )}

              {/* Name + age + city */}
              <div>
                <h1 className="font-heading text-3xl font-semibold leading-tight text-primary">
                  {displayName}
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  {age != null ? `${age} yrs` : ''}
                  {age != null && city ? ' · ' : ''}
                  {city}
                  {profile.profession?.occupation
                    ? ` · ${profile.profession.occupation}`
                    : ''}
                </p>
              </div>

              {/* Status chips row */}
              <div className="flex flex-wrap items-center gap-2">
                <ManglikChip manglik={profile.horoscope?.manglik ?? null} size="xs" />
                {!isSelf && fullScore && (
                  <DistancePill distanceKm={fullScore.distanceKm} fallbackCity={null} />
                )}
                <LastActiveBadge
                  lastActiveAt={profile.lastActiveAt ?? null}
                  showPrecise={showsPreciseLastActive}
                />
              </div>

              {/* Trait pills */}
              <TraitPills profile={profile} />

              {/* About Me snippet */}
              {profile.aboutMe && (
                <p className="text-sm text-muted-foreground italic leading-relaxed border-t border-border-light pt-3">
                  &ldquo;{profile.aboutMe}&rdquo;
                </p>
              )}

              {/* Verification trust strip */}
              <div className="border-t border-border-light pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Verification
                </p>
                <VerificationStrip verificationStatus={profile.verificationStatus} />
              </div>
            </div>

            {/* Contact section — self-view only */}
            {isSelf && (
              <ContactSection
                phone={profile.phoneNumber ?? null}
                email={profile.email ?? null}
                isSelf={isSelf}
              />
            )}

            {/* Contact hidden notice (non-self) */}
            {!isSelf && (
              <div className="flex items-center gap-2.5 rounded-xl bg-surface border border-gold/20 px-4 py-3 shadow-card">
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

            {/* Similar profiles — mobile shows inline, desktop only shows under left col */}
            {!isSelf && (
              <div className="lg:block">
                <SimilarProfiles sourceProfileId={profileId} />
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Compatibility + Tabs + Desktop Actions ── */}
          <div className="space-y-4">

            {/* Compatibility card — non-self, when score available */}
            {!isSelf && fullScore && (
              <ProfileCompatibilityCard
                compatibility={fullScore.compatibility}
                explainer={fullScore.explainer}
                viewerTier={viewerTier}
                flags={fullScore.compatibility.flags}
              />
            )}

            {/* No score state (non-self, no data) */}
            {!isSelf && !fullScore && (
              <div className="rounded-2xl border border-gold/20 bg-surface shadow-card p-5 text-center space-y-2">
                <p className="font-heading text-base font-semibold text-primary">
                  Compatibility unavailable
                </p>
                <p className="text-xs text-muted-foreground">
                  Add horoscope data to see full compatibility
                </p>
              </div>
            )}

            {/* Tabbed detail sections */}
            <ProfileDetailTabs
              aboutMe={profile.aboutMe}
              personal={profile.personal}
              family={profile.family}
              education={profile.education}
              profession={profile.profession}
              lifestyle={profile.lifestyle}
              horoscope={profile.horoscope}
              partnerPreferences={profile.partnerPreferences}
              kundliUrl={profile.kundliUrl ?? null}
            />

            {/* Desktop action bar — inline at bottom of right column */}
            {!isSelf && (
              <div className="hidden lg:block">
                <ProfileActions
                  profileId={profileId}
                  displayName={displayName}
                  initialStatus={matchStatus.status}
                  requestId={matchStatus.requestId}
                  sticky={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      {!isSelf && (
        <ProfileActions
          profileId={profileId}
          displayName={displayName}
          initialStatus={matchStatus.status}
          requestId={matchStatus.requestId}
          sticky={true}
        />
      )}
    </PageTransition>
  );
}
