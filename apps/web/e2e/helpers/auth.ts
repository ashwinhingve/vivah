import { type Page, type BrowserContext } from '@playwright/test';

/**
 * Shared auth helpers for the E2E journey specs.
 *
 * Every spec logs in through the real phone-OTP UI using the seeded QA accounts
 * and the mock OTP (`123456`), so no spec depends on another's state. Requires
 * the full local stack running in mock mode:
 *   USE_MOCK_SERVICES=true  ·  MOCK_OTP_VALUE=123456
 * and QA accounts seeded:
 *   pnpm --filter @smartshaadi/db db:seed:test-accounts
 *
 * QA accounts are documented in packages/db/seed/qa-credentials.local.md.
 * Phones are entered as 10 digits (the +91 prefix is a static span in the UI).
 */

export const MOCK_OTP = '123456';

/** 10-digit phone (strip +91) → seeded QA account, keyed by the role/scenario we test. */
export const QA = {
  /** qa-ind-01 — Maharashtra Hindu male, in a match cluster (>=2 reciprocal matches). */
  individualMatchable: '7000000001',
  /** qa-ind-15 — 0% onboarding → ProfileCompletionGuide. */
  individualZero: '7000000015',
  /** qa-ind-20 — 100% onboarding, active. */
  individualFull: '7000000020',
  /** qa-ven-01 — VENDOR. */
  vendor: '7000000201',
  /** qa-fam-01 — FAMILY_MEMBER. */
  familyMember: '7000000101',
  /** qa-coord-01 — EVENT_COORDINATOR. */
  coordinator: '7000000301',
  /** qa-admin-01 — ADMIN. */
  admin: '7000000401',
  /** qa-support-01 — SUPPORT. */
  support: '7000000501',
} as const;

/**
 * Inject the `welcome_seen` cookie so an INDIVIDUAL user is not bounced
 * /feed|/dashboard → /welcome by the middleware welcome gate. The
 * "Take me to my matches" button does NOT reliably set this cookie
 * (see memory obs 11324), so tests set it directly.
 */
export async function seedWelcomeSeen(context: BrowserContext): Promise<void> {
  await context.addCookies([
    { name: 'welcome_seen', value: '1', domain: 'localhost', path: '/' },
  ]);
}

/** Drive /login → phone entry → Send OTP, landing on /verify-otp. */
export async function requestOtp(page: Page, phone: string): Promise<void> {
  // Generous timeouts absorb Turbopack cold-compile on the first hit of each
  // route under WSL/DrvFs.
  await page.goto('/login', { timeout: 40_000 });
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();
  try {
    await page.waitForURL(/\/verify-otp/, { timeout: 25_000 });
  } catch {
    // The client sendOtp round-trip occasionally stalls under sustained load on
    // the WSL dev server — a single re-click clears it (idempotent: re-sends OTP).
    if (await page.locator('#phone').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Send OTP' }).click();
    }
    await page.waitForURL(/\/verify-otp/, { timeout: 25_000 });
  }
}

/**
 * Fill the 6 OTP boxes. Each box has maxLength=1 and aria-label
 * "OTP digit N of 6"; the change handler auto-submits once all 6 are filled.
 */
export async function enterOtp(page: Page, code = MOCK_OTP): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`OTP digit ${i + 1} of 6`).fill(code[i] ?? '');
  }
}

/**
 * Full login: /login → OTP → wait for the app to settle past the auth pages.
 * Post-verify the app pushes INDIVIDUAL users through /register/role (which the
 * middleware bounces to /dashboard, then /welcome unless welcome_seen is set),
 * and non-INDIVIDUAL users straight to /dashboard → their role dashboard.
 */
export async function login(page: Page, phone: string): Promise<void> {
  await requestOtp(page, phone);
  await enterOtp(page);
  await page.waitForURL(
    (url) => {
      const p = url.pathname;
      return !p.includes('/verify-otp') && !p.includes('/register/role');
    },
    { timeout: 40_000 },
  );
}
