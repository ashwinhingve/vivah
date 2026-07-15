'use client';
/**
 * ProfileDetailTabs — Day 9 refinement.
 *
 * Tabbed details: About · Family · Career · Lifestyle · Horoscope · Preferences.
 * Only renders tabs with present data. Active tab gets a 3px Teal underline +
 * semibold text. Each tab uses its own visual hierarchy (timeline, chips,
 * 2-column cards) rather than a uniform grid.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Quote, GraduationCap, BriefcaseBusiness, Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  PersonalSection,
  FamilySection,
  EducationSection,
  ProfessionSection,
  LifestyleSection,
  HoroscopeSection,
  PartnerPreferencesSection,
  SiblingEntry,
} from '@smartshaadi/types';

type TabId = 'about' | 'family' | 'career' | 'lifestyle' | 'horoscope' | 'preferences';
interface TabDef { id: TabId; label: string }

interface Props {
  aboutMe?: string;
  personal?: PersonalSection;
  family?: FamilySection;
  education?: EducationSection;
  profession?: ProfessionSection;
  lifestyle?: LifestyleSection;
  horoscope?: HoroscopeSection;
  partnerPreferences?: PartnerPreferencesSection;
  kundliUrl?: string | null;
}

// ─────────────────────────── Helpers ───────────────────────────

function cmToFtIn(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${ft}'${inches}"`;
}

function formatHeight(cm?: number): string | null {
  if (cm == null) return null;
  return `${cmToFtIn(cm)} / ${cm} cm`;
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

function formatDob(dob?: string): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${label} · ${calcAge(dob)} yrs`;
}

function startCase(s: string): string {
  return s.toLowerCase().replace(/(^|[_\s])(\w)/g, (_, sep: string, c: string) => (sep === '_' ? ' ' : sep) + c.toUpperCase()).trim();
}

function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' }) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? '·';
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return (
    <span className={cn('inline-flex items-center justify-center rounded-full bg-gold/20 font-heading font-semibold text-primary shrink-0', dim)}>
      {initial}
    </span>
  );
}

// ─────────────────────────── Primitives ───────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[15px] text-foreground">{value}</span>
    </div>
  );
}

function Chip({
  label,
  variant = 'plain',
}: {
  label: string;
  variant?: 'plain' | 'teal' | 'gold' | 'goldRing' | 'mutedRing';
}) {
  const cls =
    variant === 'teal'      ? 'bg-teal/10 border-teal/30 text-teal' :
    variant === 'gold'      ? 'bg-gold/20 border-gold/40 text-gold-muted' :
    variant === 'goldRing'  ? 'bg-surface border-gold/40 text-primary' :
    variant === 'mutedRing' ? 'bg-surface border-border text-foreground' :
                              'bg-background border-gold/30 text-foreground';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h3>
  );
}

// ─────────────────────────── About Tab ───────────────────────────

function AboutTab({ aboutMe, personal }: { aboutMe?: string; personal?: PersonalSection }) {
  const hasBio = !!aboutMe?.trim();
  const isShortBio = hasBio && aboutMe!.length < 100;

  return (
    <div className="space-y-5">
      {hasBio ? (
        isShortBio ? (
          <figure className="mx-auto max-w-md text-center">
            <Quote className="mx-auto h-4 w-4 text-gold" aria-hidden="true" />
            <blockquote className="mt-2 font-heading text-lg italic leading-relaxed text-foreground">
              {aboutMe}
            </blockquote>
          </figure>
        ) : (
          <p className="font-heading text-base italic leading-relaxed text-foreground">{aboutMe}</p>
        )
      ) : (
        <p className="text-sm italic text-muted-foreground">Bio not added yet.</p>
      )}

      {personal && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {personal.dob && <InfoRow label="Date of Birth" value={formatDob(personal.dob) ?? '—'} />}
          {personal.height != null && <InfoRow label="Height" value={formatHeight(personal.height) ?? '—'} />}
          {personal.maritalStatus && <InfoRow label="Marital Status" value={startCase(personal.maritalStatus)} />}
          {personal.motherTongue && <InfoRow label="Mother Tongue" value={personal.motherTongue} />}
          {personal.religion && (
            <InfoRow
              label="Religion"
              value={[personal.religion, personal.caste, personal.gotra && `Gotra: ${personal.gotra}`].filter(Boolean).join(' · ')}
            />
          )}
          {personal.manglik != null && <InfoRow label="Manglik" value={personal.manglik ? 'Yes' : 'No'} />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Family Tab ───────────────────────────

function familySummary(f: FamilySection): string | null {
  const parts: string[] = [];
  if (f.familyType) parts.push(`${startCase(f.familyType)} Family`);
  if (f.familyValues) parts.push(`${startCase(f.familyValues)} Values`);
  if (f.nativePlace) parts.push(`From ${f.nativePlace}`);
  return parts.length ? parts.join(' · ') : null;
}

function FamilyTab({ family }: { family: FamilySection }) {
  const summary = familySummary(family);
  type ParentRow = { role: string; name: string; occ: string | undefined };
  const parents: ParentRow[] = [
    family.fatherName ? { role: 'Father', name: family.fatherName, occ: family.fatherOccupation } : null,
    family.motherName ? { role: 'Mother', name: family.motherName, occ: family.motherOccupation } : null,
    !family.fatherName && family.fatherOccupation ? { role: 'Father', name: '', occ: family.fatherOccupation } : null,
    !family.motherName && family.motherOccupation ? { role: 'Mother', name: '', occ: family.motherOccupation } : null,
  ].filter((p): p is ParentRow => p !== null);
  const siblings = family.siblings?.filter((s: SiblingEntry) => s.name || s.occupation || s.married != null) ?? [];

  const valueChips: string[] = [];
  if (family.familyValues) valueChips.push(startCase(family.familyValues));
  if (family.familyType) valueChips.push(startCase(family.familyType));
  if (family.familyStatus) valueChips.push(startCase(family.familyStatus));
  if (family.culturalEventsAttendance === 'ALWAYS' || family.culturalEventsAttendance === 'IMPORTANT_ONLY') {
    valueChips.push('Culturally active');
  }

  return (
    <div className="space-y-6">
      {summary && (
        <p className="font-heading text-base text-primary">{summary}</p>
      )}

      {parents.length > 0 && (
        <div className="space-y-2">
          <SectionHeader>Parents</SectionHeader>
          <div className="space-y-2">
            {parents.map((p) => (
              <div key={`${p.role}-${p.name}`} className="flex items-center gap-3">
                <Avatar name={p.name || p.role} size="sm" />
                <div className="min-w-0 text-sm">
                  <span className="font-semibold text-foreground">{p.role}{p.name ? `: ${p.name}` : ''}</span>
                  {p.occ ? <span className="text-muted-foreground">, {p.occ}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {siblings.length > 0 && (
        <div className="space-y-2">
          <SectionHeader>Siblings</SectionHeader>
          <ul className="space-y-1.5 text-sm">
            {siblings.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
                <span>
                  {s.name ?? 'Sibling'}
                  {s.married != null ? <span className="text-muted-foreground"> · {s.married ? 'Married' : 'Single'}</span> : null}
                  {s.occupation ? <span className="text-muted-foreground"> · {s.occupation}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {valueChips.length > 0 && (
        <div className="space-y-2">
          <SectionHeader>Family Values</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {valueChips.map((c) => <Chip key={c} label={c} variant="goldRing" />)}
          </div>
        </div>
      )}

      {family.familyAbout && (
        <p className="border-t border-border-light pt-3 text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;{family.familyAbout}&rdquo;
        </p>
      )}
    </div>
  );
}

// ─────────────────────────── Career Tab ───────────────────────────

function CareerTab({ education, profession }: { education?: EducationSection; profession?: ProfessionSection }) {
  const profSummary: string[] = [];
  if (profession?.incomeRange) profSummary.push(profession.incomeRange);
  if (profession?.workLocation) profSummary.push(profession.workLocation);
  if (profession?.employerType) profSummary.push(startCase(profession.employerType));

  const timeline: { degree?: string; college?: string; year?: number }[] = [];
  if (education?.degree || education?.college || education?.year) {
    timeline.push({ degree: education.degree, college: education.college, year: education.year });
  }
  for (const d of education?.additionalDegrees ?? []) {
    if (d.degree || d.college || d.year) timeline.push(d);
  }
  timeline.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return (
    <div className="space-y-6">
      {(profession?.occupation || profession?.designation || profession?.employer) && (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-primary">
              {[profession?.designation, profession?.occupation].filter(Boolean).join(' ')}
              {profession?.employer ? <span className="text-foreground"> at {profession.employer}</span> : null}
            </p>
            {profSummary.length > 0 && (
              <p className="text-sm text-muted-foreground">{profSummary.join(' · ')}</p>
            )}
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="space-y-2">
          <SectionHeader>Education</SectionHeader>
          <ol className="relative space-y-3 border-l border-gold/30 pl-4">
            {timeline.map((d, i) => (
              <li key={i} className="relative">
                <span
                  className={cn(
                    'absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full',
                    i === 0 ? 'bg-teal' : 'bg-gold/40'
                  )}
                  aria-hidden="true"
                />
                <p className={cn('text-sm font-semibold', i === 0 ? 'text-foreground' : 'text-muted-foreground')}>
                  {d.degree ?? 'Education'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[d.college, d.year && String(d.year)].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {profession?.workingAbroad && profession.abroadCountry && (
        <p className="text-sm text-muted-foreground">
          <GraduationCap className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Currently based in {profession.abroadCountry}.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────── Lifestyle Tab ───────────────────────────

function dietEmoji(diet: string): string {
  switch (diet.toUpperCase()) {
    case 'VEGETARIAN': return '🥗';
    case 'VEGAN':      return '🌱';
    case 'EGGETARIAN': return '🍳';
    case 'JAIN':       return '🪷';
    case 'NON_VEGETARIAN': case 'NON-VEGETARIAN': return '🍗';
    default: return '🍽️';
  }
}

function LifestyleTab({ lifestyle }: { lifestyle: LifestyleSection }) {
  const summaryChips: { label: string }[] = [];
  if (lifestyle.diet) summaryChips.push({ label: `${dietEmoji(lifestyle.diet)} ${startCase(lifestyle.diet)}` });
  if (lifestyle.smoking) summaryChips.push({ label: `🚭 ${lifestyle.smoking === 'NEVER' ? 'Non-smoker' : startCase(lifestyle.smoking)}` });
  if (lifestyle.drinking) summaryChips.push({ label: `🍷 ${lifestyle.drinking === 'NEVER' ? 'Doesn’t drink' : startCase(lifestyle.drinking)}` });
  if (lifestyle.fitnessLevel) summaryChips.push({ label: `💪 ${startCase(lifestyle.fitnessLevel)}` });

  return (
    <div className="space-y-5">
      {summaryChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summaryChips.map((c) => <Chip key={c.label} label={c.label} variant="teal" />)}
        </div>
      )}

      {(lifestyle.hobbies?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionHeader>Hobbies</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {lifestyle.hobbies!.map((h) => <Chip key={h} label={h} variant="goldRing" />)}
          </div>
        </div>
      )}

      {(lifestyle.interests?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionHeader>Interests</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {lifestyle.interests!.map((i) => <Chip key={i} label={i} variant="plain" />)}
          </div>
        </div>
      )}

      {(lifestyle.languagesSpoken?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionHeader>Languages</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {lifestyle.languagesSpoken!.map((l) => <Chip key={l} label={l} variant="mutedRing" />)}
          </div>
        </div>
      )}

      {(lifestyle.lifestyleTags?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionHeader>Hyper-niche</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {lifestyle.lifestyleTags!.map((t) => <Chip key={t} label={t.replace(/-/g, ' ')} variant="gold" />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Horoscope Tab ───────────────────────────

function manglikPill(manglik: HoroscopeSection['manglik']) {
  if (!manglik) return null;
  if (manglik === 'YES') return { label: 'Manglik', className: 'bg-primary text-white border-primary' };
  if (manglik === 'NO') return { label: 'Non-Manglik', className: 'bg-teal text-white border-teal' };
  return { label: 'Anshik Manglik', className: 'bg-gold text-white border-gold' };
}

function HoroscopeTab({ horoscope, kundliUrl }: { horoscope: HoroscopeSection; kundliUrl?: string | null }) {
  const hasData = horoscope.rashi || horoscope.nakshatra || horoscope.dob || horoscope.tob || horoscope.pob;
  if (!hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-gold" aria-hidden="true" />
        <p className="mt-2 font-heading text-base font-semibold text-primary">Add your horoscope</p>
        <p className="mt-1 text-sm text-muted-foreground">Unlock Guna Milan compatibility scoring.</p>
        <Link
          href="/profile/horoscope"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-hover"
        >
          Add Horoscope
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const pill = manglikPill(horoscope.manglik);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
        <div className="flex items-center justify-between gap-2 border-b border-gold/20 pb-3">
          <h3 className="font-heading text-base font-semibold text-primary">Vedic Profile</h3>
          {pill && (
            <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-2xs font-semibold shadow-sm', pill.className)}>
              {pill.label}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
          {horoscope.rashi && (
            <div>
              <p className="text-2xs uppercase tracking-widest text-muted-foreground">Rashi</p>
              <p className="mt-0.5 font-heading text-base text-foreground">{horoscope.rashi}</p>
            </div>
          )}
          {horoscope.nakshatra && (
            <div>
              <p className="text-2xs uppercase tracking-widest text-muted-foreground">Nakshatra</p>
              <p className="mt-0.5 font-heading text-base text-foreground">{horoscope.nakshatra}</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-gold/15 pt-3 text-2xs text-muted-foreground">
          {horoscope.dob && (
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden="true" /> {new Date(horoscope.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
          {horoscope.tob && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" /> {horoscope.tob}</span>
          )}
          {horoscope.pob && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" /> {horoscope.pob}</span>
          )}
        </div>
      </div>

      {kundliUrl && (
        <div>
          <SectionHeader>Kundli Chart</SectionHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={kundliUrl}
            alt="Vedic kundli chart"
            className="mt-2 w-full max-w-sm rounded-lg border border-border bg-background"
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Preferences Tab ───────────────────────────

function PreferencesTab({ partnerPreferences }: { partnerPreferences: PartnerPreferencesSection }) {
  const prefs = partnerPreferences;
  const basics: [string, string][] = [];
  if (prefs.ageRange) basics.push(['Age', `${prefs.ageRange.min}–${prefs.ageRange.max} yrs`]);
  if (prefs.heightRange) basics.push(['Height', `${cmToFtIn(prefs.heightRange.min)} – ${cmToFtIn(prefs.heightRange.max)}`]);
  if (prefs.education?.length) basics.push(['Education', prefs.education.join(', ')]);

  const cultural: [string, string][] = [];
  if (prefs.religion?.length) cultural.push(['Religion', prefs.religion.join(', ')]);
  if (prefs.manglik) cultural.push(['Manglik', startCase(prefs.manglik)]);
  if (prefs.diet?.length) cultural.push(['Diet', prefs.diet.join(', ')]);

  const geo: [string, string][] = [];
  if (prefs.maxDistanceKm) geo.push(['Max Distance', `${prefs.maxDistanceKm} km`]);

  const openFlags: string[] = [];
  if (prefs.openToInterCaste) openFlags.push('Open to inter-caste');
  if (prefs.openToInterfaith) openFlags.push('Open to inter-faith');

  function Section({ title, rows }: { title: string; rows: [string, string][] }) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <SectionHeader>{title}</SectionHeader>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Partner basics" rows={basics} />
      <Section title="Cultural preferences" rows={cultural} />
      <Section title="Geography" rows={geo} />

      {openFlags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {openFlags.map((f) => <Chip key={f} label={f} variant="teal" />)}
        </div>
      )}

      {prefs.partnerDescription && (
        <p className="border-t border-border-light pt-3 text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;{prefs.partnerDescription}&rdquo;
        </p>
      )}
    </div>
  );
}

// ─────────────────────────── Container ───────────────────────────

export function ProfileDetailTabs({
  aboutMe,
  personal,
  family,
  education,
  profession,
  lifestyle,
  horoscope,
  partnerPreferences,
  kundliUrl,
}: Props) {
  const t = useTranslations('profileDetail');
  const hasAbout = !!(aboutMe || personal);
  const hasCareer = !!(education || profession);

  const tabs: TabDef[] = [
    hasAbout && { id: 'about' as TabId, label: t('tabs.about') },
    family && { id: 'family' as TabId, label: t('tabs.family') },
    hasCareer && { id: 'career' as TabId, label: t('tabs.career') },
    lifestyle && { id: 'lifestyle' as TabId, label: t('tabs.lifestyle') },
    horoscope && { id: 'horoscope' as TabId, label: t('tabs.horoscope') },
    partnerPreferences && { id: 'preferences' as TabId, label: t('tabs.preferences') },
  ].filter((x): x is TabDef => Boolean(x));

  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id ?? 'about');
  const [animKey, setAnimKey] = useState(0);

  if (tabs.length === 0) return null;

  function switchTab(id: TabId) {
    setActiveTab(id);
    setAnimKey((k) => k + 1);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex overflow-x-auto scrollbar-hide border-b border-gold/20">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={cn(
                'min-w-fit flex-1 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors duration-150',
                isActive
                  ? 'border-teal text-teal'
                  : 'border-transparent text-muted-foreground hover:bg-gold/20 hover:text-primary'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div key={animKey} className="p-5 sm:p-6" style={{ animation: 'fadeIn 150ms ease-out' }}>
        {activeTab === 'about'      && <AboutTab aboutMe={aboutMe} personal={personal} />}
        {activeTab === 'family'     && family && <FamilyTab family={family} />}
        {activeTab === 'career'     && <CareerTab education={education} profession={profession} />}
        {activeTab === 'lifestyle'  && lifestyle && <LifestyleTab lifestyle={lifestyle} />}
        {activeTab === 'horoscope'  && horoscope && <HoroscopeTab horoscope={horoscope} kundliUrl={kundliUrl} />}
        {activeTab === 'preferences' && partnerPreferences && <PreferencesTab partnerPreferences={partnerPreferences} />}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Card>
  );
}
