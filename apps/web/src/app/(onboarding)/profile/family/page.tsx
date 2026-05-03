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

interface SiblingEntry {
  name?: string;
  married?: boolean;
  occupation?: string;
}

interface ProfileSnapshot {
  family?: {
    fatherName?: string;
    fatherOccupation?: string;
    motherName?: string;
    motherOccupation?: string;
    siblings?: SiblingEntry[];
    familyType?: string;
    familyValues?: string;
    familyStatus?: string;
    nativePlace?: string;
    familyAbout?: string;
    photoR2Key?: string;
  };
}

export default function FamilyPage() {
  const [state, formAction] = useActionState(updateFamily, undefined);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [siblings, setSiblings] = useState<SiblingEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/profiles/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: ProfileSnapshot } | null) => {
        if (cancelled) return;
        if (json?.success && json.data) {
          setProfile(json.data);
          setSiblings(json.data.family?.siblings ?? []);
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const f = profile?.family;

  function updateSibling(idx: number, field: 'name' | 'occupation', value: string): void {
    setSiblings(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }
  function toggleSiblingMarried(idx: number): void {
    setSiblings(prev => prev.map((s, i) => i === idx ? { ...s, married: !s.married } : s));
  }
  function addSibling(): void {
    setSiblings(prev => [...prev, {}]);
  }
  function removeSibling(idx: number): void {
    setSiblings(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-surface rounded-xl shadow-sm border border-gold/20 p-6">
        <h1 className="text-lg font-semibold text-primary mb-6 font-heading">
          Family Background
        </h1>
        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-4">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Father&apos;s Name</label>
              <input
                name="fatherName"
                defaultValue={f?.fatherName ?? ''}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                placeholder="Father's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Father&apos;s Occupation</label>
              <input
                name="fatherOccupation"
                defaultValue={f?.fatherOccupation ?? ''}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                placeholder="e.g. Retired Government Officer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Mother&apos;s Name</label>
              <input
                name="motherName"
                defaultValue={f?.motherName ?? ''}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                placeholder="Mother's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Mother&apos;s Occupation</label>
              <input
                name="motherOccupation"
                defaultValue={f?.motherOccupation ?? ''}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
                placeholder="e.g. Homemaker"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Native Place</label>
            <input
              name="nativePlace"
              defaultValue={f?.nativePlace ?? ''}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none"
              placeholder="e.g. Pune, Maharashtra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Family Type</label>
            <div className="flex gap-3 flex-wrap">
              {(['JOINT', 'NUCLEAR', 'EXTENDED'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="familyType"
                    value={type}
                    defaultChecked={f?.familyType === type}
                    className="accent-teal"
                  />
                  <span className="text-sm text-foreground">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Family Values</label>
            <div className="flex gap-3 flex-wrap">
              {(['TRADITIONAL', 'MODERATE', 'LIBERAL'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="familyValues"
                    value={v}
                    defaultChecked={f?.familyValues === v}
                    className="accent-teal"
                  />
                  <span className="text-sm text-foreground">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Family Status</label>
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
                    className="accent-teal"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">About Your Family</label>
            <textarea
              name="familyAbout"
              rows={3}
              defaultValue={f?.familyAbout ?? ''}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal focus:border-transparent outline-none resize-none"
              placeholder="Share a bit about your family background…"
            />
          </div>

          {/* Siblings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">Siblings</label>
              <button
                type="button"
                onClick={addSibling}
                className="text-xs text-teal hover:underline"
              >
                + Add sibling
              </button>
            </div>
            {siblings.length === 0 ? (
              <p className="text-xs text-muted-foreground">None added yet.</p>
            ) : (
              <div className="space-y-2">
                {siblings.map((sib, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center bg-[#FEFAF6] rounded-lg p-2">
                    <input
                      name="siblingName"
                      defaultValue={sib.name ?? ''}
                      onChange={(e) => updateSibling(idx, 'name', e.target.value)}
                      placeholder="Name"
                      className="border border-border rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      name="siblingOccupation"
                      defaultValue={sib.occupation ?? ''}
                      onChange={(e) => updateSibling(idx, 'occupation', e.target.value)}
                      placeholder="Occupation"
                      className="border border-border rounded px-2 py-1.5 text-sm"
                    />
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={sib.married ?? false}
                        onChange={() => toggleSiblingMarried(idx)}
                      />
                      <input type="hidden" name="siblingMarried" value={sib.married ? 'true' : 'false'} />
                      Married
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSibling(idx)}
                      className="text-destructive text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <OnboardingNav currentStep={2} backHref="/profile/personal" skipHref="/profile/career" />
        </form>
      </div>
    </div>
  );
}
