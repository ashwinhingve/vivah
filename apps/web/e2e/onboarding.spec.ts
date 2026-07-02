import { test, expect } from '@playwright/test';
import { QA, login, seedWelcomeSeen } from './helpers/auth';

/**
 * Journey: profile completion gate.
 * The feed page swaps its content by completeness:
 *   < 40%  → <ProfileCompletionGuide> (CTA "Start with personal details")
 *   >= 40% → the match feed (grid, single-card, or "No matches yet" empty state)
 * We assert the switch deterministically using the seeded ladder
 * (qa-ind-15 = 0%, qa-ind-20 = 90%) — no data mutation required.
 */
test.describe('onboarding — profile completion', () => {
  test('0% profile sees the completion guide, not the feed', async ({ page, context }) => {
    await seedWelcomeSeen(context);
    await login(page, QA.individualZero);
    await page.goto('/feed');

    // Guide CTA is shown; no match cards.
    await expect(
      page.getByRole('link', { name: 'Start with personal details' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toHaveCount(0);
  });

  test('completed profile sees the match feed, not the guide', async ({ page, context }) => {
    await seedWelcomeSeen(context);
    await login(page, QA.individualFull);
    await page.goto('/feed');

    // Feed-ready surface: the completeness pill shows and the guide CTA is gone.
    await expect(page.getByText(/%\s*complete/i).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Start with personal details' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Continue your profile' }),
    ).toHaveCount(0);
  });
});
