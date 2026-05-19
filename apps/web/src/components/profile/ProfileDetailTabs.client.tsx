'use client';
/**
 * ProfileDetailTabs
 *
 * Tabbed details panel: About · Family · Career · Lifestyle · Horoscope · Preferences
 * Only renders tabs for sections that are present in the response.
 * Tab content fades in 150ms on switch.
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import type {
  PersonalSection,
  FamilySection,
  EducationSection,
  ProfessionSection,
  LifestyleSection,
  HoroscopeSection,
  PartnerPreferencesSection,
} from '@smartshaadi/types';

type TabId = 'about' | 'family' | 'career' | 'lifestyle' | 'horoscope' | 'preferences';

interface TabDef {
  id: TabId;
  label: string;
}

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

function cmToFtIn(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${ft}'${inches}"`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border-light last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function Chip({ label, teal }: { label: string; teal?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium border ${
        teal
          ? 'bg-teal/10 border-teal/20 text-teal'
          : 'bg-background border-gold/40 text-foreground'
      }`}
    >
      {label}
    </span>
  );
}

function AboutTab({ aboutMe, personal }: { aboutMe?: string; personal?: PersonalSection }) {
  return (
    <div className="space-y-4">
      {aboutMe && (
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
          <p className="text-sm text-foreground italic leading-relaxed">&ldquo;{aboutMe}&rdquo;</p>
        </div>
      )}
      {personal && (
        <div>
          {personal.height != null && <DetailRow label="Height" value={cmToFtIn(personal.height)} />}
          {personal.maritalStatus && (
            <DetailRow label="Marital Status" value={personal.maritalStatus.replace(/_/g, ' ')} />
          )}
          {personal.motherTongue && <DetailRow label="Mother Tongue" value={personal.motherTongue} />}
          {personal.religion && <DetailRow label="Religion" value={personal.religion} />}
          {personal.caste && <DetailRow label="Community" value={personal.caste} />}
          {personal.subCaste && <DetailRow label="Sub Caste" value={personal.subCaste} />}
          {personal.gotra && <DetailRow label="Gotra" value={personal.gotra} />}
          {personal.manglik != null && (
            <DetailRow label="Manglik" value={personal.manglik ? 'Yes' : 'No'} />
          )}
        </div>
      )}
    </div>
  );
}

function FamilyTab({ family }: { family: FamilySection }) {
  return (
    <div>
      {family.familyType && <DetailRow label="Family Type" value={family.familyType.replace(/_/g, ' ')} />}
      {family.familyValues && <DetailRow label="Values" value={family.familyValues} />}
      {family.familyStatus && (
        <DetailRow label="Status" value={family.familyStatus.replace(/_/g, ' ')} />
      )}
      {family.nativePlace && <DetailRow label="Native Place" value={family.nativePlace} />}
      {family.fatherOccupation && (
        <DetailRow label="Father's Occupation" value={family.fatherOccupation} />
      )}
      {family.motherOccupation && (
        <DetailRow label="Mother's Occupation" value={family.motherOccupation} />
      )}
      {family.siblings && family.siblings.length > 0 && (
        <DetailRow
          label="Siblings"
          value={`${family.siblings.length} sibling${family.siblings.length > 1 ? 's' : ''}`}
        />
      )}
      {family.familyAbout && (
        <p className="mt-3 text-sm text-muted-foreground italic leading-relaxed border-t border-border-light pt-3">
          &ldquo;{family.familyAbout}&rdquo;
        </p>
      )}
    </div>
  );
}

function CareerTab({
  education,
  profession,
}: {
  education?: EducationSection;
  profession?: ProfessionSection;
}) {
  return (
    <div>
      {education?.degree && <DetailRow label="Degree" value={education.degree} />}
      {education?.fieldOfStudy && <DetailRow label="Field" value={education.fieldOfStudy} />}
      {education?.college && <DetailRow label="College" value={education.college} />}
      {education?.year && <DetailRow label="Graduation Year" value={String(education.year)} />}
      {profession?.occupation && <DetailRow label="Occupation" value={profession.occupation} />}
      {profession?.designation && <DetailRow label="Designation" value={profession.designation} />}
      {profession?.employer && <DetailRow label="Employer" value={profession.employer} />}
      {profession?.employerType && (
        <DetailRow label="Employer Type" value={profession.employerType.replace(/_/g, ' ')} />
      )}
      {profession?.incomeRange && <DetailRow label="Income Range" value={profession.incomeRange} />}
      {profession?.workLocation && <DetailRow label="Work Location" value={profession.workLocation} />}
      {profession?.workingAbroad && profession.abroadCountry && (
        <DetailRow label="Based In" value={profession.abroadCountry} />
      )}
    </div>
  );
}

function LifestyleTab({ lifestyle }: { lifestyle: LifestyleSection }) {
  return (
    <div className="flex flex-wrap gap-2">
      {lifestyle.diet && <Chip label={lifestyle.diet} teal />}
      {lifestyle.smoking && lifestyle.smoking !== 'NEVER' && (
        <Chip label={`Smoking: ${lifestyle.smoking.toLowerCase()}`} />
      )}
      {lifestyle.drinking && lifestyle.drinking !== 'NEVER' && (
        <Chip label={`Drinking: ${lifestyle.drinking.toLowerCase()}`} />
      )}
      {lifestyle.fitnessLevel && <Chip label={lifestyle.fitnessLevel} />}
      {lifestyle.ownHouse && <Chip label="Owns house" teal />}
      {lifestyle.ownCar && <Chip label="Owns car" />}
      {lifestyle.hobbies?.map((h) => <Chip key={h} label={h} teal />)}
      {lifestyle.interests?.map((i) => <Chip key={i} label={i} />)}
      {lifestyle.languagesSpoken?.map((l) => <Chip key={l} label={l} />)}
      {lifestyle.lifestyleTags?.map((t) => <Chip key={t} label={t.replace(/-/g, ' ')} teal />)}
    </div>
  );
}

function HoroscopeTab({
  horoscope,
  kundliUrl,
}: {
  horoscope: HoroscopeSection;
  kundliUrl?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        {horoscope.rashi && <DetailRow label="Rashi" value={horoscope.rashi} />}
        {horoscope.nakshatra && <DetailRow label="Nakshatra" value={horoscope.nakshatra} />}
        {horoscope.pob && <DetailRow label="Place of Birth" value={horoscope.pob} />}
        {horoscope.tob && <DetailRow label="Time of Birth" value={horoscope.tob} />}
        {horoscope.manglik && (
          <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border-light last:border-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 pt-0.5">
              Manglik
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                horoscope.manglik === 'YES'
                  ? 'bg-destructive/10 text-destructive'
                  : horoscope.manglik === 'NO'
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/15 text-warning'
              }`}
            >
              {horoscope.manglik}
            </span>
          </div>
        )}
        {horoscope.gunaScore != null && (
          <DetailRow label="Guna Score" value={`${horoscope.gunaScore}/36`} />
        )}
      </div>
      {kundliUrl && (
        <div className="border-t border-border-light pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Kundli Chart</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={kundliUrl}
            alt="Vedic kundli chart"
            className="w-full max-w-sm rounded-lg border border-border bg-background"
          />
        </div>
      )}
    </div>
  );
}

function PreferencesTab({
  partnerPreferences,
}: {
  partnerPreferences: PartnerPreferencesSection;
}) {
  return (
    <div>
      {partnerPreferences.ageRange && (
        <DetailRow
          label="Age"
          value={`${partnerPreferences.ageRange.min}–${partnerPreferences.ageRange.max} yrs`}
        />
      )}
      {partnerPreferences.heightRange && (
        <DetailRow
          label="Height"
          value={`${cmToFtIn(partnerPreferences.heightRange.min)} – ${cmToFtIn(partnerPreferences.heightRange.max)}`}
        />
      )}
      {partnerPreferences.manglik && (
        <DetailRow label="Manglik" value={partnerPreferences.manglik.replace(/_/g, ' ')} />
      )}
      {partnerPreferences.openToInterCaste != null && (
        <DetailRow
          label="Inter-caste"
          value={partnerPreferences.openToInterCaste ? 'Open' : 'Same community only'}
        />
      )}
      {partnerPreferences.openToInterfaith != null && (
        <DetailRow
          label="Inter-faith"
          value={partnerPreferences.openToInterfaith ? 'Open' : 'Same religion only'}
        />
      )}
      {partnerPreferences.religion && partnerPreferences.religion.length > 0 && (
        <DetailRow label="Religion" value={partnerPreferences.religion.join(', ')} />
      )}
      {partnerPreferences.education && partnerPreferences.education.length > 0 && (
        <DetailRow label="Education" value={partnerPreferences.education.join(', ')} />
      )}
      {partnerPreferences.diet && partnerPreferences.diet.length > 0 && (
        <DetailRow label="Diet" value={partnerPreferences.diet.join(', ')} />
      )}
      {partnerPreferences.maxDistanceKm && (
        <DetailRow label="Max Distance" value={`${partnerPreferences.maxDistanceKm} km`} />
      )}
      {partnerPreferences.partnerDescription && (
        <p className="mt-3 text-sm text-muted-foreground italic leading-relaxed border-t border-border-light pt-3">
          &ldquo;{partnerPreferences.partnerDescription}&rdquo;
        </p>
      )}
    </div>
  );
}

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
  // Build only the tabs that have data
  const hasAbout = !!(aboutMe || personal);
  const hasCareer = !!(education || profession);

  const tabs: TabDef[] = [
    hasAbout && { id: 'about' as TabId, label: 'About' },
    family && { id: 'family' as TabId, label: 'Family' },
    hasCareer && { id: 'career' as TabId, label: 'Career' },
    lifestyle && { id: 'lifestyle' as TabId, label: 'Lifestyle' },
    horoscope && { id: 'horoscope' as TabId, label: 'Horoscope' },
    partnerPreferences && { id: 'preferences' as TabId, label: 'Preferences' },
  ].filter((t): t is TabDef => Boolean(t));

  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id ?? 'about');
  const [animKey, setAnimKey] = useState(0);

  if (tabs.length === 0) return null;

  function switchTab(id: TabId) {
    setActiveTab(id);
    setAnimKey((k) => k + 1);
  }

  return (
    <Card className="overflow-hidden">
      {/* Tab strip */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-gold/20">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`flex-1 min-w-fit whitespace-nowrap px-4 py-3 text-xs font-semibold transition-colors duration-150 border-b-2 ${
                isActive
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-gold/40'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content with 150ms fade */}
      <div
        key={animKey}
        className="p-5"
        style={{ animation: 'fadeIn 150ms ease-out' }}
      >
        {activeTab === 'about' && (
          <AboutTab aboutMe={aboutMe} personal={personal} />
        )}
        {activeTab === 'family' && family && (
          <FamilyTab family={family} />
        )}
        {activeTab === 'career' && (
          <CareerTab education={education} profession={profession} />
        )}
        {activeTab === 'lifestyle' && lifestyle && (
          <LifestyleTab lifestyle={lifestyle} />
        )}
        {activeTab === 'horoscope' && horoscope && (
          <HoroscopeTab horoscope={horoscope} kundliUrl={kundliUrl} />
        )}
        {activeTab === 'preferences' && partnerPreferences && (
          <PreferencesTab partnerPreferences={partnerPreferences} />
        )}
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
