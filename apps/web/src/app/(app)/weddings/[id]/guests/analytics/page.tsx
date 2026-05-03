import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { RsvpDeadlineCard } from '@/components/wedding/RsvpDeadlineCard.client';
import type { RsvpAnalytics, RsvpDeadline, MealPref, RsvpStatus } from '@smartshaadi/types';

const RSVP_LABEL: Record<RsvpStatus, string> = {
  YES: 'Attending', NO: 'Declined', MAYBE: 'Maybe', PENDING: 'Pending',
};

const MEAL_LABEL: Record<MealPref, string> = {
  VEG: 'Veg', NON_VEG: 'Non-Veg', JAIN: 'Jain', VEGAN: 'Vegan', EGGETARIAN: 'Eggetarian', NO_PREFERENCE: 'No preference',
};

interface PageProps { params: Promise<{ id: string }>; }

export default async function GuestAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  const [analytics, deadline] = await Promise.all([
    fetchAuth<RsvpAnalytics>(`/api/v1/weddings/${id}/guests/analytics`),
    fetchAuth<RsvpDeadline | null>(`/api/v1/weddings/${id}/rsvp-deadline`),
  ]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}/guests`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-6 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Guests
        </Link>

        <h1 className="font-heading text-2xl text-[#7B2D42] mb-1">RSVP Analytics</h1>
        <p className="text-muted-foreground text-sm mb-6">Real-time view of how your guest list is responding.</p>

        <RsvpDeadlineCard weddingId={id} initial={deadline} />

        {!analytics || analytics.totalGuests === 0 ? (
          <div className="bg-surface border border-dashed border-[#C5A47E]/30 rounded-xl p-10 text-center mt-6">
            <p className="text-muted-foreground text-sm">No guests yet. Add some to see analytics.</p>
          </div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 mt-6">
              <Stat label="Total" value={analytics.totalGuests} />
              <Stat label="Invited" value={analytics.invited} />
              <Stat label="Responded" value={analytics.responded} subtle={`${Math.round(analytics.responseRate * 100)}%`} />
              <Stat label="Forecast" value={analytics.attendanceForecast} subtle="expected" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card title="By RSVP status">
                <div className="space-y-2 text-sm">
                  {(Object.keys(analytics.byStatus) as RsvpStatus[]).map(s => (
                    <Bar key={s} label={RSVP_LABEL[s]} value={analytics.byStatus[s]} max={analytics.totalGuests} />
                  ))}
                </div>
              </Card>

              <Card title="By meal preference">
                <div className="space-y-2 text-sm">
                  {(Object.keys(analytics.byMealPref) as MealPref[]).map(m => (
                    <Bar key={m} label={MEAL_LABEL[m]} value={analytics.byMealPref[m]} max={analytics.totalGuests} color="#0E7C7B" />
                  ))}
                </div>
              </Card>

              <Card title="By side">
                <div className="space-y-2 text-sm">
                  {(['BRIDE', 'GROOM', 'BOTH', 'UNKNOWN'] as const).map(s => (
                    <Bar key={s} label={s === 'UNKNOWN' ? 'Unspecified' : s} value={analytics.bySide[s]} max={analytics.totalGuests} color="#7B2D42" />
                  ))}
                </div>
              </Card>

              <Card title="Check-in (day-of)">
                <div className="text-3xl font-semibold text-[#0E7C7B]">{analytics.checkedIn}<span className="text-base text-muted-foreground"> / {analytics.totalGuests}</span></div>
                <p className="text-sm text-muted-foreground mt-1">Guests checked in</p>
              </Card>
            </div>

            {analytics.timeline.length > 0 && (
              <Card title="Response timeline">
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {analytics.timeline.map(t => {
                    const total = Math.max(t.sent, t.responded, 1);
                    return (
                      <div key={t.date} className="flex items-center gap-2">
                        <span className="w-20 text-muted-foreground">{t.date}</span>
                        <div className="flex-1 h-3 bg-secondary rounded overflow-hidden relative">
                          <div className="absolute inset-y-0 left-0 bg-[#C5A47E]/40" style={{ width: `${(t.sent / total) * 100}%` }} />
                          <div className="absolute inset-y-0 left-0 bg-[#0E7C7B]/70" style={{ width: `${(t.responded / total) * 100}%` }} />
                        </div>
                        <span className="w-20 text-right text-muted-foreground">{t.responded}/{t.sent}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {(analytics.topDietary.length > 0 || analytics.topAccessibility.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {analytics.topDietary.length > 0 && (
                  <Card title="Top dietary notes">
                    <ul className="text-sm space-y-1">
                      {analytics.topDietary.map(d => <li key={d.note} className="flex justify-between"><span>{d.note}</span><span className="text-muted-foreground">{d.count}</span></li>)}
                    </ul>
                  </Card>
                )}
                {analytics.topAccessibility.length > 0 && (
                  <Card title="Top accessibility notes">
                    <ul className="text-sm space-y-1">
                      {analytics.topAccessibility.map(d => <li key={d.note} className="flex justify-between"><span>{d.note}</span><span className="text-muted-foreground">{d.count}</span></li>)}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, subtle }: { label: string; value: number | string; subtle?: string }) {
  return (
    <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold text-[#0A1F4D]">{value}</div>
      {subtle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtle}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4">
      <h3 className="font-medium text-sm text-[#7B2D42] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Bar({ label, value, max, color = '#0A1F4D' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-secondary rounded mt-1 overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
