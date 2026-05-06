import { MaskedField } from '@/components/shared/MaskedField';

export interface ProfileInfoData {
  heightInches?: number | null;
  religion?: string | null;
  community?: string | null;
  diet?: 'veg' | 'non-veg' | 'eggetarian' | 'jain' | 'vegan' | null;
  education?: string | null;
  incomeMin?: number | null;
  incomeMax?: number | null;
  motherTongue?: string | null;
  phone?: string | null;
  phoneUnlocked?: boolean;
  email?: string | null;
  emailUnlocked?: boolean;
  about?: string | null;
}

const dietLabels: Record<NonNullable<ProfileInfoData['diet']>, string> = {
  veg: 'Vegetarian',
  'non-veg': 'Non-vegetarian',
  eggetarian: 'Eggetarian',
  jain: 'Jain',
  vegan: 'Vegan',
};

function formatHeight(totalInches?: number | null): string | null {
  if (totalInches == null || totalInches <= 0) return null;
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${ft}' ${inches}"`;
}

function formatINR(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1).replace(/\.0$/, '')} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1).replace(/\.0$/, '')} K`;
  return `₹${new Intl.NumberFormat('en-IN').format(amount)}`;
}

function formatINRRange(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `${formatINR(min)}–${formatINR(max).replace('₹', '')}`;
  return formatINR((min ?? max) as number);
}

export function ProfileInfoGrid({ info }: { info: ProfileInfoData }) {
  const heightLabel = formatHeight(info.heightInches);
  const religionLabel =
    info.religion && info.community
      ? `${info.religion} · ${info.community}`
      : info.religion ?? null;
  const dietLabel = info.diet ? dietLabels[info.diet] : null;
  const incomeLabel = formatINRRange(info.incomeMin, info.incomeMax);

  return (
    <div className="px-6 py-5">
      <h2 className="font-heading text-lg font-semibold text-fg-1">About</h2>
      {info.about ? (
        <p className="mt-2 text-sm leading-relaxed text-fg-1">{info.about}</p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-fg-2 italic">No bio added yet.</p>
      )}

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
        <Cell label="Height" value={heightLabel} />
        <Cell label="Religion" value={religionLabel} />
        <Cell label="Diet" value={dietLabel} />
        <Cell label="Education" value={info.education ?? null} />
        <Cell label="Income" value={incomeLabel} />
        <Cell label="Mother tongue" value={info.motherTongue ?? null} />
        <MaskedCell
          label="Phone"
          value={info.phone}
          unlocked={info.phoneUnlocked}
          kind="phone"
        />
        <MaskedCell
          label="Email"
          value={info.email}
          unlocked={info.emailUnlocked}
          kind="email"
        />
      </dl>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-2">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-fg-1">{value ?? '—'}</dd>
    </div>
  );
}

function MaskedCell({
  label,
  value,
  unlocked,
  kind,
}: {
  label: string;
  value: string | null | undefined;
  unlocked?: boolean;
  kind: 'phone' | 'email';
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-2">{label}</dt>
      <dd className="mt-0.5">
        {value ? (
          <MaskedField value={value} kind={kind} unlocked={!!unlocked} />
        ) : (
          <span className="text-sm text-fg-2">—</span>
        )}
      </dd>
    </div>
  );
}
