/**
 * Vendor Utilization — Eligible off-season event opportunities
 *
 * Shows ranked capacity windows available for non-wedding event routing.
 * API route is unmounted during Phase 5 development, so data integration
 * is placeheld with graceful empty state + contract documentation.
 */

import { type ReactNode } from 'react';
import { redirect } from '@/i18n/redirect';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { Calendar, TrendingUp, Zap } from 'lucide-react';
import type { VendorCapacityWindow } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

interface UtilizationOpportunity {
  window: VendorCapacityWindow;
  eventTypeMatch: string;
  remainingCapacity: number;
  utilizationScore: number;
}

interface UtilizationResponse {
  opportunities: UtilizationOpportunity[];
  count: number;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getEventTypeLabel(eventType: string): string {
  return eventType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Score badge: represents utilization fit (0..1).
 * Green for high, amber for mid, muted for low.
 */
function ScoreBadge({ score }: { score: number }): ReactNode {
  let bgClass = 'bg-gold/15 text-gold-muted';
  if (score >= 0.75) bgClass = 'bg-green-100 text-green-700';
  else if (score >= 0.5) bgClass = 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${bgClass}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}

/**
 * Window card: shows capacity, date range, score.
 */
function CapacityWindowCard({
  opp,
  index,
  t,
}: {
  opp: UtilizationOpportunity;
  index: number;
  t: (key: string) => string;
}): ReactNode {
  const { window, eventTypeMatch, remainingCapacity, utilizationScore } = opp;
  const startDate = formatDate(window.startAt);
  const startTime = formatTime(window.startAt);
  const endTime = formatTime(window.endAt);

  return (
    <div
      key={window.id}
      className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card transition-all hover:shadow-card-hover sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {index + 1}
            </span>
            <h3 className="font-heading text-lg font-semibold text-primary">
              {getEventTypeLabel(eventTypeMatch)}
            </h3>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <p className="text-text-muted">{t('date')}</p>
                <p className="font-semibold text-text-primary">{startDate}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <p className="text-text-muted">{t('capacity')}</p>
                <p className="font-semibold text-text-primary">
                  {remainingCapacity} of {window.maxBookings}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <p className="text-text-muted">{t('time')}</p>
                <p className="font-semibold text-text-primary">
                  {startTime} – {endTime}
                </p>
              </div>
            </div>
          </div>

          {window.notes && (
            <p className="mt-3 text-sm text-text-muted">{window.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <p className="text-xs uppercase tracking-wide text-text-muted">{t('fitScore')}</p>
          <ScoreBadge score={utilizationScore} />
        </div>
      </div>
    </div>
  );
}

export function generateMetadata() {
  return {
    title: 'Off-Season Opportunities — Smart Shaadi',
    description: 'View eligible events matched to your available capacity windows during off-peak periods',
  };
}

export default async function UtilizationPage() {
  const t = await getTranslations('vendorUtilization');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  // Guard: ensure vendor access
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me', token);
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  // Fetch utilization opportunities
  // NOTE: API route is unmounted during Phase 5 — data will be null until Phase 2 mounts the router.
  // In production, this would return ranked windows. For now, we gracefully show empty state.
  const data = await fetchAuth<UtilizationResponse>(
    '/api/v1/vendors/utilization',
    token,
  );

  const opportunities = data?.opportunities ?? [];
  const countByType = new Map<string, number>();
  opportunities.forEach((opp) => {
    const type = opp.eventTypeMatch;
    countByType.set(type, (countByType.get(type) ?? 0) + 1);
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('heading')}
          subtitle={t('subtitle')}
        />

        {/* Summary cards */}
        {opportunities.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
              <p className="text-sm text-text-muted">{t('totalOpportunities')}</p>
              <p className="mt-1 font-heading text-3xl font-semibold text-primary">
                {opportunities.length}
              </p>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
              <p className="text-sm text-text-muted">{t('eventCategories')}</p>
              <p className="mt-1 font-heading text-3xl font-semibold text-primary">
                {countByType.size}
              </p>
            </div>
          </div>
        )}

        {/* Opportunities list or empty state */}
        <div>
          <SectionHeader
            title={opportunities.length > 0 ? t('rankedWindowsTitle') : 'No Opportunities'}
            subtitle={
              opportunities.length > 0
                ? t('rankedWindowsSubtitle')
                : "We'll notify you when new off-season events match your availability."
            }
          />

          {opportunities.length > 0 ? (
            <StaggerList className="mt-4 space-y-4">
              {opportunities.map((opp, idx) => (
                <CapacityWindowCard key={opp.window.id} opp={opp} index={idx} t={t} />
              ))}
            </StaggerList>
          ) : (
            <div className="mt-4">
              <EmptyState
                variant="no-leads"
                title={t('noOpportunitiesTitle')}
                description={t('noOpportunitiesDescription')}
              />
            </div>
          )}
        </div>

        {/* Debug note (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <strong>Dev note:</strong> {t('devNote')}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
