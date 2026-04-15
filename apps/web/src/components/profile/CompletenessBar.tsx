// apps/web/src/components/profile/CompletenessBar.tsx

import type { ProfileSectionCompletion } from '@smartshaadi/types';

interface Props {
  sections: ProfileSectionCompletion;
}

const SEGMENTS: { key: keyof Omit<ProfileSectionCompletion, 'score'>; label: string }[] = [
  { key: 'personal',    label: 'Personal'    },
  { key: 'photos',      label: 'Photos'      },
  { key: 'family',      label: 'Family'      },
  { key: 'career',      label: 'Career'      },
  { key: 'lifestyle',   label: 'Lifestyle'   },
  { key: 'horoscope',   label: 'Horoscope'   },
  { key: 'preferences', label: 'Preferences' },
];

export function CompletenessBar({ sections }: Props) {
  return (
    <div className="rounded-xl border border-[#E8E0D8] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#2E2E38]">Profile Completeness</p>
        <span className="text-sm font-bold text-[#059669]">{sections.score}%</span>
      </div>

      {/* Overall progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E0D8] mb-4">
        <div
          className="h-full rounded-full bg-[#059669] transition-all duration-300"
          style={{ width: `${sections.score}%` }}
        />
      </div>

      {/* Per-section chips */}
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map(({ key, label }) => (
          <div
            key={key}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              sections[key]
                ? 'bg-[#ECFDF5] text-[#059669]'
                : 'bg-[#E8E0D8] text-[#6B6B76]'
            }`}
          >
            <span className={sections[key] ? 'text-[#059669]' : 'text-[#6B6B76]'}>
              {sections[key] ? '✓' : '○'}
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
