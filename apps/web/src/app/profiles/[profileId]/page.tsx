// apps/web/src/app/profiles/[profileId]/page.tsx

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
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

interface Props {
  params: Promise<{ profileId: string }>;
}

export default async function ProfileViewPage({ params }: Props) {
  const { profileId } = await params;
  const profile = await getProfile(profileId);

  if (!profile) notFound();

  const primaryPhoto = profile.photos.find(p => p.isPrimary) ?? profile.photos[0];
  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Hero */}
        <div className="rounded-xl overflow-hidden bg-white shadow-sm">
          {primaryPhoto?.url ? (
            <img
              src={primaryPhoto.url}
              alt={profile.name}
              className="h-72 w-full object-cover"
            />
          ) : (
            <div className="h-72 w-full bg-gradient-to-br from-[#1848C8]/10 to-[#0A1F4D]/10 flex items-center justify-center">
              <span className="text-6xl text-gray-300">{profile.name.charAt(0)}</span>
            </div>
          )}
          <div className="p-4">
            <h1 className="text-xl font-bold text-[#0A1F4D]">
              {profile.name}{age != null ? `, ${age}` : ''}
            </h1>
            {profile.location && (
              <p className="mt-0.5 text-sm text-[#64748B]">
                {[profile.location.city, profile.location.state, profile.location.country]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.personal?.religion && (
                <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs text-[#64748B]">
                  {profile.personal.religion}
                </span>
              )}
              {profile.personal?.maritalStatus && (
                <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs text-[#64748B]">
                  {profile.personal.maritalStatus.replace('_', ' ')}
                </span>
              )}
              {profile.profession?.occupation && (
                <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs text-[#64748B]">
                  {profile.profession.occupation}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Completeness bar */}
        {profile.sectionCompletion && (
          <CompletenessBar sections={profile.sectionCompletion} />
        )}

        {/* About */}
        {profile.personal && (
          <div className="rounded-xl bg-white shadow-sm p-4">
            <h2 className="text-base font-semibold text-[#0A1F4D] mb-3">Personal Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {profile.personal.height && (
                <>
                  <dt className="text-[#64748B]">Height</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.personal.height} cm</dd>
                </>
              )}
              {profile.personal.motherTongue && (
                <>
                  <dt className="text-[#64748B]">Mother Tongue</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.personal.motherTongue}</dd>
                </>
              )}
              {profile.personal.caste && (
                <>
                  <dt className="text-[#64748B]">Community</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.personal.caste}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Family */}
        {profile.family && (
          <div className="rounded-xl bg-white shadow-sm p-4">
            <h2 className="text-base font-semibold text-[#0A1F4D] mb-3">Family</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {profile.family.familyType && (
                <>
                  <dt className="text-[#64748B]">Family Type</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.family.familyType}</dd>
                </>
              )}
              {profile.family.familyValues && (
                <>
                  <dt className="text-[#64748B]">Values</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.family.familyValues}</dd>
                </>
              )}
              {profile.family.nativePlace && (
                <>
                  <dt className="text-[#64748B]">Native Place</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.family.nativePlace}</dd>
                </>
              )}
            </dl>
            {profile.family.familyAbout && (
              <p className="mt-3 text-sm text-[#64748B]">{profile.family.familyAbout}</p>
            )}
          </div>
        )}

        {/* Career */}
        {(profile.education || profile.profession) && (
          <div className="rounded-xl bg-white shadow-sm p-4">
            <h2 className="text-base font-semibold text-[#0A1F4D] mb-3">Career & Education</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {profile.education?.degree && (
                <>
                  <dt className="text-[#64748B]">Education</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.education.degree}</dd>
                </>
              )}
              {profile.profession?.occupation && (
                <>
                  <dt className="text-[#64748B]">Occupation</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.profession.occupation}</dd>
                </>
              )}
              {profile.profession?.incomeRange && (
                <>
                  <dt className="text-[#64748B]">Income</dt>
                  <dd className="text-[#0F172A] font-medium">{profile.profession.incomeRange}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Partner preferences accordion */}
        {profile.partnerPreferences && (
          <details className="rounded-xl bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between p-4">
              <span className="text-base font-semibold text-[#0A1F4D]">Partner Preferences</span>
              <span className="text-[#1848C8]">▾</span>
            </summary>
            <div className="px-4 pb-4 text-sm space-y-2">
              {profile.partnerPreferences.ageRange && (
                <p className="text-[#64748B]">
                  Age: <span className="text-[#0F172A] font-medium">
                    {profile.partnerPreferences.ageRange.min}–{profile.partnerPreferences.ageRange.max} yrs
                  </span>
                </p>
              )}
              {profile.partnerPreferences.heightRange && (
                <p className="text-[#64748B]">
                  Height: <span className="text-[#0F172A] font-medium">
                    {profile.partnerPreferences.heightRange.min}–{profile.partnerPreferences.heightRange.max} cm
                  </span>
                </p>
              )}
              {profile.partnerPreferences.manglik && (
                <p className="text-[#64748B]">
                  Manglik: <span className="text-[#0F172A] font-medium">
                    {profile.partnerPreferences.manglik.replace('_', ' ')}
                  </span>
                </p>
              )}
              {profile.partnerPreferences.partnerDescription && (
                <p className="text-[#64748B] mt-2 italic">
                  &ldquo;{profile.partnerPreferences.partnerDescription}&rdquo;
                </p>
              )}
            </div>
          </details>
        )}

        {/* Contact CTA */}
        <div className="rounded-xl bg-[#0A1F4D] p-5 text-center">
          <p className="text-sm text-white/70 mb-3">
            Send an interest request to connect with {profile.name.split(' ')[0]}
          </p>
          <button
            type="button"
            className="w-full rounded-lg bg-[#1848C8] py-3 text-sm font-semibold text-white active:scale-95 transition-transform"
          >
            Send Interest
          </button>
        </div>
      </div>
    </div>
  );
}
