import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Calendar } from 'lucide-react';
import { HeatmapCalendar } from './HeatmapCalendar.client';

// Reads per-user cookies via headers() → must render dynamically, not statically.
export const dynamic = 'force-dynamic';

interface HeatmapDay {
  date: string;
  auspiciousBand: string;
  kinds: Array<{ kind: string; count: number }>;
  demand: number;
}

interface HeatmapResponse {
  success: boolean;
  data: {
    month: string;
    days: HeatmapDay[];
    regionFilter?: string;
    communityFilter?: string;
  };
  meta?: { cached?: boolean };
}

async function fetchHeatmap(month: string): Promise<HeatmapDay[] | null> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    const res = await fetch(`${apiBase}/api/v1/calendar/heatmap?month=${month}`, {
      cache: 'no-store',
      headers: { cookie },
    });
    if (!res.ok) {
      console.error('[calendar] heatmap fetch failed:', res.status);
      return null;
    }
    const json = (await res.json()) as HeatmapResponse;
    if (!json.success || !json.data) return null;
    return json.data.days;
  } catch (e) {
    console.error('[calendar] heatmap fetch error:', e);
    return null;
  }
}

export function generateMetadata(): Metadata {
  return {
    title: 'Calendar Intelligence',
    description: 'View auspicious dates, festivals, and important events for your wedding planning',
  };
}

export default async function CalendarPage() {
  // Get current month in YYYY-MM format
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const days = await fetchHeatmap(month);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Calendar Intelligence"
        subtitle="Auspicious dates, festivals, and important events for your wedding"
      />

      {!days || days.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events found"
          description="There are no calendar events available for the selected month"
        />
      ) : (
        <div className="mt-8">
          <HeatmapCalendar days={days} month={month} />
        </div>
      )}
    </main>
  );
}
