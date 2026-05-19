'use client';

/**
 * MatchProfileDrawer — right-side quick-view Sheet for a discovery feed profile.
 *
 * Fetches GET /api/v1/profiles/:profileId with credentials:'include' on open.
 * Composes existing profile/* primitives (ProfileHero, ProfileInfoGrid,
 * WhyMatchPanel) for a rich preview without navigating away.
 *
 * Quick-view is standalone — no data dependency on the broader /profiles/:id
 * page or Teammate 3's work.
 */

import { useEffect, useState } from 'react';
import { ExternalLink, AlertTriangle, User } from 'lucide-react';
import Link from 'next/link';
import type { ProfileDetailResponse } from '@smartshaadi/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileInfoGrid, type ProfileInfoData } from '@/components/profile/ProfileInfoGrid';
import { resolvePhotoUrl } from '@/lib/photo';
import { clientEnv } from '@/lib/env';
import { cn } from '@/lib/utils';

// ─── Hook: fetch profile detail ───────────────────────────────────────────────

interface FetchState {
  data: ProfileDetailResponse | null;
  loading: boolean;
  error: string | null;
}

function useProfileDetail(profileId: string | null): FetchState {
  const [state, setState] = useState<FetchState>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!profileId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(`${clientEnv.apiUrl}/profiles/${profileId}`, { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ data: null, loading: false, error: `Could not load profile (${res.status})` });
          return;
        }
        const json = (await res.json()) as {
          success: boolean;
          data?: ProfileDetailResponse;
          error?: { message?: string };
        };
        if (!json.success || !json.data) {
          setState({
            data: null,
            loading: false,
            error: json.error?.message ?? 'Failed to load profile',
          });
          return;
        }
        setState({ data: json.data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Network error',
        });
      });

    return () => { cancelled = true; };
  }, [profileId]);

  return state;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute age in years from an ISO-8601 date-of-birth string.
 * Returns null when dob is absent or unparseable.
 */
function ageFromDob(dob: string | undefined | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

/**
 * Derive the primary photo URL from the photos array.
 * Prefers isPrimary=true, falls back to displayOrder 0.
 */
function primaryPhotoUrl(
  photos: ProfileDetailResponse['photos'],
): string | null {
  if (!photos || photos.length === 0) return null;
  const primary = photos.find((p) => p.isPrimary) ?? photos.sort((a, b) => a.displayOrder - b.displayOrder)[0];
  if (!primary) return null;
  // Photos from getProfileById have a `url` field (presigned or mock-r2)
  // OR an r2Key which resolvePhotoUrl can handle.
  const photoWithUrl = primary as typeof primary & { url?: string };
  return photoWithUrl.url ?? resolvePhotoUrl(primary.r2Key);
}

/**
 * Map ProfileDetailResponse to ProfileInfoData for ProfileInfoGrid.
 */
function toInfoData(profile: ProfileDetailResponse): ProfileInfoData {
  const heightCm = profile.personal?.height;
  // ProfileInfoGrid expects heightInches; convert cm → inches if present
  const heightInches = heightCm != null ? Math.round(heightCm / 2.54) : null;

  // LifestyleSection.diet uses UPPER_SNAKE ('VEG', 'NON_VEG', etc.)
  // ProfileInfoData.diet expects lower-hyphen ('veg', 'non-veg', etc.)
  const DIET_MAP: Record<string, ProfileInfoData['diet']> = {
    VEG: 'veg',
    NON_VEG: 'non-veg',
    JAIN: 'jain',
    VEGAN: 'vegan',
    EGGETARIAN: 'eggetarian',
  };
  const dietRaw = profile.lifestyle?.diet;
  const diet: ProfileInfoData['diet'] =
    dietRaw != null ? (DIET_MAP[dietRaw] ?? null) : null;

  return {
    heightInches,
    religion: profile.personal?.religion ?? null,
    // community comes from community zone data not directly on ProfileDetailResponse
    community: null,
    diet: diet ?? null,
    education: profile.education?.degree ?? null,
    // ProfessionSection uses an incomeRange string, not numeric min/max.
    // ProfileInfoGrid expects numbers — pass null; the income field will be
    // omitted from the grid. If needed, parse or show incomeRange as a separate row.
    incomeMin: null,
    incomeMax: null,
    // motherTongue may come from personal section or community data added by the API
    motherTongue: profile.personal?.motherTongue ?? null,
    // Phone/email are always null for non-self viewers (masked by API)
    phone: null,
    phoneUnlocked: false,
    email: null,
    emailUnlocked: false,
    about: profile.aboutMe ?? null,
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-hidden="true">
      <div className="skeleton-warm aspect-[4/3] w-full rounded-xl" />
      <div className="skeleton-warm h-5 w-2/3 rounded" />
      <div className="skeleton-warm h-4 w-1/2 rounded" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton-warm h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-gold-muted">
      {children}
    </h3>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface MatchProfileDrawerProps {
  profileId: string | null;
  onClose: () => void;
}

export function MatchProfileDrawer({ profileId, onClose }: MatchProfileDrawerProps) {
  const { data, loading, error } = useProfileDetail(profileId);

  // Derive display values from the raw API response
  const age = data ? ageFromDob(data.personal?.dob) : null;
  const city = data?.location?.city ?? data?.location?.state ?? '';
  const occupation = data?.profession?.occupation ?? null;
  const photoUrl = data ? primaryPhotoUrl(data.photos) : null;
  const manglikRaw = data?.personal?.manglik;
  // PersonalSection.manglik is boolean; map to MatchFeedItem union shape
  const manglik: 'YES' | 'NO' | 'PARTIAL' | null =
    manglikRaw === true ? 'YES' : manglikRaw === false ? 'NO' : null;
  const isVerified = data?.verificationStatus === 'VERIFIED' || data?.verificationStatus === 'APPROVED';
  const infoData = data ? toInfoData(data) : null;

  return (
    <Sheet open={profileId !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col overflow-hidden p-0 sm:max-w-[480px]"
      >
        {/* ── Sticky header ──────────────────────────────────────────────── */}
        <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-3 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <SheetTitle className="truncate font-heading text-base text-primary">
              {loading ? 'Loading…' : (data?.name ?? 'Profile')}
            </SheetTitle>
          </div>
          {profileId && (
            <Link
              href={`/profiles/${profileId}`}
              onClick={onClose}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-teal/40 bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal transition-colors hover:bg-teal/20"
            >
              Full profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </SheetHeader>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {loading && <DrawerSkeleton />}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
                <AlertTriangle className="h-7 w-7 text-warning" aria-hidden="true" />
              </span>
              <div>
                <p className="font-heading text-base font-semibold text-primary">Could not load profile</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              {profileId && (
                <Link
                  href={`/profiles/${profileId}`}
                  onClick={onClose}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-teal px-5 text-sm font-semibold text-white shadow-sm hover:-translate-y-px hover:bg-teal-hover"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open full profile
                </Link>
              )}
            </div>
          )}

          {/* Profile data */}
          {data && !loading && (
            <div className="space-y-5 p-4 pb-8">
              {/* Hero — photo, name, age, city, badges */}
              <ProfileHero
                name={data.name}
                age={age}
                city={city}
                occupation={occupation ?? undefined}
                primaryPhotoUrl={photoUrl ?? undefined}
                isVerified={isVerified}
                completeness={data.profileCompleteness}
                createdByRole={undefined}
                premiumTier={data.premiumTier}
                manglik={manglik}
                lastActiveAt={data.lastActiveAt ?? null}
                showsPreciseLastActive={data.premiumTier !== 'FREE'}
                distanceKm={null}
              />

              {/* About */}
              {data.aboutMe ? (
                <section>
                  <SectionHeading>About</SectionHeading>
                  <p className="text-sm leading-relaxed text-foreground">{data.aboutMe}</p>
                </section>
              ) : null}

              {/* Info grid — height, religion, education, income, diet, etc. */}
              {infoData ? (
                <section>
                  <SectionHeading>Profile Details</SectionHeading>
                  <ProfileInfoGrid info={infoData} />
                </section>
              ) : null}

              {/* Profession blurb */}
              {(data.profession?.employer || data.profession?.occupation) ? (
                <section>
                  <SectionHeading>Career</SectionHeading>
                  <div className="rounded-lg border border-border bg-surface-muted/40 px-4 py-3 text-sm text-foreground">
                    {[data.profession.occupation, data.profession.employer]
                      .filter(Boolean)
                      .join(' at ')}
                  </div>
                </section>
              ) : null}

              {/* Family background pill row */}
              {(data.family?.familyType || data.family?.familyStatus) ? (
                <section>
                  <SectionHeading>Family</SectionHeading>
                  <div className="flex flex-wrap gap-2">
                    {data.family.familyType ? (
                      <span className={cn(
                        'inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground'
                      )}>
                        {String(data.family.familyType).replace(/_/g, ' ')}
                      </span>
                    ) : null}
                    {data.family.familyStatus ? (
                      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
                        {String(data.family.familyStatus).replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* ── CTA strip ─────────────────────────────────────────── */}
              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href={`/profiles/${profileId}`}
                  onClick={onClose}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover hover:shadow-md"
                >
                  <ExternalLink className="h-4 w-4" />
                  View full profile &amp; compatibility
                </Link>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
