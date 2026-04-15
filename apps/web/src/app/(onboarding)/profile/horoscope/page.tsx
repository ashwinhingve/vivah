'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { updateHoroscope } from '../actions';
import { RASHI_LABELS, NAKSHATRA_LABELS } from '@smartshaadi/types';

const STEPS = [
  { label: 'Family',      done: true,  active: false },
  { label: 'Career',      done: true,  active: false },
  { label: 'Lifestyle',   done: true,  active: false },
  { label: 'Horoscope',   done: false, active: true  },
];

const RASHI_OPTIONS = Object.entries(RASHI_LABELS) as [string, string][];
const NAKSHATRA_OPTIONS = Object.entries(NAKSHATRA_LABELS) as [string, string][];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[#0E7C7B] py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-95 transition-transform"
    >
      {pending ? 'Saving…' : 'Continue'}
    </button>
  );
}

export default function HoroscopePage() {
  const [manglik, setManglik] = useState<'YES' | 'NO' | 'PARTIAL'>('NO');

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <ProfileProgress steps={STEPS} />

        <h1 className="mt-6 text-2xl font-bold text-[#7B2D42]">Horoscope Details</h1>
        <p className="mt-1 text-sm text-[#6B6B76]">
          Help us find your most compatible match.
        </p>

        <form action={updateHoroscope} className="mt-6 space-y-5">
          {/* Rashi */}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Rashi (Moon Sign)
            </label>
            <select
              name="rashi"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            >
              <option value="">Select Rashi</option>
              {RASHI_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Nakshatra */}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Nakshatra (Birth Star)
            </label>
            <select
              name="nakshatra"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            >
              <option value="">Select Nakshatra</option>
              {NAKSHATRA_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Manglik */}
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

          {/* DOB */}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              name="dob"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          {/* TOB */}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Time of Birth <span className="text-[#6B6B76] font-normal">(HH:MM)</span>
            </label>
            <input
              type="time"
              name="tob"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          {/* POB */}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Place of Birth
            </label>
            <input
              type="text"
              name="pob"
              placeholder="e.g. Pune, Maharashtra"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] placeholder:text-[#6B6B76] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          {/* Kundli chart placeholder */}
          <div className="rounded-xl border border-dashed border-[#E8E0D8] bg-white p-5 text-center">
            <p className="text-sm font-medium text-[#7B2D42]">Kundli Chart Upload</p>
            <p className="mt-1 text-xs text-[#6B6B76]">Coming soon — upload your birth chart PDF or image</p>
          </div>

          {/* Guna Milan placeholder */}
          <div className="rounded-xl border border-[#0E7C7B]/20 bg-[#0E7C7B]/5 p-5 text-center">
            <p className="text-sm font-medium text-[#0E7C7B]">Guna Milan Score</p>
            <p className="mt-1 text-xs text-[#6B6B76]">
              Your compatibility score will appear once both profiles are complete
            </p>
          </div>

          <SubmitButton />

          <div className="text-center">
            <a href="/profile/community" className="text-sm text-[#6B6B76] underline-offset-2 hover:underline">
              Skip for now
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
