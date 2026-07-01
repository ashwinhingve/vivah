import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Sparkles, ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
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

/**
 * Verification trust badge. One cohesive, honest trust element — rendered only
 * for a genuinely verified profile. A single "Verified Profile" panel reads as a
 * real trust signal; the previous four near-identical pills (all gated on the
 * same boolean) implied per-check verification the data doesn't actually carry.
 */
function VerificationBadge({
  verificationStatus,
  title,
  subtitle,
}: {
  verificationStatus: string;
  title: string;
  subtitle: string;
}) {
  if (verificationStatus !== 'VERIFIED') return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal text-white shadow-sm ring-2 ring-surface">
        <BadgeCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold leading-tight text-primary">{title}</p>
        <p className="text-xs leading-tight text-gold-muted">{subtitle}</p>
      </div>
    </div>
  );
}

/** "Joined N months ago" — coarse since signup date. */
function formatJoinedRelative(createdAt: string | Date): string {
  const ts = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 7) return 'Joined this week';
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `Joined ${w} week${w === 1 ? '' : 's'} ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `Joined ${m} month${m === 1 ? '' : 's'} ago`;
  }
  const y = Math.floor(days / 365);
  return `Joined ${y} year${y === 1 ? '' : 's'} ago`;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; profileId: string }>;
}): Promise<Metadata> {
  const { locale, profileId } = await params;
  const t = await getTranslations({ locale, namespace: 'profileView.metadata' });

  // Personal matrimonial data — NEVER indexable. Photos are presigned R2 URLs
  // that expire, so OG always uses the static brand image, never the photo.
  const base: Metadata = {
    robots: { index: false, follow: false },
    alternates: { canonical: `/profiles/${profileId}` },
  };

  // Reuses the page's cached getProfile fetch (revalidate: 60) — no extra round-trip.
  const profile = await getProfile(profileId);
  if (!profile) {
    return { ...base, title: t('title') };
  }

  const name = profile.personal?.fullName ?? profile.name ?? t('title');
  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;
  const city = profile.location
    ? [profile.location.city, profile.location.state].filter(Boolean).join(', ')
    : '';
  const titleCore = [name, age != null ? String(age) : null].filter(Boolean).join(', ');
  const title = city ? `${titleCore} — ${city}` : titleCore;

  const descParts = [profile.profession?.occupation, profile.education?.degree]
    .filter(Boolean)
    .join(', ');
  const description = descParts ? `${descParts}. ${t('descriptionSuffix')}` : t('descriptionSuffix');

  return {
    ...base,
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'Smart Shaadi',
      locale: locale === 'hi' ? 'hi_IN' : 'en_IN',
      images: ['/og-default.svg'],
    },
  };
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

  const t = await getTranslations('profileDetail');

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
      {/*
        Desktop: 2-col (60%/40%). Mobile: single column. The page is split into
        three grid-placed groups so that on mobile the highest-stakes decision
        aids — Compatibility + detail Tabs (Group B) — surface right after the
        photos + identity hero (Group A), instead of below "similar profiles".
        On desktop, Group B spans both rows of the right column while Group A/C
        stack in the left column, keeping independent column heights.
      */}
      <div id="main-content" className="mx-auto max-w-5xl px-4 pb-28 pt-4">
        {/* Back to feed */}
        <Link
          href="/feed"
          className="mb-3 inline-flex min-h-[44px] items-center gap-1 -ml-1 pr-2 text-sm font-semibold text-teal transition-colors hover:text-teal-hover"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToMatches')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:items-start">

          {/* ── GROUP A (col 1 / row 1): Photos + Identity Hero ──── */}
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">

            {/* Photo gallery — or protected placeholder if empty */}
            <PhotoGallery
              photos={sortedPhotos}
              name={displayName}
              isVerified={profile.verificationStatus === 'VERIFIED'}
            />

            {/* Identity hero card — 2 anchored rows */}
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

              {/* Row 1 — Primary identity (name + age | LastActiveBadge) */}
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-heading text-[24px] sm:text-[32px] font-semibold leading-tight tracking-tight text-primary min-w-0">
                  {displayName}{age != null ? <span className="text-text-muted">, {age}</span> : null}
                </h1>
                <div className="shrink-0">
                  <LastActiveBadge
                    lastActiveAt={profile.lastActiveAt ?? null}
                    showPrecise={showsPreciseLastActive}
                  />
                </div>
              </div>

              {/* Profession · City — Inter 16 Charcoal/80 */}
              {(profile.profession?.occupation || city) && (
                <p className="text-base text-foreground/80">
                  {[profile.profession?.occupation, city].filter(Boolean).join(' · ')}
                </p>
              )}

              {/* Activity strip — joined / member since / view count */}
              <p className="text-[13px] text-muted-foreground">
                {isSelf
                  ? formatJoinedRelative(profile.createdAt)
                  : `Member since ${new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
              </p>

              {/* Verification trust badge (verified profiles only) */}
              <VerificationBadge
                verificationStatus={profile.verificationStatus}
                title={t('verified.title')}
                subtitle={t('verified.subtitle')}
              />

              {/* Status chips row (Manglik / Distance) */}
              {(profile.horoscope?.manglik || (!isSelf && fullScore?.distanceKm != null)) && (
                <div className="flex flex-wrap items-center gap-2">
                  <ManglikChip manglik={profile.horoscope?.manglik ?? null} size="xs" />
                  {!isSelf && fullScore && (
                    <DistancePill distanceKm={fullScore.distanceKm} fallbackCity={null} />
                  )}
                </div>
              )}

              {/* Trait pills */}
              <TraitPills profile={profile} />

              {/* About Me snippet */}
              {profile.aboutMe && (
                <p className="text-sm text-muted-foreground italic leading-relaxed border-t border-border-light pt-3">
                  &ldquo;{profile.aboutMe}&rdquo;
                </p>
              )}
            </div>

            {/* Desktop action bar — directly below hero for above-fold CTA */}
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

            {/* Contact section — self-view only */}
            {isSelf && (
              <ContactSection
                phone={profile.phoneNumber ?? null}
                email={profile.email ?? null}
                isSelf={isSelf}
              />
            )}
          </div>

          {/* ── GROUP B (col 2 / rows 1-2): Compatibility + Tabs ──── */}
          <div className="space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">

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
                  {t('noScore.title')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('noScore.subtitle')}
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

          </div>

          {/* ── GROUP C (col 1 / row 2): Contact notice + Similar ── */}
          {!isSelf && (
            <div className="space-y-4 lg:col-start-1 lg:row-start-2">

              {/* Contact hidden notice */}
              <div className="flex items-center gap-2.5 rounded-xl bg-surface border border-gold/20 px-4 py-3 shadow-card">
                <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t('contactHidden.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('contactHidden.subtitle')}</p>
                </div>
              </div>

              {/* Similar profiles */}
              <SimilarProfiles sourceProfileId={profileId} />
            </div>
          )}
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
