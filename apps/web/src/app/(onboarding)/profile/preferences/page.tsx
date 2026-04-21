'use client';

import { useActionState, useEffect, useState } from 'react';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updatePreferences } from '../actions';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal',    done: true,  active: false },
  { label: 'Family',      done: true,  active: false },
  { label: 'Career',      done: true,  active: false },
  { label: 'Lifestyle',   done: true,  active: false },
  { label: 'Horoscope',   done: true,  active: false },
  { label: 'Community',   done: true,  active: false },
  { label: 'Preferences', done: false, active: true  },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'NEVER_MARRIED', label: 'Never Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'SEPARATED', label: 'Separated' },
] as const;

const RELIGION_OPTIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Any'];
const DIET_OPTIONS = ['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN'];

interface ProfileSnapshot {
  partnerPreferences?: {
    ageRange?: { min?: number; max?: number };
    heightRange?: { min?: number; max?: number };
    manglik?: 'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK';
    openToInterfaith?: boolean;
    openToInterCaste?: boolean;
    diet?: string[];
    maritalStatus?: string[];
    religion?: string[];
    partnerDescription?: string;
  };
}

export default function PreferencesPage() {
  const [state, formAction] = useActionState(updatePreferences, undefined);
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [heightMin, setHeightMin] = useState(150);
  const [heightMax, setHeightMax] = useState(185);
  const [selectedMarital, setSelectedMarital] = useState<string[]>([]);
  const [selectedReligion, setSelectedReligion] = useState<string[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<string[]>([]);
  const [manglik, setManglik] = useState<'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK'>('ANY');
  const [openToInterfaith, setOpenToInterfaith] = useState(false);
  const [openToInterCaste, setOpenToInterCaste] = useState(false);
  const [partnerDescription, setPartnerDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        const p = json?.data?.partnerPreferences;
        if (!p) return;
        if (p.ageRange?.min != null) setAgeMin(p.ageRange.min);
        if (p.ageRange?.max != null) setAgeMax(p.ageRange.max);
        if (p.heightRange?.min != null) setHeightMin(p.heightRange.min);
        if (p.heightRange?.max != null) setHeightMax(p.heightRange.max);
        if (p.maritalStatus) setSelectedMarital(p.maritalStatus);
        if (p.religion) setSelectedReligion(p.religion);
        if (p.diet) setSelectedDiet(p.diet);
        if (p.manglik) setManglik(p.manglik);
        if (typeof p.openToInterfaith === 'boolean') setOpenToInterfaith(p.openToInterfaith);
        if (typeof p.openToInterCaste === 'boolean') setOpenToInterCaste(p.openToInterCaste);
        if (p.partnerDescription) setPartnerDescription(p.partnerDescription);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function toggleChip(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <ProfileProgress steps={STEPS} />
      <h1 className="text-2xl font-bold text-primary mb-2 font-heading">
        Partner Preferences
      </h1>
      <p className="text-muted-foreground text-sm mb-6">What are you looking for in a partner?</p>

      <form action={formAction} className="space-y-6">
        {state?.error && (
          <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <input type="hidden" name="ageMin" value={ageMin} />
        <input type="hidden" name="ageMax" value={ageMax} />
        <input type="hidden" name="heightMin" value={heightMin} />
        <input type="hidden" name="heightMax" value={heightMax} />
        {selectedMarital.map(v => (
          <input key={v} type="hidden" name="maritalStatus" value={v} />
        ))}
        {selectedDiet.map(v => (
          <input key={v} type="hidden" name="diet" value={v} />
        ))}

        <div className="bg-surface rounded-xl shadow-sm border border-gold/20 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary font-heading">
            Basic Preferences
          </h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Age Range: {ageMin} – {ageMax} years
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6">18</span>
                <input
                  type="range" min={18} max={ageMax} value={ageMin}
                  onChange={e => setAgeMin(Number(e.target.value))}
                  className="flex-1 accent-teal"
                />
                <span className="text-xs text-muted-foreground w-4">{ageMin}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6">{ageMin}</span>
                <input
                  type="range" min={ageMin} max={75} value={ageMax}
                  onChange={e => setAgeMax(Number(e.target.value))}
                  className="flex-1 accent-teal"
                />
                <span className="text-xs text-muted-foreground w-4">75</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Height Range: {heightMin}cm – {heightMax}cm
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-10">140cm</span>
                <input
                  type="range" min={140} max={heightMax} value={heightMin}
                  onChange={e => setHeightMin(Number(e.target.value))}
                  className="flex-1 accent-teal"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">{heightMin}cm</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-10">{heightMin}cm</span>
                <input
                  type="range" min={heightMin} max={210} value={heightMax}
                  onChange={e => setHeightMax(Number(e.target.value))}
                  className="flex-1 accent-teal"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">210cm</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Marital Status</label>
            <div className="flex flex-wrap gap-2">
              {MARITAL_STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value} type="button"
                  onClick={() => toggleChip(selectedMarital, setSelectedMarital, value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px] ${
                    selectedMarital.includes(value)
                      ? 'bg-teal text-white border-teal'
                      : 'bg-surface text-foreground border-border hover:border-teal'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Religion Preference</label>
            <div className="flex flex-wrap gap-2">
              {RELIGION_OPTIONS.map(r => (
                <button
                  key={r} type="button"
                  onClick={() => toggleChip(selectedReligion, setSelectedReligion, r)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px] ${
                    selectedReligion.includes(r)
                      ? 'bg-teal text-white border-teal'
                      : 'bg-surface text-foreground border-border hover:border-teal'
                  }`}
                >
                  {r}
                </button>
              ))}
              {selectedReligion.map(v => (
                <input key={v} type="hidden" name="religion" value={v} />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl shadow-sm border border-gold/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-primary font-heading">
              Advanced Filters
            </h2>
            <span className="text-muted-foreground text-sm">{showAdvanced ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 space-y-4 border-t border-border-light">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Manglik Preference</label>
                <div className="flex gap-4">
                  {(['ANY','ONLY_MANGLIK','NON_MANGLIK'] as const).map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio" name="manglik" value={m}
                        checked={manglik === m}
                        onChange={() => setManglik(m)}
                        className="text-teal focus:ring-teal"
                      />
                      <span className="text-sm text-foreground">
                        {m === 'ANY' ? 'Any' : m === 'ONLY_MANGLIK' ? 'Only Manglik' : 'Non-Manglik'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Diet Preference</label>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map(d => (
                    <button key={d} type="button"
                      onClick={() => toggleChip(selectedDiet, setSelectedDiet, d)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px] ${
                        selectedDiet.includes(d)
                          ? 'bg-teal text-white border-teal'
                          : 'bg-surface text-foreground border-border hover:border-teal'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox" name="openToInterfaith"
                    checked={openToInterfaith}
                    onChange={e => setOpenToInterfaith(e.target.checked)}
                    className="w-5 h-5 rounded text-teal focus:ring-teal"
                  />
                  <span className="text-sm text-foreground">Open to Interfaith Marriage</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox" name="openToInterCaste"
                    checked={openToInterCaste}
                    onChange={e => setOpenToInterCaste(e.target.checked)}
                    className="w-5 h-5 rounded text-teal focus:ring-teal"
                  />
                  <span className="text-sm text-foreground">Open to Inter-Caste Marriage</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl shadow-sm border border-gold/20 p-6">
          <h2 className="text-lg font-semibold text-primary mb-3 font-heading">
            Describe Your Ideal Partner
          </h2>
          <textarea
            name="partnerDescription"
            value={partnerDescription}
            onChange={e => setPartnerDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Describe qualities you're looking for in a life partner..."
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent resize-none"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">{partnerDescription.length}/1000</p>
        </div>

        <OnboardingNav currentStep={7} backHref="/profile/community" skipHref="/profile/photos" saveLabel="Save Preferences" />
      </form>
    </div>
  );
}
