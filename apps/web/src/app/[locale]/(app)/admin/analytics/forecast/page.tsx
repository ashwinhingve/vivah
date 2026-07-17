/**
 * Admin Analytics — Platform Demand & Revenue Forecasts (Phase 5 · Unit 5.7).
 *
 * Server component: verifies admin/support role, fetches platform demand + revenue
 * forecast, and renders pure-SVG forecast charts + KPI summary. Deterministic
 * moving-average + seasonal-index forecasting (no LLM). Handles empty / error states.
 */

import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { ForecastLineChart } from '@/components/analytics/ForecastLineChart.client';

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

export default async function AdminAnalyticsForecastPage(): Promise<React.ReactNode> {
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN' && me.role !== 'SUPPORT') {
    return await redirect('/dashboard');
  }

  const forecast = await fetchAuth<AdminForecastData>('/api/v1/analytics/admin/forecast');

  if (!forecast) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Platform Analytics Forecast</h1>
        <div className="rounded-2xl border border-gold/20 bg-surface p-6 text-center">
          <p className="text-text-muted">
            Unable to load forecast data. Admin or Support role required, and at least one
            month of platform history.
          </p>
        </div>
      </div>
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
          label: 'Monthly Demand',
          history: demand.history.map((h) => ({ month: h.month, value: h.count })),
          forecast: demand.forecast,
        }
      : null;

  const revenueChart =
    revenue.history.length > 0
      ? {
          label: 'Monthly Revenue',
          history: revenue.history.map((h) => ({ month: h.month, value: h.revenue })),
          forecast: revenue.forecast,
          unit: 'rupees',
        }
      : null;

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-text-primary">Platform Analytics</h1>
        <p className="mt-2 text-text-muted">6-month demand and revenue forecasts.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
          <p className="text-sm text-text-muted">Current Month Demand</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            {demand.level.toLocaleString('en-IN')} bookings
          </p>
          {demandGrowth !== null && (
            <p className={`mt-1 text-xs ${demandGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {demandGrowth >= 0 ? '↑' : '↓'} {Math.abs(demandGrowth).toFixed(1)}% MoM
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
          <p className="text-sm text-text-muted">Current Month Revenue</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            Rs. {revenue.level.toLocaleString('en-IN')}
          </p>
          {revenueGrowth !== null && (
            <p className={`mt-1 text-xs ${revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(revenueGrowth).toFixed(1)}% MoM
            </p>
          )}
        </div>
      </div>

      {/* Demand Forecast */}
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-text-primary">Booking Demand Forecast</h2>
        <p className="text-sm text-text-muted">
          Projected booking volume over the next 6 months with seasonal adjustment.
        </p>
        <ForecastLineChart data={demandChart} />
      </div>

      {/* Revenue Forecast */}
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-text-primary">Revenue Forecast</h2>
        <p className="text-sm text-text-muted">
          Projected captured revenue with seasonal patterns accounted for.
        </p>
        <ForecastLineChart data={revenueChart} />
      </div>

      {/* Insights */}
      <div className="space-y-4 rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
        <h3 className="font-heading font-semibold text-text-primary">Forecast Insights</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-text-primary">Seasonality</p>
            <p className="text-text-muted">
              Demand and revenue patterns detect 12-month seasonality cycles. Peaks typically
              align with wedding seasons (Dec–Jan, May–Jun).
            </p>
          </div>
          <div>
            <p className="font-medium text-text-primary">Trend</p>
            <p className="text-text-muted">
              A moving average of recent months sets the baseline level; the 6-month projection
              applies seasonal indices to that level.
            </p>
          </div>
          <div>
            <p className="font-medium text-text-primary">Update Frequency</p>
            <p className="text-text-muted">
              Forecasts refresh as new booking and payment data arrives. Monthly review
              recommended for strategic planning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
