'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updateHoroscope } from '../actions';
import { RASHI_LABELS, NAKSHATRA_LABELS } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal',  done: true,  active: false },
  { label: 'Family',    done: true,  active: false },
  { label: 'Career',    done: true,  active: false },
  { label: 'Lifestyle', done: true,  active: false },
  { label: 'Horoscope', done: false, active: true  },
];

const RASHI_OPTIONS = Object.entries(RASHI_LABELS) as [string, string][];
const NAKSHATRA_OPTIONS = Object.entries(NAKSHATRA_LABELS) as [string, string][];

interface ProfileSnapshot {
  horoscope?: {
    rashi?: string;
    nakshatra?: string;
    manglik?: 'YES' | 'NO' | 'PARTIAL';
    dob?: string;
    tob?: string;
    pob?: string;
  };
}

function dobString(v?: string): string {
  if (!v) return '';
  return new Date(v).toISOString().slice(0, 10);
}

export default function HoroscopePage() {
  const [state, formAction] = useActionState(updateHoroscope, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [manglik, setManglik] = useState<'YES' | 'NO' | 'PARTIAL'>('NO');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        if (json?.success && json.data) {
          setProfile(json.data);
          if (json.data.horoscope?.manglik) setManglik(json.data.horoscope.manglik);
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const h = profile?.horoscope;

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <ProfileProgress steps={STEPS} />

        <h1 className="mt-6 text-2xl font-bold text-[#7B2D42]">Horoscope Details</h1>
        <p className="mt-1 text-sm text-[#6B6B76]">
          Help us find your most compatible match.
        </p>

        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="mt-6 space-y-5">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
              {state.error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Rashi (Moon Sign)
            </label>
            <select
              name="rashi"
              defaultValue={h?.rashi ?? ''}
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            >
              <option value="">Select Rashi</option>
              {RASHI_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Nakshatra (Birth Star)
            </label>
            <select
              name="nakshatra"
              defaultValue={h?.nakshatra ?? ''}
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            >
              <option value="">Select Nakshatra</option>
              {NAKSHATRA_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="block text-sm font-medium text-[#2E2E38] mb-2">Manglik Status</p>
            <div className="flex gap-3">
              {(['NO', 'PARTIAL', 'YES'] as const).map((val) => (
                <label
                  key={val}
                  className={`flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                    manglik === val
                      ? 'border-[#0E7C7B] bg-[#0E7C7B]/10 text-[#0E7C7B]'
                      : 'border-[#E8E0D8] bg-white text-[#6B6B76]'
                  }`}
                >
                  <input
                    type="radio"
                    name="manglik"
                    value={val}
                    checked={manglik === val}
                    onChange={() => setManglik(val)}
                    className="sr-only"
                  />
                  {val === 'NO' ? 'Non-Manglik' : val === 'PARTIAL' ? 'Partial' : 'Manglik'}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              name="dob"
              defaultValue={dobString(h?.dob)}
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Time of Birth <span className="text-[#6B6B76] font-normal">(HH:MM)</span>
            </label>
            <input
              type="time"
              name="tob"
              defaultValue={h?.tob ?? ''}
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Place of Birth
            </label>
            <input
              type="text"
              name="pob"
              defaultValue={h?.pob ?? ''}
              placeholder="e.g. Pune, Maharashtra"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] placeholder:text-[#6B6B76] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          <div className="rounded-xl border border-dashed border-[#E8E0D8] bg-white p-5 text-center">
            <p className="text-sm font-medium text-[#7B2D42]">Kundli Chart Upload</p>
            <p className="mt-1 text-xs text-[#6B6B76]">Coming soon — upload your birth chart PDF or image</p>
          </div>

          <div className="rounded-xl border border-[#0E7C7B]/20 bg-[#0E7C7B]/5 p-5 text-center">
            <p className="text-sm font-medium text-[#0E7C7B]">Guna Milan Score</p>
            <p className="mt-1 text-xs text-[#6B6B76]">
              Your compatibility score will appear once both profiles are complete
            </p>
          </div>

          <OnboardingNav currentStep={5} backHref="/profile/lifestyle" skipHref="/profile/community" />
        </form>
      </div>
    </div>
  );
}
