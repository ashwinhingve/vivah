'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updatePersonal } from '../actions';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal', done: false, active: true },
];

const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'];

const MOTHER_TONGUES = [
  'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Kannada',
  'Malayalam', 'Punjabi', 'Bengali', 'Odia', 'Assamese', 'English', 'Other',
];

const HEIGHTS_FT = [4, 5, 6, 7];
const HEIGHTS_IN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

interface ProfileSnapshot {
  personal?: {
    fullName?: string;
    dob?: string;
    gender?: string;
    height?: number;
    maritalStatus?: string;
    religion?: string;
    motherTongue?: string;
  };
  location?: { city?: string };
  aboutMe?: string;
}

function dobString(v?: string): string {
  if (!v) return '';
  return new Date(v).toISOString().slice(0, 10);
}

function heightToFtIn(cm?: number): { ft: number; inches: number } {
  if (!cm) return { ft: 5, inches: 6 };
  const totalInches = Math.round(cm / 2.54);
  return { ft: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export default function PersonalPage() {
  const [state, formAction] = useActionState(updatePersonal, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        if (json?.success && json.data) setProfile(json.data);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const p = profile?.personal;
  const { ft, inches } = heightToFtIn(p?.height);

  return (
    <div>
      <ProfileProgress steps={STEPS} />

      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 overflow-hidden">
        <div className="bg-gradient-to-r from-[#7B2D42]/5 to-transparent px-5 py-4 border-b border-[#C5A47E]/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#7B2D42]/10 flex items-center justify-center text-base">
            👤
          </div>
          <h1 className="font-semibold text-[#7B2D42] text-lg font-heading">
            Personal Details
          </h1>
        </div>

        <div className="p-5">
          <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-4">
            {state?.error && (
              <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
                {state.error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Full Name</label>
              <input
                name="fullName"
                type="text"
                autoComplete="name"
                required
                defaultValue={p?.fullName ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="Your full name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Date of Birth</label>
                <input
                  name="dob"
                  type="date"
                  required
                  defaultValue={dobString(p?.dob)}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Marital Status</label>
                <select
                  name="maritalStatus"
                  defaultValue={p?.maritalStatus ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select status</option>
                  <option value="NEVER_MARRIED">Never Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                  <option value="SEPARATED">Separated</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-2">Gender</label>
              <div className="flex gap-3 flex-wrap">
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      defaultChecked={p?.gender === g}
                      className="accent-[#0E7C7B]"
                      required
                    />
                    <span className="text-sm text-[#2E2E38]">
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Height</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    name="heightFt"
                    defaultValue={String(ft)}
                    className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                  >
                    {HEIGHTS_FT.map((v) => (
                      <option key={v} value={v}>{v} ft</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <select
                    name="heightIn"
                    defaultValue={String(inches)}
                    className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                  >
                    {HEIGHTS_IN.map((v) => (
                      <option key={v} value={v}>{v} in</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Religion</label>
                <select
                  name="religion"
                  defaultValue={p?.religion ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select religion</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Mother Tongue</label>
                <select
                  name="motherTongue"
                  defaultValue={p?.motherTongue ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select language</option>
                  {MOTHER_TONGUES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Current City</label>
              <input
                name="currentCity"
                type="text"
                defaultValue={profile?.location?.city ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="e.g. Pune, Maharashtra"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">About Me</label>
              <textarea
                name="aboutMe"
                rows={3}
                maxLength={500}
                defaultValue={profile?.aboutMe ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none resize-none"
                placeholder="Share a little about yourself, your interests, and what you're looking for…"
              />
            </div>

            <OnboardingNav currentStep={1} skipHref="/profile/family" />
          </form>
        </div>
      </div>
    </div>
  );
}
