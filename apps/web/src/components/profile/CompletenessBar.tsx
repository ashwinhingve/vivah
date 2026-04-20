// apps/web/src/components/profile/CompletenessBar.tsx

import Link from 'next/link';
import type { ProfileSectionCompletion } from '@smartshaadi/types';

interface Props {
  sections: ProfileSectionCompletion;
}

const SEGMENTS: { key: keyof Omit<ProfileSectionCompletion, 'score'>; label: string; href: string }[] = [
  { key: 'personal',    label: 'Personal',    href: '/profile/personal'    },
  { key: 'photos',      label: 'Photos',      href: '/profile/photos'      },
  { key: 'family',      label: 'Family',      href: '/profile/family'      },
  { key: 'career',      label: 'Career',      href: '/profile/career'      },
  { key: 'lifestyle',   label: 'Lifestyle',   href: '/profile/lifestyle'   },
  { key: 'horoscope',   label: 'Horoscope',   href: '/profile/horoscope'   },
  { key: 'preferences', label: 'Preferences', href: '/profile/preferences' },
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

      {/* Per-section chips — each links to its onboarding step */}
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              sections[key]
                ? 'bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5]'
                : 'bg-[#E8E0D8] text-[#6B6B76] hover:bg-[#D9CFC0]'
            }`}
          >
            <span className={sections[key] ? 'text-[#059669]' : 'text-[#6B6B76]'}>
              {sections[key] ? '✓' : '○'}
            </span>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
