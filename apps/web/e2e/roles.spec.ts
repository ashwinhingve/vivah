import { test, expect } from '@playwright/test';
import { QA, login, seedWelcomeSeen } from './helpers/auth';

/**
 * Journey: every role lands on its own dashboard with its own nav.
 *
 * ⚠️ This spec doubles as a regression guard for the role-auth bug
 * (memory obs 11771): non-INDIVIDUAL roles previously fell back to the
 * INDIVIDUAL navbar / dashboard. The API now returns the correct role, so
 * these should pass — but if a role regresses, the failure here pins it down.
 * Failures are a signal, not a suite-wide break.
 */

interface RoleCase {
  name: string;
  phone: string;
  landing: RegExp;
  /** INDIVIDUAL is gated behind /welcome; the others are not. */
  individual?: boolean;
}

const ROLE_CASES: RoleCase[] = [
  { name: 'INDIVIDUAL', phone: QA.individualMatchable, landing: /\/(en\/)?dashboard/, individual: true },
  { name: 'VENDOR', phone: QA.vendor, landing: /\/(en\/)?vendor-dashboard/ },
  { name: 'ADMIN', phone: QA.admin, landing: /\/(en\/)?admin/ },
  { name: 'SUPPORT', phone: QA.support, landing: /\/(en\/)?support/ },
  { name: 'EVENT_COORDINATOR', phone: QA.coordinator, landing: /\/(en\/)?coordinator/ },
  { name: 'FAMILY_MEMBER', phone: QA.familyMember, landing: /\/(en\/)?family/ },
];

for (const rc of ROLE_CASES) {
  test(`${rc.name} lands on its dashboard with the right nav`, async ({ page, context }) => {
    if (rc.individual) await seedWelcomeSeen(context);
    await login(page, rc.phone);

    await expect(page).toHaveURL(rc.landing);

    // The "Discover" (individual match feed) nav is INDIVIDUAL-only. Its
    // presence/absence proves the role is not falling back to individual nav.
    const discover = page.getByRole('link', { name: 'Discover' });
    if (rc.individual) {
      await expect(discover.first()).toBeVisible();
    } else {
      await expect(discover).toHaveCount(0);
    }
  });
}

test('a non-INDIVIDUAL role does not get the individual match feed', async ({ page }) => {
  await login(page, QA.vendor);
  await page.goto('/feed');
  // No individual ProfileCard grid for a vendor (no reciprocal feed).
  await expect(page.getByRole('button', { name: 'Connect' })).toHaveCount(0);
});
