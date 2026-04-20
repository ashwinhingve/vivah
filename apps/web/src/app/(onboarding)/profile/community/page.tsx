'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updateCommunity } from '../actions';
import { INDIAN_LANGUAGES } from '@smartshaadi/schemas';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal',   done: true,  active: false },
  { label: 'Family',     done: true,  active: false },
  { label: 'Career',     done: true,  active: false },
  { label: 'Lifestyle',  done: true,  active: false },
  { label: 'Horoscope',  done: true,  active: false },
  { label: 'Community',  done: false, active: true  },
];

const LANGUAGE_LABELS: Record<string, string> = {
  hi: 'Hindi', en: 'English', mr: 'Marathi', gu: 'Gujarati',
  ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam',
  pa: 'Punjabi', bn: 'Bengali', or: 'Odia', as: 'Assamese',
};

const COMMUNITY_SUGGESTIONS = [
  'Brahmin', 'Kshatriya', 'Vaishya', 'Maratha', 'Rajput', 'Kayastha',
  'Nair', 'Naidu', 'Reddy', 'Kamma', 'Lingayat', 'Iyer', 'Iyengar',
  'Agarwal', 'Baniya', 'Jat', 'Gujar', 'Bania', 'Sindhi', 'Parsi',
];

interface ProfileSnapshot {
  community?: string;
  subCommunity?: string;
  motherTongue?: string;
  preferredLang?: string;
  lgbtqProfile?: boolean;
}

export default function CommunityPage() {
  const [state, formAction] = useActionState(updateCommunity, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [preferredLang, setPreferredLang] = useState('hi');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        if (json?.success && json.data) {
          setProfile(json.data);
          if (json.data.preferredLang) setPreferredLang(json.data.preferredLang);
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <ProfileProgress steps={STEPS} />

        <h1 className="mt-6 text-2xl font-bold text-[#7B2D42]">Community & Language</h1>
        <p className="mt-1 text-sm text-[#6B6B76]">
          Help us match you within your community.
        </p>

        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="mt-6 space-y-5">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
              {state.error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Community / Caste
            </label>
            <input
              type="text"
              name="community"
              defaultValue={profile?.community ?? ''}
              list="community-suggestions"
              placeholder="e.g. Brahmin, Maratha, Rajput"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] placeholder:text-[#6B6B76] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
            <datalist id="community-suggestions">
              {COMMUNITY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Sub-community / Gotra <span className="text-[#6B6B76] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              name="subCommunity"
              defaultValue={profile?.subCommunity ?? ''}
              placeholder="e.g. Deshastha, Karhade"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] placeholder:text-[#6B6B76] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">
              Mother Tongue
            </label>
            <input
              type="text"
              name="motherTongue"
              defaultValue={profile?.motherTongue ?? ''}
              list="language-suggestions"
              placeholder="e.g. Marathi, Hindi, Tamil"
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2.5 text-sm text-[#2E2E38] placeholder:text-[#6B6B76] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
            <datalist id="language-suggestions">
              {Object.values(LANGUAGE_LABELS).map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          <div>
            <p className="block text-sm font-medium text-[#2E2E38] mb-2">Preferred App Language</p>
            <input type="hidden" name="preferredLang" value={preferredLang} />
            <div className="grid grid-cols-3 gap-2">
              {INDIAN_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPreferredLang(code)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    preferredLang === code
                      ? 'border-[#0E7C7B] bg-[#0E7C7B]/10 text-[#0E7C7B]'
                      : 'border-[#E8E0D8] bg-white text-[#6B6B76]'
                  }`}
                >
                  {LANGUAGE_LABELS[code]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[#E8E0D8] bg-white p-4">
            <input
              type="checkbox"
              id="lgbtqProfile"
              name="lgbtqProfile"
              defaultChecked={profile?.lgbtqProfile ?? false}
              className="mt-0.5 h-4 w-4 rounded border-[#E8E0D8] text-[#0E7C7B] focus:ring-[#0E7C7B]"
            />
            <div>
              <label htmlFor="lgbtqProfile" className="text-sm font-medium text-[#2E2E38] cursor-pointer">
                I identify as LGBTQ+
              </label>
              <p className="mt-0.5 text-xs text-[#6B6B76]">
                Your identity is safe with us. This helps us show you relevant matches.
              </p>
            </div>
          </div>

          <OnboardingNav currentStep={6} backHref="/profile/horoscope" skipHref="/profile/preferences" />
        </form>
      </div>
    </div>
  );
}
