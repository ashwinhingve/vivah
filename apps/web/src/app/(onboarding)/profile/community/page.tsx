'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { updateCommunity } from '../actions';
import { INDIAN_LANGUAGES } from '@smartshaadi/schemas';

const STEPS = [
  { label: 'Family',      done: true,  active: false },
  { label: 'Career',      done: true,  active: false },
  { label: 'Lifestyle',   done: true,  active: false },
  { label: 'Horoscope',   done: true,  active: false },
  { label: 'Community',   done: false, active: true  },
];

const LANGUAGE_LABELS: Record<string, string> = {
  hi: 'Hindi',
  en: 'English',
  mr: 'Marathi',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  bn: 'Bengali',
  or: 'Odia',
  as: 'Assamese',
};

const COMMUNITY_SUGGESTIONS = [
  'Brahmin', 'Kshatriya', 'Vaishya', 'Maratha', 'Rajput', 'Kayastha',
  'Nair', 'Naidu', 'Reddy', 'Kamma', 'Lingayat', 'Iyer', 'Iyengar',
  'Agarwal', 'Baniya', 'Jat', 'Gujar', 'Bania', 'Sindhi', 'Parsi',
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[#1848C8] py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-95 transition-transform"
    >
      {pending ? 'Saving…' : 'Continue'}
    </button>
  );
}

export default function CommunityPage() {
  const [preferredLang, setPreferredLang] = useState('hi');

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <ProfileProgress steps={STEPS} />

        <h1 className="mt-6 text-2xl font-bold text-[#0A1F4D]">Community & Language</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Help us match you within your community.
        </p>

        <form action={updateCommunity} className="mt-6 space-y-5">
          {/* Community */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Community / Caste
            </label>
            <input
              type="text"
              name="community"
              list="community-suggestions"
              placeholder="e.g. Brahmin, Maratha, Rajput"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1848C8]"
            />
            <datalist id="community-suggestions">
              {COMMUNITY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Sub-community */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Sub-community / Gotra <span className="text-[#64748B] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              name="subCommunity"
              placeholder="e.g. Deshastha, Karhade"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1848C8]"
            />
          </div>

          {/* Mother tongue */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Mother Tongue
            </label>
            <input
              type="text"
              name="motherTongue"
              list="language-suggestions"
              placeholder="e.g. Marathi, Hindi, Tamil"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1848C8]"
            />
            <datalist id="language-suggestions">
              {Object.values(LANGUAGE_LABELS).map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          {/* Preferred app language */}
          <div>
            <p className="block text-sm font-medium text-[#0F172A] mb-2">Preferred App Language</p>
            <input type="hidden" name="preferredLang" value={preferredLang} />
            <div className="grid grid-cols-3 gap-2">
              {INDIAN_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPreferredLang(code)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    preferredLang === code
                      ? 'border-[#1848C8] bg-[#EEF2FF] text-[#1848C8]'
                      : 'border-gray-200 bg-white text-[#64748B]'
                  }`}
                >
                  {LANGUAGE_LABELS[code]}
                </button>
              ))}
            </div>
          </div>

          {/* LGBTQ+ */}
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <input
              type="checkbox"
              id="lgbtqProfile"
              name="lgbtqProfile"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1848C8] focus:ring-[#1848C8]"
            />
            <div>
              <label htmlFor="lgbtqProfile" className="text-sm font-medium text-[#0F172A] cursor-pointer">
                I identify as LGBTQ+
              </label>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Your identity is safe with us. This helps us show you relevant matches.
              </p>
            </div>
          </div>

          <SubmitButton />

          <div className="text-center">
            <a href="/profile/preferences" className="text-sm text-[#64748B] underline-offset-2 hover:underline">
              Skip for now
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
