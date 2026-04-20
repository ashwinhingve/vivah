'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updateLifestyle } from '../actions';
import { HYPER_NICHE_TAGS } from '@smartshaadi/schemas';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal', done: true, active: false },
  { label: 'Family', done: true, active: false },
  { label: 'Career', done: true, active: false },
  { label: 'Lifestyle', done: false, active: true },
];

const LANGUAGES = [
  'Hindi', 'English', 'Marathi', 'Bengali', 'Telugu',
  'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
  'Odia', 'Urdu', 'Rajasthani', 'Bhojpuri', 'Maithili',
];

const HOBBIES = [
  'Reading', 'Cooking', 'Travelling', 'Music', 'Movies',
  'Sports', 'Yoga', 'Dancing', 'Painting', 'Photography',
  'Gaming', 'Gardening', 'Cycling', 'Swimming', 'Writing',
  'Meditation', 'Trekking', 'Socialising', 'Volunteering', 'Fitness',
];

interface ProfileSnapshot {
  lifestyle?: {
    diet?: string;
    smoking?: string;
    drinking?: string;
    hobbies?: string[];
    hyperNicheTags?: string[];
    languagesSpoken?: string[];
    fitnessLevel?: string;
  };
}

export default function LifestylePage() {
  const [state, formAction] = useActionState(updateLifestyle, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        if (json?.success && json.data) {
          setProfile(json.data);
          const l = json.data.lifestyle;
          if (l?.hobbies) setSelectedHobbies(l.hobbies);
          if (l?.hyperNicheTags) setSelectedTags(l.hyperNicheTags);
          if (l?.languagesSpoken) setSelectedLanguages(l.languagesSpoken);
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const l = profile?.lifestyle;

  function toggleHobby(h: string) {
    setSelectedHobbies((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }
  function toggleTag(t: string) {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }
  function toggleLanguage(lang: string) {
    setSelectedLanguages((prev) => (prev.includes(lang) ? prev.filter((x) => x !== lang) : [...prev, lang]));
  }

  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6">
        <h1 className="text-lg font-semibold text-[#7B2D42] font-playfair mb-6">Lifestyle & Interests</h1>
        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-6">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
              {state.error}
            </div>
          )}
          {selectedHobbies.map((h) => (
            <input key={h} type="hidden" name="hobbies" value={h} />
          ))}
          {selectedTags.map((t) => (
            <input key={t} type="hidden" name="hyperNicheTags" value={t} />
          ))}
          {selectedLanguages.map((lang) => (
            <input key={lang} type="hidden" name="languagesSpoken" value={lang} />
          ))}

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Diet Preference</label>
            <div className="flex gap-3 flex-wrap">
              {(['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN'] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="diet"
                    value={d}
                    defaultChecked={l?.diet === d}
                    className="accent-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">
                    {d.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-2">Smoking</label>
              <div className="flex gap-3 flex-wrap">
                {(['NEVER', 'OCCASIONALLY', 'REGULARLY'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="smoking"
                      value={v}
                      defaultChecked={l?.smoking === v}
                      className="accent-[#0E7C7B]"
                    />
                    <span className="text-sm text-[#2E2E38]">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-2">Drinking</label>
              <div className="flex gap-3 flex-wrap">
                {(['NEVER', 'OCCASIONALLY', 'REGULARLY'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="drinking"
                      value={v}
                      defaultChecked={l?.drinking === v}
                      className="accent-[#0E7C7B]"
                    />
                    <span className="text-sm text-[#2E2E38]">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Hobbies (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {HOBBIES.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHobby(h)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedHobbies.includes(h)
                      ? 'bg-[#0E7C7B] text-white border-[#0E7C7B]'
                      : 'bg-white text-[#6B6B76] border-[#E8E0D8] hover:border-[#0E7C7B]'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Languages Spoken</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedLanguages.includes(lang)
                      ? 'bg-[#0E7C7B] text-white border-[#0E7C7B]'
                      : 'bg-white text-[#6B6B76] border-[#E8E0D8] hover:border-[#0E7C7B]'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Your Personality Tags</label>
            <p className="text-xs text-[#6B6B76] mb-2">These help surface you to compatible matches</p>
            <div className="flex flex-wrap gap-2">
              {HYPER_NICHE_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedTags.includes(t)
                      ? 'bg-[#7B2D42] text-white border-[#7B2D42]'
                      : 'bg-white text-[#6B6B76] border-[#E8E0D8] hover:border-[#7B2D42]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Fitness Level</label>
            <div className="flex gap-3 flex-wrap">
              {(['ACTIVE', 'MODERATE', 'SEDENTARY'] as const).map((f) => (
                <label key={f} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fitnessLevel"
                    value={f}
                    defaultChecked={l?.fitnessLevel === f}
                    className="accent-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">{f.charAt(0) + f.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <OnboardingNav currentStep={4} backHref="/profile/career" skipHref="/profile/horoscope" />
        </form>
      </div>
    </div>
  );
}
