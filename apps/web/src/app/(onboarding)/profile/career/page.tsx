'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updateCareer } from '../actions';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal', done: true, active: false },
  { label: 'Family', done: true, active: false },
  { label: 'Career', done: false, active: true },
];

const DEGREES = [
  'High School', 'Diploma', 'B.A.', 'B.Sc.', 'B.Com.', 'B.Tech.', 'B.E.',
  'M.A.', 'M.Sc.', 'M.Com.', 'M.Tech.', 'MBA', 'MCA', 'MBBS', 'MD', 'Ph.D.', 'Other',
];

const INCOME_RANGES = ['< 3 LPA', '3-5 LPA', '5-10 LPA', '10-15 LPA', '15-25 LPA', '25-50 LPA', '50+ LPA'];

const EMPLOYER_TYPES: Array<[string, string]> = [
  ['PRIVATE', 'Private Sector'],
  ['GOVERNMENT', 'Government / PSU'],
  ['BUSINESS', 'Own Business'],
  ['SELF_EMPLOYED', 'Self Employed'],
  ['NOT_WORKING', 'Not Working'],
];

interface ProfileSnapshot {
  education?: {
    degree?: string;
    college?: string;
    fieldOfStudy?: string;
    year?: number;
  };
  profession?: {
    occupation?: string;
    employer?: string;
    employerType?: string;
    designation?: string;
    incomeRange?: string;
    workLocation?: string;
  };
}

export default function CareerPage() {
  const [state, formAction] = useActionState(updateCareer, undefined);
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

  const e = profile?.education;
  const pr = profile?.profession;

  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6">
        <h1 className="text-lg font-semibold text-[#7B2D42] font-playfair mb-6">Education & Career</h1>
        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-4">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
              {state.error}
            </div>
          )}
          <fieldset>
            <legend className="text-sm font-semibold text-[#6B6B76] mb-3">Education</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Highest Degree</label>
                <select
                  name="degree"
                  defaultValue={e?.degree ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select degree</option>
                  {DEGREES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Field of Study</label>
                <input
                  name="fieldOfStudy"
                  defaultValue={e?.fieldOfStudy ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">College / University</label>
                <input
                  name="college"
                  defaultValue={e?.college ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="Institution name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Graduation Year</label>
                <input
                  name="year"
                  type="number"
                  min={1950}
                  max={2030}
                  defaultValue={e?.year ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. 2020"
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-[#6B6B76] mb-3">Profession</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Occupation</label>
                <input
                  name="occupation"
                  defaultValue={pr?.occupation ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Employer Type</label>
                <select
                  name="employerType"
                  defaultValue={pr?.employerType ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select type</option>
                  {EMPLOYER_TYPES.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Employer / Company</label>
                <input
                  name="employer"
                  defaultValue={pr?.employer ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Designation</label>
                <input
                  name="designation"
                  defaultValue={pr?.designation ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Senior Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Annual Income</label>
                <select
                  name="incomeRange"
                  defaultValue={pr?.incomeRange ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select range</option>
                  {INCOME_RANGES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Work Location</label>
                <input
                  name="workLocation"
                  defaultValue={pr?.workLocation ?? ''}
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Pune"
                />
              </div>
            </div>
          </fieldset>

          <OnboardingNav currentStep={3} backHref="/profile/family" skipHref="/profile/lifestyle" />
        </form>
      </div>
    </div>
  );
}
