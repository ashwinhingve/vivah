// apps/web/src/app/profiles/[profileId]/page.tsx

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { PhotoGallery } from '@/components/profile/PhotoGallery.client';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';
import { ContactSection } from '@/components/profile/ContactSection';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import type { ProfileDetailResponse } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getProfile(profileId: string): Promise<ProfileDetailResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  const res = await fetch(`${API_URL}/api/v1/profiles/${profileId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data: ProfileDetailResponse };
  return json.success ? json.data : null;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

function cmToFtIn(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

interface Props {
  params: Promise<{ profileId: string }>;
}

export default async function ProfileViewPage({ params }: Props) {
  const { profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) notFound();

  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;
  const isSelf = profile.phoneNumber != null || profile.email != null;

  return (
    <div className="min-h-screen bg-[#FEFAF6] pb-24">
      <div className="mx-auto max-w-lg">

        {/* ── Hero: Photo Gallery ─────────────────────────── */}
        <div className="relative">
          <PhotoGallery photos={profile.photos} name={profile.name} />
          <div className="absolute top-3 right-3 z-10">
            <VerifiedBadge status={profile.verificationStatus as 'PENDING' | 'VERIFIED' | 'REJECTED'} />
          </div>
        </div>

        <div className="px-4 space-y-4 mt-4">

          {/* ── Name + Quick Info ──────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
            <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-[#7B2D42]">
              {profile.name}{age != null ? `, ${age}` : ''}
            </h1>
            {profile.location && (
              <p className="mt-1 text-sm text-[#6B6B76]">
                {[profile.location.city, profile.location.state, profile.location.country].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.personal?.religion && (
                <span className="rounded-full bg-[#FEFAF6] border border-[#C5A47E] px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.personal.religion}
                </span>
              )}
              {profile.personal?.caste && (
                <span className="rounded-full bg-[#FEFAF6] border border-[#C5A47E] px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.personal.caste}
                </span>
              )}
              {profile.personal?.height && (
                <span className="rounded-full bg-[#FEFAF6] border border-[#C5A47E] px-3 py-1 text-xs text-[#2E2E38]">
                  {cmToFtIn(profile.personal.height)}
                </span>
              )}
              {profile.education?.degree && (
                <span className="rounded-full bg-[#FEFAF6] border border-[#C5A47E] px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.education.degree}
                </span>
              )}
              {profile.family?.familyType && (
                <span className="rounded-full bg-[#FEFAF6] border border-[#C5A47E] px-3 py-1 text-xs text-[#2E2E38]">
                  {profile.family.familyType.replace('_', ' ')} Family
                </span>
              )}
            </div>
          </div>

          {/* ── Profile Completeness ───────────────────────── */}
          {profile.sectionCompletion && (
            <CompletenessBar sections={profile.sectionCompletion} />
          )}

          {/* ── About Me ───────────────────────────────────── */}
          {profile.aboutMe && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42] mb-2">About</h2>
              <p className="text-sm text-[#6B6B76] italic leading-relaxed">&ldquo;{profile.aboutMe}&rdquo;</p>
            </div>
          )}

          {/* ── Personal Details ───────────────────────────── */}
          {profile.personal && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42] mb-3">Personal Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {profile.personal.height && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Height</dt>
                    <dd className="font-medium text-[#2E2E38]">{cmToFtIn(profile.personal.height)}</dd>
                  </>
                )}
                {profile.personal.maritalStatus && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Marital Status</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.personal.maritalStatus.replace(/_/g, ' ')}</dd>
                  </>
                )}
                {profile.personal.motherTongue && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Mother Tongue</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.personal.motherTongue}</dd>
                  </>
                )}
                {profile.personal.caste && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Community</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.personal.caste}</dd>
                  </>
                )}
                {profile.personal.gotra && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Gotra</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.personal.gotra}</dd>
                  </>
                )}
                {profile.personal.manglik != null && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Manglik</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.personal.manglik ? 'Yes' : 'No'}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {/* ── Family ────────────────────────────────────── */}
          {profile.family && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42] mb-3">Family</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {profile.family.familyType && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Family Type</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.family.familyType}</dd>
                  </>
                )}
                {profile.family.familyValues && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Values</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.family.familyValues}</dd>
                  </>
                )}
                {profile.family.familyStatus && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Status</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.family.familyStatus.replace('_', ' ')}</dd>
                  </>
                )}
                {profile.family.nativePlace && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Native Place</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.family.nativePlace}</dd>
                  </>
                )}
              </dl>
              {profile.family.familyAbout && (
                <p className="mt-3 text-sm text-[#6B6B76] italic">{profile.family.familyAbout}</p>
              )}
            </div>
          )}

          {/* ── Career & Education ────────────────────────── */}
          {(profile.education || profile.profession) && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42] mb-3">Career & Education</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {profile.education?.degree && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Degree</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.education.degree}</dd>
                  </>
                )}
                {profile.education?.fieldOfStudy && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Field</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.education.fieldOfStudy}</dd>
                  </>
                )}
                {profile.profession?.occupation && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Occupation</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.profession.occupation}</dd>
                  </>
                )}
                {profile.profession?.employerType && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Employer Type</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.profession.employerType.replace('_', ' ')}</dd>
                  </>
                )}
                {profile.profession?.incomeRange && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Income</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.profession.incomeRange}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {/* ── Lifestyle ──────────────────────────────────── */}
          {profile.lifestyle && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42] mb-3">Lifestyle</h2>
              <div className="flex flex-wrap gap-2">
                {profile.lifestyle.diet && (
                  <span className="rounded-full bg-[#059669]/10 border border-[#059669]/20 px-3 py-1 text-xs text-[#059669] font-medium">
                    {profile.lifestyle.diet}
                  </span>
                )}
                {profile.lifestyle.smoking && profile.lifestyle.smoking !== 'NEVER' && (
                  <span className="rounded-full bg-[#E8E0D8] px-3 py-1 text-xs text-[#6B6B76]">
                    Smoking: {profile.lifestyle.smoking.toLowerCase()}
                  </span>
                )}
                {profile.lifestyle.drinking && profile.lifestyle.drinking !== 'NEVER' && (
                  <span className="rounded-full bg-[#E8E0D8] px-3 py-1 text-xs text-[#6B6B76]">
                    Drinking: {profile.lifestyle.drinking.toLowerCase()}
                  </span>
                )}
                {profile.lifestyle.hobbies?.map((h: string) => (
                  <span key={h} className="rounded-full bg-[#0E7C7B]/10 border border-[#0E7C7B]/20 px-3 py-1 text-xs text-[#0E7C7B]">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Horoscope ──────────────────────────────────── */}
          {profile.horoscope && (
            <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42] mb-3">Horoscope</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {profile.horoscope.rashi && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Rashi</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.horoscope.rashi}</dd>
                  </>
                )}
                {profile.horoscope.nakshatra && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Nakshatra</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.horoscope.nakshatra}</dd>
                  </>
                )}
                {profile.horoscope.pob && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Place of Birth</dt>
                    <dd className="font-medium text-[#2E2E38]">{profile.horoscope.pob}</dd>
                  </>
                )}
                {profile.horoscope.manglik && (
                  <>
                    <dt className="text-xs text-[#6B6B76] uppercase tracking-wide">Manglik</dt>
                    <dd>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        profile.horoscope.manglik === 'YES' ? 'bg-[#DC2626]/10 text-[#DC2626]' :
                        profile.horoscope.manglik === 'NO' ? 'bg-[#059669]/10 text-[#059669]' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {profile.horoscope.manglik}
                      </span>
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {/* ── Partner Preferences ────────────────────────── */}
          {profile.partnerPreferences && (
            <details className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between p-4 list-none">
                <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#7B2D42]">Partner Preferences</h2>
                <span className="text-[#C5A47E] text-lg">▾</span>
              </summary>
              <div className="px-4 pb-4 space-y-2 border-t border-[#F0EBE4] pt-3">
                {profile.partnerPreferences.ageRange && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B6B76]">Age</span>
                    <span className="font-medium text-[#2E2E38]">
                      {profile.partnerPreferences.ageRange.min}–{profile.partnerPreferences.ageRange.max} yrs
                    </span>
                  </div>
                )}
                {profile.partnerPreferences.heightRange && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B6B76]">Height</span>
                    <span className="font-medium text-[#2E2E38]">
                      {cmToFtIn(profile.partnerPreferences.heightRange.min)} – {cmToFtIn(profile.partnerPreferences.heightRange.max)}
                    </span>
                  </div>
                )}
                {profile.partnerPreferences.manglik && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B6B76]">Manglik preference</span>
                    <span className="font-medium text-[#2E2E38]">{profile.partnerPreferences.manglik.replace('_', ' ')}</span>
                  </div>
                )}
                {profile.partnerPreferences.partnerDescription && (
                  <p className="text-sm text-[#6B6B76] italic mt-2 pt-2 border-t border-[#F0EBE4]">
                    &ldquo;{profile.partnerPreferences.partnerDescription}&rdquo;
                  </p>
                )}
              </div>
            </details>
          )}

          {/* ── Contact ────────────────────────────────────── */}
          <ContactSection
            phone={profile.phoneNumber ?? null}
            email={profile.email ?? null}
            isSelf={isSelf}
          />

        </div>
      </div>

      {/* ── Sticky Bottom Action Bar (non-self only) ────── */}
      {!isSelf && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#7B2D42] px-4 py-3 shadow-2xl">
          <div className="mx-auto max-w-lg flex items-center gap-3">
            <button
              type="button"
              className="flex-1 bg-[#0E7C7B] text-white font-semibold rounded-lg py-3 text-sm min-h-[48px] active:scale-[0.97] transition-transform">
              Send Interest
            </button>
            <button
              type="button"
              aria-label="Bookmark profile"
              className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-white text-xl hover:bg-white/20 transition-colors">
              ♡
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
