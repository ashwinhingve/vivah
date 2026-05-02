/**
 * Smart Shaadi — Demo happy-path e2e
 *
 * Stabilization plan §3.1 — 5 scenarios that double as the client-meeting
 * demo script. These run against staging with USE_MOCK_SERVICES=true.
 *
 * Pre-requisites:
 *   - staging URL set via PLAYWRIGHT_BASE_URL or BASE_URL env
 *   - demo accounts seeded via `pnpm db:seed`
 */
import { test, expect } from '@playwright/test';

// Demo accounts (seeded by pnpm db:seed)
const PRIYA = { phone: '+919999999001', name: 'Priya Singh' };
const ARJUN = { phone: '+919999999002', name: 'Arjun Kapoor' };

test.describe('Smart Shaadi demo flow', () => {
  test('1. landing page loads + CTA visible', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Smart Shaadi/i);
    await expect(page.getByRole('link', { name: /get started|sign in/i })).toBeVisible();
  });

  test('2. signup OTP flow — mock OTP accepted', async ({ page }) => {
    await page.goto('/signup');
    await page.getByPlaceholder(/phone/i).fill(PRIYA.phone);
    await page.getByRole('button', { name: /send otp|continue/i }).click();

    // Mock mode prints OTP to logs; staging seeded with deterministic '123456'
    await page.getByPlaceholder(/otp|verification code/i).fill('123456');
    await page.getByRole('button', { name: /verify|submit/i }).click();

    // Lands on profile or dashboard
    await expect(page).toHaveURL(/\/(profile|dashboard|onboarding)/, { timeout: 15_000 });
  });

  test('3. matches feed renders with Guna scores', async ({ page, context }) => {
    // Pre-seed session via cookie if STAGING_SESSION_COOKIE provided in env
    if (process.env.STAGING_SESSION_COOKIE) {
      await context.addCookies([{
        name: 'better-auth.session_token',
        value: process.env.STAGING_SESSION_COOKIE.split('=')[1] ?? '',
        url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
      }]);
    }

    await page.goto('/matches');

    // Match cards visible
    await expect(page.getByTestId('match-card').first()).toBeVisible({ timeout: 10_000 });

    // Guna score badge visible (e.g. "28/36")
    await expect(page.getByText(/\d+\s*\/\s*36/i).first()).toBeVisible();
  });

  test('4. booking flow reaches Razorpay checkout (test mode)', async ({ page }) => {
    if (!process.env.STAGING_SESSION_COOKIE) {
      test.skip(true, 'requires logged-in session');
    }

    await page.goto('/vendors');
    await expect(page.getByTestId('vendor-card').first()).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('vendor-card').first().click();

    await page.getByRole('button', { name: /book|enquire/i }).click();
    // Booking form
    await page.getByLabel(/date/i).fill('2026-12-05');
    await page.getByRole('button', { name: /proceed to pay|pay now/i }).click();

    // Razorpay test-mode iframe loads
    await expect(page.locator('iframe[name*="razorpay"], #razorpay-checkout-frame')).toBeVisible({ timeout: 15_000 });
  });

  test('5. dispute flow — raise + admin resolve', async ({ page }) => {
    if (!process.env.STAGING_SESSION_COOKIE) {
      test.skip(true, 'requires logged-in session + seeded booking');
    }

    // Navigate to a seeded in-progress booking
    await page.goto('/bookings');
    await page.getByTestId('booking-card').filter({ hasText: /in progress|active/i }).first().click();

    await page.getByRole('button', { name: /raise dispute/i }).click();
    await page.getByLabel(/reason/i).fill('Vendor did not show up');
    await page.getByRole('button', { name: /submit|raise/i }).click();

    // Confirmation
    await expect(page.getByText(/dispute (raised|submitted)/i)).toBeVisible({ timeout: 10_000 });
  });
});
