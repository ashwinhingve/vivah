'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updateFamily } from '../actions';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal', done: true, active: false },
  { label: 'Family', done: false, active: true },
];

interface ProfileSnapshot {
  family?: {
    fatherName?: string;
    fatherOccupation?: string;
    motherName?: string;
    motherOccupation?: string;
    familyType?: string;
    familyValues?: string;
    familyStatus?: string;
    nativePlace?: string;
    familyAbout?: string;
  };
}

export default function FamilyPage() {
  const [state, formAction] = useActionState(updateFamily, undefined);
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

  const f = profile?.family;

  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6">
        <h1 className="text-lg font-semibold text-[#7B2D42] mb-6 font-heading">
          Family Background
        </h1>
        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-4">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
              {state.error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Father&apos;s Name</label>
              <input
                name="fatherName"
                defaultValue={f?.fatherName ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="Father's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Father&apos;s Occupation</label>
              <input
                name="fatherOccupation"
                defaultValue={f?.fatherOccupation ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="e.g. Retired Government Officer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Mother&apos;s Name</label>
              <input
                name="motherName"
                defaultValue={f?.motherName ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="Mother's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Mother&apos;s Occupation</label>
              <input
                name="motherOccupation"
                defaultValue={f?.motherOccupation ?? ''}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="e.g. Homemaker"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">Native Place</label>
            <input
              name="nativePlace"
              defaultValue={f?.nativePlace ?? ''}
              className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
              placeholder="e.g. Pune, Maharashtra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Family Type</label>
            <div className="flex gap-3 flex-wrap">
              {(['JOINT', 'NUCLEAR', 'EXTENDED'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="familyType"
                    value={type}
                    defaultChecked={f?.familyType === type}
                    className="accent-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Family Values</label>
            <div className="flex gap-3 flex-wrap">
              {(['TRADITIONAL', 'MODERATE', 'LIBERAL'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="familyValues"
                    value={v}
                    defaultChecked={f?.familyValues === v}
                    className="accent-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Family Status</label>
            <div className="flex gap-3 flex-wrap">
              {[
                ['MIDDLE_CLASS', 'Middle Class'],
                ['UPPER_MIDDLE', 'Upper Middle Class'],
                ['AFFLUENT', 'Affluent'],
              ].map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="familyStatus"
                    value={v}
                    defaultChecked={f?.familyStatus === v}
                    className="accent-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">About Your Family</label>
            <textarea
              name="familyAbout"
              rows={3}
              defaultValue={f?.familyAbout ?? ''}
              className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none resize-none"
              placeholder="Share a bit about your family background…"
            />
          </div>

          <OnboardingNav currentStep={2} backHref="/profile/personal" skipHref="/profile/career" />
        </form>
      </div>
    </div>
  );
}
