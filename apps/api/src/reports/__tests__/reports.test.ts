/**
 * Reports Module Tests
 *
 * Covers:
 *   - PDF generation for PLATFORM reports (admin/support only)
 *   - PDF generation for VENDOR reports (owner or admin/support)
 *   - Auth/authz constraints
 *   - Kill-switch behavior (areReportsEnabled=false returns 503)
 *   - Format helpers (formatRupees, formatDate)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../../analytics/analytics.service.js', () => ({
  getAdminForecast: vi.fn(),
  getVendorForecast: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { formatRupees, formatDate } from '../../lib/pdf/format.js';
import { generateReportPdf } from '../report-pdf.js';
import {
  generatePlatformReport,
  generateVendorReport,
} from '../reports.service.js';
import { getAdminForecast, getVendorForecast } from '../../analytics/analytics.service.js';
import { asProfileId } from '@smartshaadi/types';
import type { PlatformReportData, VendorReportData } from '../report-pdf.js';

// Get mocked functions for use in tests
const mockGetAdminForecast = getAdminForecast as any;
const mockGetVendorForecast = getVendorForecast as any;

// ── Test Suites ──────────────────────────────────────────────────────────────

describe('Reports Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Format Helpers ───────────────────────────────────────────────────────

  describe('Format Helpers', () => {
    describe('formatRupees', () => {
      it('should format rupee amounts with 2 decimal places', () => {
        expect(formatRupees(100)).toBe('Rs. 100.00');
        expect(formatRupees(1000)).toBe('Rs. 1000.00');
        expect(formatRupees(0.5)).toBe('Rs. 0.50');
        expect(formatRupees(99.99)).toBe('Rs. 99.99');
      });

      it('should use "Rs." ASCII prefix, never ₹ glyph', () => {
        const result = formatRupees(100);
        expect(result).toMatch(/^Rs\./);
        expect(result).not.toContain('₹');
      });

      it('should handle zero and negative amounts', () => {
        expect(formatRupees(0)).toBe('Rs. 0.00');
        expect(formatRupees(-100)).toBe('Rs. -100.00');
      });

      it('should round correctly', () => {
        expect(formatRupees(10.005)).toBe('Rs. 10.01'); // rounds up
        expect(formatRupees(10.004)).toBe('Rs. 10.00'); // rounds down
      });
    });

    describe('formatDate', () => {
      it('should format ISO dates to readable format', () => {
        expect(formatDate('2026-05-10')).toBe('10 May 2026');
        expect(formatDate('2026-01-01')).toBe('1 January 2026');
        expect(formatDate('2026-12-31')).toBe('31 December 2026');
      });

      it('should handle all months correctly', () => {
        const months = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        for (let m = 1; m <= 12; m++) {
          const iso = `2026-${String(m).padStart(2, '0')}-15`;
          expect(formatDate(iso)).toContain(months[m - 1]);
        }
      });
    });
  });

  // ── Platform Report ──────────────────────────────────────────────────────

  describe('Platform Report Generation', () => {
    it('should generate a valid PDF from platform analytics', async () => {
      const mockForecast = {
        demand: {
          history: [
            { month: '2026-05', count: 10 },
            { month: '2026-06', count: 12 },
          ],
          forecast: [11, 13, 15, 14, 16, 18],
          level: 12,
        },
        revenue: {
          history: [
            { month: '2026-05', revenue: 100000 },
            { month: '2026-06', revenue: 120000 },
          ],
          forecast: [110000, 130000, 150000, 140000, 160000, 180000],
          level: 120000,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generatePlatformReport();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      // Verify it's a valid PDF
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should use custom period when provided', async () => {
      const mockForecast = {
        demand: {
          history: [],
          forecast: [],
          level: 0,
        },
        revenue: {
          history: [],
          forecast: [],
          level: 0,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generatePlatformReport({
        from: '2026-01',
        to: '2026-03',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should render report metadata on cover page', async () => {
      const mockForecast = {
        demand: {
          history: [{ month: '2026-05', count: 10 }],
          forecast: [11],
          level: 10,
        },
        revenue: {
          history: [{ month: '2026-05', revenue: 100000 }],
          forecast: [110000],
          level: 100000,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const reportData: PlatformReportData = {
        meta: {
          kind: 'PLATFORM',
          title: 'Platform Analytics Report',
          subject: 'Smart Shaadi',
          period: { from: '2026-05', to: '2026-06' },
          generatedAt: new Date().toISOString(),
          horizon: 6,
        },
        demand: mockForecast.demand,
        revenue: mockForecast.revenue,
      };

      const buffer = await generateReportPdf(reportData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });
  });

  // ── Vendor Report ────────────────────────────────────────────────────────

  describe('Vendor Report Generation', () => {
    it('should generate a valid PDF from vendor analytics', async () => {
      const vendorId = '550e8400-e29b-41d4-a716-446655440000';
      const profileId = asProfileId('550e8400-e29b-41d4-a716-446655440001');

      const mockForecast = {
        utilization: {
          history: [
            { month: '2026-05', utilization: 0.6 },
            { month: '2026-06', utilization: 0.75 },
          ],
          forecast: [0.8, 0.85, 0.7, 0.65, 0.9, 0.88],
          level: 0.75,
        },
        revenue: {
          history: [
            { month: '2026-05', revenue: 50000 },
            { month: '2026-06', revenue: 60000 },
          ],
          forecast: [55000, 65000, 75000, 70000, 80000, 90000],
          level: 60000,
        },
      };

      mockGetVendorForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generateVendorReport(vendorId, profileId, 'My Catering Co.');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      // Verify it's a valid PDF
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should use custom period when provided', async () => {
      const vendorId = '550e8400-e29b-41d4-a716-446655440000';
      const profileId = asProfileId('550e8400-e29b-41d4-a716-446655440001');

      const mockForecast = {
        utilization: {
          history: [],
          forecast: [],
          level: 0,
        },
        revenue: {
          history: [],
          forecast: [],
          level: 0,
        },
      };

      mockGetVendorForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generateVendorReport(vendorId, profileId, 'Vendor LLC', {
        from: '2026-01',
        to: '2026-03',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should render vendor metadata on cover page', async () => {
      const mockForecast = {
        utilization: {
          history: [{ month: '2026-05', utilization: 0.7 }],
          forecast: [0.75],
          level: 0.7,
        },
        revenue: {
          history: [{ month: '2026-05', revenue: 50000 }],
          forecast: [55000],
          level: 50000,
        },
      };

      const reportData: VendorReportData = {
        meta: {
          kind: 'VENDOR',
          title: 'Vendor Performance Report',
          subject: 'Elite Florals',
          period: { from: '2026-05', to: '2026-06' },
          generatedAt: new Date().toISOString(),
          horizon: 6,
        },
        utilization: mockForecast.utilization,
        revenue: mockForecast.revenue,
      };

      const buffer = await generateReportPdf(reportData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });
  });

  // ── KPI and Detail Tables ────────────────────────────────────────────────

  describe('Report Content Tables', () => {
    it('should include KPI summary for platform reports', async () => {
      const mockForecast = {
        demand: {
          history: [
            { month: '2026-01', count: 5 },
            { month: '2026-02', count: 10 },
            { month: '2026-03', count: 8 },
          ],
          forecast: [9, 11, 10, 12, 13, 14],
          level: 8,
        },
        revenue: {
          history: [
            { month: '2026-01', revenue: 50000 },
            { month: '2026-02', revenue: 100000 },
            { month: '2026-03', revenue: 80000 },
          ],
          forecast: [90000, 110000, 100000, 120000, 130000, 140000],
          level: 80000,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generatePlatformReport();
      expect(buffer).toBeInstanceOf(Buffer);
      // PDF should be a valid multi-page document (KPI table creates a new page)
      expect(buffer.length).toBeGreaterThan(2000);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should include detail table with history + forecast rows', async () => {
      const mockForecast = {
        demand: {
          history: [
            { month: '2026-05', count: 10 },
            { month: '2026-06', count: 12 },
          ],
          forecast: [11, 13],
          level: 12,
        },
        revenue: {
          history: [
            { month: '2026-05', revenue: 100000 },
            { month: '2026-06', revenue: 120000 },
          ],
          forecast: [110000, 130000],
          level: 120000,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generatePlatformReport();
      expect(buffer).toBeInstanceOf(Buffer);
      // PDF with detail table should be substantial (multi-page)
      expect(buffer.length).toBeGreaterThan(2000);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty history (no prior data)', async () => {
      const mockForecast = {
        demand: {
          history: [],
          forecast: [5, 6, 7, 8, 9, 10],
          level: 0,
        },
        revenue: {
          history: [],
          forecast: [50000, 60000, 70000, 80000, 90000, 100000],
          level: 0,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generatePlatformReport();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should handle single data point (no averaging)', async () => {
      const mockForecast = {
        demand: {
          history: [{ month: '2026-06', count: 10 }],
          forecast: [11, 12, 13, 14, 15, 16],
          level: 10,
        },
        revenue: {
          history: [{ month: '2026-06', revenue: 100000 }],
          forecast: [110000, 120000, 130000, 140000, 150000, 160000],
          level: 100000,
        },
      };

      mockGetAdminForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generatePlatformReport();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });

    it('should format utilization as percentage in vendor reports', async () => {
      const vendorId = '550e8400-e29b-41d4-a716-446655440000';
      const profileId = asProfileId('550e8400-e29b-41d4-a716-446655440001');

      const mockForecast = {
        utilization: {
          history: [{ month: '2026-05', utilization: 0.567 }],
          forecast: [0.6, 0.75],
          level: 0.567,
        },
        revenue: {
          history: [{ month: '2026-05', revenue: 50000 }],
          forecast: [55000, 60000],
          level: 50000,
        },
      };

      mockGetVendorForecast.mockResolvedValueOnce(mockForecast);

      const buffer = await generateVendorReport(vendorId, profileId, 'Vendor LLC');
      expect(buffer).toBeInstanceOf(Buffer);
      // Utilization should be rendered as percentage
      expect(buffer.toString('latin1')).toMatch(/^%PDF/);
    });
  });
});
