import { test, expect } from '@playwright/test';
import { QA, login, requestOtp, enterOtp, seedWelcomeSeen } from './helpers/auth';

/**
 * Journey: phone-OTP signup + login.
 * Uses seeded QA accounts + mock OTP (123456). Requires the full local stack
 * running in mock mode (see helpers/auth.ts).
 */
test.describe('auth — phone OTP', () => {
  test('returning INDIVIDUAL logs in and reaches an authenticated page', async ({
    page,
    context,
  }) => {
    await seedWelcomeSeen(context); // skip the one-time /welcome gate
    await login(page, QA.individualMatchable);

    // INDIVIDUAL with welcome_seen settles on /dashboard (the individual home).
    await expect(page).toHaveURL(/\/(en\/)?dashboard/);
    // Left the auth flow behind.
    await expect(page).not.toHaveURL(/\/(login|verify-otp)/);
  });

  test('returning VENDOR logs in and lands on the vendor dashboard', async ({ page }) => {
    await login(page, QA.vendor);
    await expect(page).toHaveURL(/\/(en\/)?vendor-dashboard/);
  });

  test('wrong OTP shows an error and does not navigate away', async ({ page }) => {
    await requestOtp(page, QA.individualMatchable);
    await enterOtp(page, '000000');

    // Error surfaces (API returns "Invalid OTP"; i18n fallback is "Invalid or
    // expired OTP" — match either); still on /verify-otp.
    await expect(page.locator('#otp-error')).toBeVisible();
    await expect(page.locator('#otp-error')).toContainText(/invalid/i);
    await expect(page).toHaveURL(/\/verify-otp/);
  });

  test('new user signs up and reaches onboarding @slow', async ({ page }) => {
    // NOTE: writes a user to the persisted mock store
    // (apps/api/.data/mockStore.json). Reserved phone outside the QA range.
    const RESERVED_NEW_PHONE = '9999999999';
    await requestOtp(page, RESERVED_NEW_PHONE);
    await enterOtp(page);

    // New INDIVIDUAL (default role) is routed past the auth pages into the
    // authenticated app — the middleware bounces /register/role → /dashboard →
    // /welcome for a first-time individual.
    await page.waitForURL(
      (url) => {
        const p = url.pathname;
        return !p.includes('/verify-otp') && !p.includes('/register/role');
      },
      { timeout: 20_000 },
    );
    await expect(page).toHaveURL(/\/(en\/)?(welcome|dashboard|feed)/);
    // First-time individual sees the welcome CTA.
    await expect(
      page.getByRole('button', { name: 'Take me to my matches' }),
    ).toBeVisible();
  });
});
