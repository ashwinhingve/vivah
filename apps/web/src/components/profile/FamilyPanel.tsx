interface FamilyData {
  father?: string | null;
  mother?: string | null;
  siblings?: string | null;
  values?: 'traditional' | 'moderate' | 'liberal' | null;
}

const valueLabels: Record<NonNullable<FamilyData['values']>, string> = {
  traditional: 'Traditional',
  moderate: 'Moderate',
  liberal: 'Liberal',
};

export function FamilyPanel({ family }: { family: FamilyData }) {
  const rows: { label: string; value?: string | null }[] = [
    { label: 'Father', value: family.father },
    { label: 'Mother', value: family.mother },
    { label: 'Siblings', value: family.siblings },
    { label: 'Family values', value: family.values ? valueLabels[family.values] : null },
  ];

  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <h3 className="font-heading text-lg font-semibold text-fg-1">Family</h3>
      <dl className="mt-3.5 flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-baseline justify-between ${
              i < rows.length - 1 ? 'border-b border-border-light pb-2.5' : ''
            }`}
          >
            <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-2">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-fg-1">{row.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
