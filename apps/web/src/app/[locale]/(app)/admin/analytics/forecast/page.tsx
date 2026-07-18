/**
 * Admin Analytics — Platform Demand & Revenue Forecasts (Phase 5 · Unit 5.7).
 *
 * Server component: verifies admin/support role, fetches platform demand + revenue
 * forecast, and renders pure-SVG forecast charts + KPI summary. Deterministic
 * moving-average + seasonal-index forecasting (no LLM). Handles empty / error states.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { ForecastLineChart } from '@/components/analytics/ForecastLineChart.client';
import { ReportDownloadButton } from '@/components/reports/ReportDownloadButton';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

interface AdminForecastData {
  demand: {
    history: Array<{ month: string; count: number }>;
    forecast: number[];
    level: number;
  };
  revenue: {
    history: Array<{ month: string; revenue: number }>;
    forecast: number[];
    level: number;
  };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminAnalyticsForecast.metadata' });
  return { title: t('title') };
}

export default async function AdminAnalyticsForecastPage(): Promise<React.ReactNode> {
  const t = await getTranslations('adminAnalyticsForecast');
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN' && me.role !== 'SUPPORT') {
    return await redirect('/dashboard');
  }

  const forecast = await fetchAuth<AdminForecastData>('/api/v1/analytics/admin/forecast');

  if (!forecast) {
    return (
      <PageTransition className="space-y-6 p-4 sm:p-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('heading')}
          subtitle={t('subtitle')}
        />
        <div className="rounded-2xl border border-gold/20 bg-surface p-6 text-center">
          <p className="text-text-muted">
            {t('errorLoading')}
          </p>
        </div>
      </PageTransition>
    );
  }

  const { demand, revenue } = forecast;

  // Month-over-month growth when at least two months of history exist.
  const demandGrowth =
    demand.history.length >= 2
      ? ((demand.history[demand.history.length - 1]!.count - demand.history[demand.history.length - 2]!.count) /
          demand.history[demand.history.length - 2]!.count) * 100
      : null;

  const revenueGrowth =
    revenue.history.length >= 2
      ? ((revenue.history[revenue.history.length - 1]!.revenue - revenue.history[revenue.history.length - 2]!.revenue) /
          revenue.history[revenue.history.length - 2]!.revenue) * 100
      : null;

  const demandChart =
    demand.history.length > 0
      ? {
          label: t('bookingDemandForecast'),
          history: demand.history.map((h) => ({ month: h.month, value: h.count })),
          forecast: demand.forecast,
        }
      : null;

  const revenueChart =
    revenue.history.length > 0
      ? {
          label: t('revenueForecast'),
          history: revenue.history.map((h) => ({ month: h.month, value: h.revenue })),
          forecast: revenue.forecast,
          unit: 'rupees',
        }
      : null;

  return (
    <PageTransition className="space-y-8 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('heading')}
          subtitle={t('subtitle')}
        />
        <ReportDownloadButton
          path="/admin/platform-report"
          label={t('downloadPdf')}
          hint={t('downloadHint')}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
          <p className="text-sm text-text-muted">{t('currentMonthDemand')}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            {demand.level.toLocaleString('en-IN')} {t('bookings', { count: demand.level })}
          </p>
          {demandGrowth !== null && (
            <p className={`mt-1 text-xs inline-flex items-center gap-1 ${demandGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {demandGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              )}
              {t('momGrowth', { value: Math.abs(demandGrowth) / 100 })}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
          <p className="text-sm text-text-muted">{t('currentMonthRevenue')}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            ₹{revenue.level.toLocaleString('en-IN')}
          </p>
          {revenueGrowth !== null && (
            <p className={`mt-1 text-xs inline-flex items-center gap-1 ${revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {revenueGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              )}
              {t('momGrowth', { value: Math.abs(revenueGrowth) / 100 })}
            </p>
          )}
        </div>
      </div>

      {/* Demand Forecast */}
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-text-primary">{t('bookingDemandForecast')}</h2>
        <p className="text-sm text-text-muted">
          {t('demandSubtitle')}
        </p>
        <ForecastLineChart data={demandChart} />
      </div>

      {/* Revenue Forecast */}
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-text-primary">{t('revenueForecast')}</h2>
        <p className="text-sm text-text-muted">
          {t('revenueSubtitle')}
        </p>
        <ForecastLineChart data={revenueChart} />
      </div>

      {/* Insights */}
      <div className="space-y-4 rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
        <h3 className="font-heading font-semibold text-text-primary">{t('forecastInsights')}</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-text-primary">{t('seasonalityLabel')}</p>
            <p className="text-text-muted">
              {t('seasonalityDescription')}
            </p>
          </div>
          <div>
            <p className="font-medium text-text-primary">{t('trendLabel')}</p>
            <p className="text-text-muted">
              {t('trendDescription')}
            </p>
          </div>
          <div>
            <p className="font-medium text-text-primary">{t('updateFrequencyLabel')}</p>
            <p className="text-text-muted">
              {t('updateFrequencyDescription')}
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
