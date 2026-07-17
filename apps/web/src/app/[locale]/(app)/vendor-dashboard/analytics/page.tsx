/**
 * Vendor Analytics Dashboard — Utilization & Revenue Forecasts (Phase 5 · Unit 5.7).
 *
 * Server component: resolves the current vendor, fetches its utilization + revenue
 * forecast, and renders pure-SVG forecast charts. Deterministic moving-average +
 * seasonal-index forecasting (no LLM). Handles empty / error states.
 */

import { fetchAuth } from '@/lib/server-fetch';
import { ForecastLineChart } from '@/components/analytics/ForecastLineChart.client';

interface VendorForecastData {
  utilization: {
    history: Array<{ month: string; utilization: number }>;
    forecast: number[];
    level: number;
  };
  revenue: {
    history: Array<{ month: string; revenue: number }>;
    forecast: number[];
    level: number;
  };
}

export default async function VendorAnalyticsPage(): Promise<React.ReactNode> {
  const vendor = await fetchAuth<{ id: string }>('/api/v1/vendors/me');

  if (!vendor?.id) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Analytics</h1>
        <div className="rounded-2xl border border-gold/20 bg-surface p-6 text-center">
          <p className="text-text-muted">
            Unable to load your vendor profile. Please ensure you are signed in as a vendor.
          </p>
        </div>
      </div>
    );
  }

  const forecast = await fetchAuth<VendorForecastData>(
    `/api/v1/analytics/vendors/${vendor.id}/forecast`,
  );

  if (!forecast) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Analytics</h1>
        <div className="rounded-2xl border border-gold/20 bg-surface p-6 text-center">
          <p className="text-text-muted">No forecast data available yet.</p>
          <p className="mt-2 text-sm text-gold-muted">
            Forecasts appear once you have at least one month of booking history.
          </p>
        </div>
      </div>
    );
  }

  const { utilization, revenue } = forecast;

  // Chart expects { month, value }. Utilization is 0..1 — show as a percentage.
  const utilizationChart =
    utilization.history.length > 0
      ? {
          label: 'Capacity Utilization',
          history: utilization.history.map((h) => ({ month: h.month, value: h.utilization * 100 })),
          forecast: utilization.forecast.map((v) => v * 100),
          unit: 'percent',
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
        <h1 className="font-heading text-3xl font-bold text-text-primary">Analytics Dashboard</h1>
        <p className="mt-2 text-text-muted">View your booking patterns and 6-month forecasts.</p>
      </div>

      {/* Utilization Forecast */}
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-text-primary">Capacity Utilization</h2>
        <p className="text-sm text-text-muted">
          Current utilization: {(utilization.level * 100).toFixed(1)}% of available slots
        </p>
        <ForecastLineChart data={utilizationChart} />
      </div>

      {/* Revenue Forecast */}
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-text-primary">Revenue Trend</h2>
        <p className="text-sm text-text-muted">
          Current month: Rs. {revenue.level.toLocaleString('en-IN')}
        </p>
        <ForecastLineChart data={revenueChart} />
      </div>

      {/* Methodology */}
      <div className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
        <h3 className="font-heading font-semibold text-text-primary">Forecast Methodology</h3>
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          <li>• 12-month seasonal decomposition captures recurring demand patterns.</li>
          <li>• A moving average of the recent 3 months sets the baseline level.</li>
          <li>• The 6-month projection combines that level with seasonal indices.</li>
          <li>• Updates monthly as new booking data arrives.</li>
        </ul>
      </div>
    </div>
  );
}
