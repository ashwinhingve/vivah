'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';
import { updateNri } from '../actions';
import { COUNTRIES } from '@/lib/countries';
import { RESIDENCY_STATUS_LABELS, SUPPORTED_CURRENCIES } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'International Profile', done: false, active: true },
];

// Common IANA timezones organized by region
const TIMEZONE_GROUPS = {
  'Asia': [
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Dubai',
  ],
  'America': [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Mexico_City',
  ],
  'Europe': [
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Amsterdam',
    'Europe/Madrid',
    'Europe/Zurich',
  ],
  'Oceania': [
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
  ],
};

interface ProfileSnapshot {
  nri?: {
    countryOfResidence?: string;
    citizenship?: string | null;
    residencyStatus?: string | null;
    willingToRelocate?: boolean;
    openToNriMatching?: boolean;
    ianaTimezone?: string | null;
    displayCurrency?: string;
  };
}

export default function NriPage() {
  const t = useTranslations('onboarding.nri');
  const [state, formAction] = useActionState(updateNri, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('IN');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        if (json?.success && json.data?.nri?.countryOfResidence) {
          setProfile(json.data);
          setSelectedCountry(json.data.nri.countryOfResidence);
        } else {
          setProfile(json?.data ?? null);
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const nri = profile?.nri;

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
          <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-6">
            {state?.error && (
              <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            {/* Info box explaining NRI matching */}
            <div className="rounded-lg border border-teal/30 bg-teal/5 p-4">
              <p className="text-sm text-foreground leading-relaxed">
                {t('description')}
              </p>
            </div>

            {/* Country of Residence */}
            <div>
              <label htmlFor="countryOfResidence" className="block text-sm font-medium text-foreground mb-1">
                {t('countryOfResidence')} <span className="text-destructive">*</span>
              </label>
              <select
                id="countryOfResidence"
                name="countryOfResidence"
                required
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                defaultValue={nri?.countryOfResidence ?? 'IN'}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Citizenship */}
              <div>
                <label htmlFor="citizenship" className="block text-sm font-medium text-foreground mb-1">
                  {t('citizenship')}
                </label>
                <select
                  id="citizenship"
                  name="citizenship"
                  defaultValue={nri?.citizenship ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="">Prefer not to say</option>
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('citizenshipHint')}
                </p>
              </div>

              {/* Residency Status */}
              <div>
                <label htmlFor="residencyStatus" className="block text-sm font-medium text-foreground mb-1">
                  {t('residencyStatus')}
                </label>
                <select
                  id="residencyStatus"
                  name="residencyStatus"
                  defaultValue={nri?.residencyStatus ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="">Select status</option>
                  {Object.entries(RESIDENCY_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timezone and Currency row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Timezone */}
              <div>
                <label htmlFor="ianaTimezone" className="block text-sm font-medium text-foreground mb-1">
                  {t('timezone')}
                </label>
                <select
                  id="ianaTimezone"
                  name="ianaTimezone"
                  defaultValue={nri?.ianaTimezone ?? ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  <option value="">Auto-detect from country</option>
                  {Object.entries(TIMEZONE_GROUPS).map(([group, zones]) => (
                    <optgroup key={group} label={group}>
                      {zones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('timezoneHint')}
                </p>
              </div>

              {/* Display Currency */}
              <div>
                <label htmlFor="displayCurrency" className="block text-sm font-medium text-foreground mb-1">
                  {t('displayCurrency')} <span className="text-destructive">*</span>
                </label>
                <select
                  id="displayCurrency"
                  name="displayCurrency"
                  required
                  defaultValue={nri?.displayCurrency ?? 'INR'}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none bg-surface"
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('displayCurrencyHint')}
                </p>
              </div>
            </div>

            {/* Willing to Relocate */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="willingToRelocate"
                value="true"
                defaultChecked={nri?.willingToRelocate ?? false}
                className="accent-teal"
              />
              <span className="text-sm font-medium text-foreground">
                {t('willingToRelocate')}
              </span>
            </label>

            {/* NRI Matching Opt-in */}
            <div className="rounded-lg border border-gold/40 bg-gold/5 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="openToNriMatching"
                  value="true"
                  defaultChecked={nri?.openToNriMatching ?? false}
                  className="accent-teal mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-foreground block">
                    {t('openToNriMatching')}
                  </span>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {t('openToNriMatchingExplainer')}
                  </p>
                </div>
              </label>
            </div>

            {/* Visa & Relocation Details */}
            <div className="space-y-3">
              <div>
                <label htmlFor="visaDetails" className="block text-sm font-medium text-foreground mb-1">
                  {t('visaDetails')}
                </label>
                <input
                  id="visaDetails"
                  name="visaDetails"
                  type="text"
                  maxLength={200}
                  defaultValue={profile?.nri?.countryOfResidence ? '' : ''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                  placeholder="e.g. H-1B, renewal filed"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('visaDetailsHint')}
                </p>
              </div>

              <div>
                <label htmlFor="relocationTimeline" className="block text-sm font-medium text-foreground mb-1">
                  {t('relocationTimeline')}
                </label>
                <input
                  id="relocationTimeline"
                  name="relocationTimeline"
                  type="text"
                  maxLength={200}
                  defaultValue={''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                  placeholder="e.g. Open to moving within 2 years"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('relocationTimelineHint')}
                </p>
              </div>

              <div>
                <label htmlFor="yearsAbroad" className="block text-sm font-medium text-foreground mb-1">
                  {t('yearsAbroad')}
                </label>
                <input
                  id="yearsAbroad"
                  name="yearsAbroad"
                  type="number"
                  min="0"
                  max="80"
                  defaultValue={''}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <OnboardingNav currentStep={1} skipHref="/dashboard" />
          </form>
        </div>
      </div>
    </div>
  );
}
