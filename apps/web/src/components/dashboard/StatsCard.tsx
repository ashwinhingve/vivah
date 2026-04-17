interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatsCard({ label, value, sub, accent = false }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-[#E8E0D8] bg-white p-4 flex flex-col gap-1">
      <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">{label}</p>
      <p
        className={`text-2xl font-bold font-heading ${accent ? 'text-[#059669]' : 'text-[#2E2E38]'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[#6B6B76]">{sub}</p>}
    </div>
  );
}
