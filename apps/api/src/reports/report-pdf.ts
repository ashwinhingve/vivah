/**
 * PDF Report Generator — Platform & Vendor analytics
 *
 * Generates two classes of reports using analytics data already computed
 * by apps/api/src/analytics/:
 *   - PLATFORM: platform-wide demand + revenue (admin/support only)
 *   - VENDOR: vendor-specific utilization + revenue (owner or admin/support)
 *
 * Each report includes:
 *   - Cover page (title, subject, period, generated timestamp, forecast horizon)
 *   - KPI summary table (historical high/low/avg + current month level + 6-month forecast level)
 *   - Month-by-month detail table (history + forecast rows)
 */

import PDFDocument from 'pdfkit';
import { BURGUNDY, GOLD, INK, MUTED, PAD } from '../lib/pdf/brand.js';
import { formatRupees, renderBuffer } from '../lib/pdf/format.js';
import type { ReportMeta } from '@smartshaadi/types';

/** Platform report data shape — from getAdminForecast() */
export interface PlatformReportData {
  meta: ReportMeta;
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

/** Vendor report data shape — from getVendorForecast() */
export interface VendorReportData {
  meta: ReportMeta;
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

export type ReportData = PlatformReportData | VendorReportData;

/**
 * One month of a metric series. Exactly one of count / revenue / utilization is
 * populated, depending on which analytics series the point came from — the KPI
 * renderer is shared across all three, so it reads whichever is present.
 */
export interface SeriesPoint {
  month:        string;
  count?:       number;
  revenue?:     number;
  utilization?: number;
}

/** A metric series plus its forecast, as returned by the analytics layer. */
export interface MetricSeries {
  history:  SeriesPoint[];
  forecast: number[];
  level:    number;
}

/**
 * Check if data is a PlatformReportData by checking for 'demand' property
 */
function isPlatformReport(data: ReportData): data is PlatformReportData {
  return 'demand' in data;
}

/**
 * Generate a PDF report (PLATFORM or VENDOR) from pre-computed analytics data.
 *
 * @param data Pre-aggregated forecast data with metadata
 * @returns Promise<Buffer> — the rendered PDF bytes
 */
export async function generateReportPdf(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: PAD });

  return renderBuffer(doc, (doc, { W }) => {
    const innerW = W - PAD * 2;
    let y = doc.y;

    // ── Cover Page ────────────────────────────────────────────────────────────
    renderCoverPage(doc, data, W, innerW, PAD);

    // ── Page 2: KPI Summary Table ─────────────────────────────────────────────
    doc.addPage();
    y = PAD;

    doc.fillColor(BURGUNDY)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Key Performance Indicators', PAD, y);
    y = doc.y + 12;

    renderKpiTable(doc, data, W, innerW, PAD);

    // ── Page 3+: Month-by-Month Detail ────────────────────────────────────────
    doc.addPage();
    y = PAD;

    doc.fillColor(BURGUNDY)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Month-by-Month Breakdown', PAD, y);
    y = doc.y + 12;

    renderDetailTable(doc, data, W, innerW, PAD);
  });
}

/**
 * Render the cover page with title, subject, period, and metadata
 */
function renderCoverPage(
  doc: PDFKit.PDFDocument,
  data: ReportData,
  W: number,
  innerW: number,
  pad: number,
): void {
  let y = doc.page.height / 3;

  // Title
  doc.fillColor(BURGUNDY)
    .fontSize(36)
    .font('Helvetica-Bold')
    .text(data.meta.title, pad, y, { width: innerW, align: 'center' });
  y = doc.y + 16;

  // Subject
  doc.fillColor(GOLD)
    .fontSize(20)
    .font('Helvetica')
    .text(data.meta.subject, pad, y, { width: innerW, align: 'center' });
  y = doc.y + 24;

  // Divider
  doc.lineWidth(1.5)
    .strokeColor(GOLD)
    .moveTo(pad, y)
    .lineTo(W - pad, y)
    .stroke();

  y += 20;

  // Report metadata
  doc.fillColor(INK)
    .fontSize(11)
    .font('Helvetica');

  const periodText = `Report Period: ${data.meta.period.from} to ${data.meta.period.to}`;
  doc.text(periodText, pad, y, { width: innerW, align: 'center' });
  y = doc.y + 4;

  const generatedText = `Generated: ${new Date(data.meta.generatedAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })}`;
  doc.text(generatedText, pad, y, { width: innerW, align: 'center' });
  y = doc.y + 4;

  const horizonText = `Forecast Horizon: ${data.meta.horizon} months`;
  doc.text(horizonText, pad, y, { width: innerW, align: 'center' });
}

/**
 * Render KPI summary table (high/low/avg from history + current level + forecast endpoint)
 */
function renderKpiTable(
  doc: PDFKit.PDFDocument,
  data: ReportData,
  W: number,
  innerW: number,
  pad: number,
): void {
  void W; // W is used for line positioning, mark as intentionally used

  if (isPlatformReport(data)) {
    // Platform: demand and revenue metrics
    renderKpiRow(doc, 'Booking Demand', data.demand, false, pad, innerW);
    renderKpiRow(doc, 'Revenue', data.revenue, true, pad, innerW);
  } else {
    // Vendor: utilization and revenue metrics
    renderKpiRow(doc, 'Capacity Utilization', data.utilization, false, pad, innerW);
    renderKpiRow(doc, 'Revenue', data.revenue, true, pad, innerW);
  }
}

/**
 * Render a single KPI row with metrics and forecast
 */
function renderKpiRow(
  doc: PDFKit.PDFDocument,
  label: string,
  series: MetricSeries,
  isMoney: boolean,
  pad: number,
  innerW: number,
): void {
  const history = series.history.map(r =>
    (isMoney ? r.revenue : r.count ?? r.utilization) ?? 0,
  );
  const highVal = Math.max(...history, 0);
  const lowVal = Math.min(...history, 0);
  const avgVal = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;
  const forecastLevel = series.forecast.length > 0 ? series.forecast[series.forecast.length - 1]! : 0;

  let y = doc.y;

  // Label
  doc.fillColor(BURGUNDY)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(label, pad, y);
  y = doc.y + 8;

  // Metrics row (High | Low | Avg | Current | Forecast)
  const colW = (innerW - 20) / 5;

  doc.fillColor(MUTED)
    .fontSize(9)
    .font('Helvetica-Bold');

  const metrics = [
    { label: 'High', val: isMoney ? formatRupees(highVal) : highVal.toFixed(0) },
    { label: 'Low', val: isMoney ? formatRupees(lowVal) : lowVal.toFixed(0) },
    { label: 'Avg', val: isMoney ? formatRupees(avgVal) : avgVal.toFixed(2) },
    { label: 'Current', val: isMoney ? formatRupees(series.level) : series.level.toFixed(2) },
    {
      label: 'Forecast (6m)',
      val: isMoney ? formatRupees(forecastLevel) : forecastLevel.toFixed(2),
    },
  ];

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i]!;
    const x = pad + i * (colW + 4);
    doc.fontSize(8)
      .text(m.label, x, y, { width: colW, align: 'center' });
    y = doc.y;
  }

  y += 2;

  doc.fillColor(INK)
    .fontSize(10)
    .font('Helvetica');

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i]!;
    const x = pad + i * (colW + 4);
    doc.text(m.val, x, y, { width: colW, align: 'center' });
  }

  y = doc.y + 8;
}

/**
 * Render detailed month-by-month breakdown (history + forecast)
 */
function renderDetailTable(
  doc: PDFKit.PDFDocument,
  data: ReportData,
  W: number,
  innerW: number,
  pad: number,
): void {
  let y: number = doc.y + 12;

  // Table header
  doc.lineWidth(0.5).strokeColor(MUTED);
  doc.moveTo(pad, y).lineTo(W - pad, y).stroke();
  y += 8;

  const colW = (innerW - 20) / 3;
  const col1X = pad;
  const col2X = pad + colW + 10;
  const col3X = pad + colW * 2 + 20;

  if (isPlatformReport(data)) {
    // Platform columns: Month | Demand | Revenue
    doc.fillColor(BURGUNDY)
      .fontSize(10)
      .font('Helvetica-Bold');

    doc.text('Month', col1X, y, { width: colW });
    doc.text('Bookings', col2X, y, { width: colW, align: 'right' });
    doc.text('Revenue', col3X, y, { width: colW, align: 'right' });
  } else {
    // Vendor columns: Month | Utilization | Revenue
    doc.fillColor(BURGUNDY)
      .fontSize(10)
      .font('Helvetica-Bold');

    doc.text('Month', col1X, y, { width: colW });
    doc.text('Utilization', col2X, y, { width: colW, align: 'right' });
    doc.text('Revenue', col3X, y, { width: colW, align: 'right' });
  }

  y = doc.y + 6;
  doc.lineWidth(0.5).strokeColor(MUTED);
  doc.moveTo(pad, y).lineTo(W - pad, y).stroke();
  y += 8;

  if (isPlatformReport(data)) {
    // Platform detail rows
    const maxLen = Math.max(data.demand.history.length, data.revenue.history.length);

    doc.fillColor(INK)
      .fontSize(9)
      .font('Helvetica');

    for (let i = 0; i < maxLen; i++) {
      const demand = data.demand.history[i];
      const revenue = data.revenue.history[i];
      const month = demand?.month || revenue?.month || `M+${i + 1}`;

      doc.text(month, col1X, y, { width: colW });
      doc.text(demand ? demand.count.toString() : '-', col2X, y, {
        width: colW,
        align: 'right',
      });
      doc.text(revenue ? formatRupees(revenue.revenue) : '-', col3X, y, {
        width: colW,
        align: 'right',
      });

      y = doc.y + 4;
    }

    // Forecast rows
    y += 4;
    doc.fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica-Oblique');

    for (let i = 0; i < data.demand.forecast.length; i++) {
      const monthNum = i + 1;
      doc.text(`F+${monthNum}`, col1X, y, { width: colW });
      doc.text(data.demand.forecast[i]!.toFixed(0), col2X, y, {
        width: colW,
        align: 'right',
      });
      doc.text(formatRupees(data.revenue.forecast[i] ?? 0), col3X, y, {
        width: colW,
        align: 'right',
      });

      y = doc.y + 4;
    }
  } else {
    // Vendor detail rows
    const maxLen = Math.max(data.utilization.history.length, data.revenue.history.length);

    doc.fillColor(INK)
      .fontSize(9)
      .font('Helvetica');

    for (let i = 0; i < maxLen; i++) {
      const util = data.utilization.history[i];
      const revenue = data.revenue.history[i];
      const month = util?.month || revenue?.month || `M+${i + 1}`;

      doc.text(month, col1X, y, { width: colW });
      doc.text(util ? `${(util.utilization * 100).toFixed(1)}%` : '-', col2X, y, {
        width: colW,
        align: 'right',
      });
      doc.text(revenue ? formatRupees(revenue.revenue) : '-', col3X, y, {
        width: colW,
        align: 'right',
      });

      y = doc.y + 4;
    }

    // Forecast rows
    y += 4;
    doc.fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica-Oblique');

    for (let i = 0; i < data.utilization.forecast.length; i++) {
      const monthNum = i + 1;
      doc.text(`F+${monthNum}`, col1X, y, { width: colW });
      doc.text(`${(data.utilization.forecast[i]! * 100).toFixed(1)}%`, col2X, y, {
        width: colW,
        align: 'right',
      });
      doc.text(formatRupees(data.revenue.forecast[i] ?? 0), col3X, y, {
        width: colW,
        align: 'right',
      });

      y = doc.y + 4;
    }
  }
}
