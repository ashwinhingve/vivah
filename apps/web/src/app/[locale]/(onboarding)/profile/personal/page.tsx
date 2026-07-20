'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
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

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const HEIGHTS_FT = [4, 5, 6, 7];
const HEIGHTS_IN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

interface ProfileSnapshot {
  personal?: {
    fullName?: string;
    dob?: string;
    gender?: string;
    sexualOrientation?: string;
    orientationVisibility?: 'PRIVATE' | 'OUT';
    height?: number;
    maritalStatus?: string;
    religion?: string;
    motherTongue?: string;
  };
  location?: { city?: string; state?: string };
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
  const t = useTranslations('onboarding.personal');
  const [state, formAction] = useActionState(updatePersonal, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lgbtqEnabled, setLgbtqEnabled] = useState(false);

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
    fetch(`${API_BASE}/api/v1/platform-settings/public`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: { lgbtqEnabled?: boolean } } | null) => {
        if (cancelled) return;
        if (json?.success && json.data?.lgbtqEnabled === true) setLgbtqEnabled(true);
      })
      .catch(() => { /* default off */ });
    return () => { cancelled = true; };
  }, []);

  const p = profile?.personal;
  const { ft, inches } = heightToFtIn(p?.height);

  return (
    <div>
      <ProfileProgress steps={STEPS} />

      <div className="bg-surface rounded-2xl shadow-card border border-gold/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-gold/10">
          <PageHeader
            title={t('heading')}
            className="mb-0"
          />
        </div>

        <div className="p-5">
          <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-4">
            {state?.error && (
              <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('fullName')}</label>
              <input
                name="fullName"
                type="text"
                autoComplete="name"
                required
                defaultValue={p?.fullName ?? ''}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                placeholder={t('fullNamePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('dateOfBirth')}</label>
                <input
                  name="dob"
                  type="date"
                  required
                  defaultValue={dobString(p?.dob)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('maritalStatus')}</label>
                <select
                  name="maritalStatus"
                  defaultValue={p?.maritalStatus ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="" disabled>{t('selectStatus')}</option>
                  <option value="NEVER_MARRIED">Never Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                  <option value="SEPARATED">Separated</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('gender')}</label>
              <div className="flex gap-3 flex-wrap">
                {(lgbtqEnabled
                  ? (['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'] as const)
                  : (['MALE', 'FEMALE'] as const)
                ).map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      defaultChecked={p?.gender === g}
                      className="accent-teal"
                      required
                    />
                    <span className="text-sm text-foreground">
                      {g === 'MALE' ? t('genderMale') : g === 'FEMALE' ? t('genderFemale') : g === 'NON_BINARY' ? t('genderNonBinary') : t('genderOther')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {lgbtqEnabled && (
              <div className="space-y-3 rounded-lg border border-gold/40 bg-gold/5 p-4">
                <div>
                  <label htmlFor="sexualOrientation" className="block text-sm font-medium text-foreground mb-1">
                    {t('sexualOrientationPrivate')}
                  </label>
                  <select
                    id="sexualOrientation"
                    name="sexualOrientation"
                    defaultValue={p?.sexualOrientation ?? ''}
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="STRAIGHT">Straight</option>
                    <option value="GAY">Gay</option>
                    <option value="LESBIAN">Lesbian</option>
                    <option value="BISEXUAL">Bisexual</option>
                    <option value="PANSEXUAL">Pansexual</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('orientationStorageNote')}
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="orientationVisibility"
                    value="OUT"
                    defaultChecked={p?.orientationVisibility === 'OUT'}
                    className="accent-teal"
                  />
                  <span className="text-sm text-foreground">{t('orientationVisible')}</span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('height')}</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    name="heightFt"
                    defaultValue={String(ft)}
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
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
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
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
                <label className="block text-sm font-medium text-foreground mb-1">{t('religion')}</label>
                <select
                  name="religion"
                  defaultValue={p?.religion ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="" disabled>{t('selectReligion')}</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('motherTongue')}</label>
                <select
                  name="motherTongue"
                  defaultValue={p?.motherTongue ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="" disabled>{t('selectLanguage')}</option>
                  {MOTHER_TONGUES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('currentCity')}</label>
                <input
                  name="currentCity"
                  type="text"
                  defaultValue={profile?.location?.city ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                  placeholder={t('currentCityPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('state')}</label>
                <select
                  name="currentState"
                  defaultValue={profile?.location?.state ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="">{t('selectState')}</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('aboutMe')}</label>
              <textarea
                name="aboutMe"
                rows={3}
                maxLength={500}
                defaultValue={profile?.aboutMe ?? ''}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none resize-none"
                placeholder={t('aboutMePlaceholder')}
              />
            </div>

            <OnboardingNav currentStep={1} skipHref="/profile/family" />
          </form>
        </div>
      </div>
    </div>
  );
}
