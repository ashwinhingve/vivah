'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface Props {
  fromDate: string;
  toDate:   string;
}

export function DateRangePicker({ fromDate, toDate }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground font-medium">
        From
        <input
          type="date"
          defaultValue={fromDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => update('fromDate', e.target.value)}
          className="min-h-[36px] rounded-lg border border-gold/50 px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground font-medium">
        To
        <input
          type="date"
          defaultValue={toDate}
          min={fromDate || new Date().toISOString().slice(0, 10)}
          onChange={(e) => update('toDate', e.target.value)}
          className="min-h-[36px] rounded-lg border border-gold/50 px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </label>
    </div>
  );
}
