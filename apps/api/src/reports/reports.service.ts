/**
 * Smart Shaadi — Reports Service
 *
 * Orchestrates analytics data retrieval and PDF generation for reports.
 * Two audiences: PLATFORM (admin/support) and VENDOR (owner or admin/support).
 *
 * This layer calls the analytics service (which already handles aggregation)
 * and combines the result with metadata to pass to the PDF renderer.
 */

import type { ProfileId } from '@smartshaadi/types';
import type { ReportMeta } from '@smartshaadi/types';
import {
  getAdminForecast,
  getVendorForecast,
  AnalyticsServiceError,
} from '../analytics/analytics.service.js';
import { generateReportPdf } from './report-pdf.js';
import type { PlatformReportData, VendorReportData } from './report-pdf.js';

export class ReportsServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ReportsServiceError';
  }
}

/**
 * Generate a platform report (admin/support only).
 * Fetches platform-wide demand + revenue forecasts and renders to PDF.
 *
 * @param period Optional { from: YYYY-MM, to: YYYY-MM }. Defaults to 12 months before current month.
 * @returns Buffer — the rendered PDF bytes
 */
export async function generatePlatformReport(period?: {
  from?: string;
  to?: string;
}): Promise<Buffer> {
  try {
    // Default to current month or provided 'to', 12 months back for 'from'
    const now = new Date();
    const toMonth = period?.to ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const parts = toMonth.split('-').map(x => parseInt(x, 10));
    const toYear = parts[0]!;
    const toMonthNum = parts[1]!;

    let fromMonth: string;
    if (period?.from) {
      fromMonth = period.from;
    } else {
      // 12 months ago
      let year = toYear;
      let month = toMonthNum - 12;
      if (month <= 0) {
        year--;
        month += 12;
      }
      fromMonth = `${year}-${String(month).padStart(2, '0')}`;
    }

    // Fetch platform forecast data
    const forecast = await getAdminForecast();

    // Build metadata
    const meta: ReportMeta = {
      kind: 'PLATFORM',
      title: 'Platform Analytics Report',
      subject: 'Smart Shaadi',
      period: { from: fromMonth, to: toMonth },
      generatedAt: new Date().toISOString(),
      horizon: 6,
    };

    const reportData: PlatformReportData = {
      meta,
      demand: forecast.demand,
      revenue: forecast.revenue,
    };

    return generateReportPdf(reportData);
  } catch (e) {
    if (e instanceof AnalyticsServiceError) {
      throw new ReportsServiceError(e.code, e.message);
    }
    throw e;
  }
}

/**
 * Generate a vendor report (owner or admin/support).
 * Fetches vendor-specific utilization + revenue forecasts and renders to PDF.
 *
 * @param vendorId vendors.id UUID
 * @param profileId The vendor's owning profile UUID (use to resolve capacity by profileId)
 * @param vendorBusinessName Vendor's display name (for the report cover)
 * @param period Optional { from: YYYY-MM, to: YYYY-MM }. Defaults to 12 months before current month.
 * @returns Buffer — the rendered PDF bytes
 */
export async function generateVendorReport(
  vendorId: string,
  profileId: ProfileId,
  vendorBusinessName: string,
  period?: {
    from?: string;
    to?: string;
  },
): Promise<Buffer> {
  try {
    // Default to current month or provided 'to', 12 months back for 'from'
    const now = new Date();
    const toMonth = period?.to ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const parts = toMonth.split('-').map(x => parseInt(x, 10));
    const toYear = parts[0]!;
    const toMonthNum = parts[1]!;

    let fromMonth: string;
    if (period?.from) {
      fromMonth = period.from;
    } else {
      // 12 months ago
      let year = toYear;
      let month = toMonthNum - 12;
      if (month <= 0) {
        year--;
        month += 12;
      }
      fromMonth = `${year}-${String(month).padStart(2, '0')}`;
    }

    // Fetch vendor forecast data
    const forecast = await getVendorForecast(vendorId, profileId);

    // Build metadata
    const meta: ReportMeta = {
      kind: 'VENDOR',
      title: 'Vendor Performance Report',
      subject: vendorBusinessName,
      period: { from: fromMonth, to: toMonth },
      generatedAt: new Date().toISOString(),
      horizon: 6,
    };

    const reportData: VendorReportData = {
      meta,
      utilization: forecast.utilization,
      revenue: forecast.revenue,
    };

    return generateReportPdf(reportData);
  } catch (e) {
    if (e instanceof AnalyticsServiceError) {
      throw new ReportsServiceError(e.code, e.message);
    }
    throw e;
  }
}
