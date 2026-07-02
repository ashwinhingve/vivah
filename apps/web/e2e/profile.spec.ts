import { test, expect } from '@playwright/test';
import { QA, login, seedWelcomeSeen } from './helpers/auth';

/**
 * Journey: feed → profile detail → back to feed.
 * qa-ind-01's feed has real matches; opening a card shows the quick-view
 * drawer, and its "View full profile" CTA navigates to the /profiles/[id]
 * detail page. Browser-back returns to the feed.
 */
test.describe('profile — detail navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    await seedWelcomeSeen(context);
    await login(page, QA.individualMatchable);
    await page.goto('/feed');
    await expect(page.getByRole('button', { name: 'Connect' }).first()).toBeVisible();
  });

  test('navigates to profile detail and back to the feed', async ({ page }) => {
    const name = (await page.locator('article h3').first().innerText()).trim();

    // Open the quick-view drawer (the card image is the clickable open-region).
    await page.getByRole('img', { name }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // Follow the full-profile CTA → /profiles/[id] detail page.
    await drawer.getByRole('link', { name: /full profile/i }).first().click();
    await expect(page).toHaveURL(/\/profiles\/[0-9a-f-]+/i);

    // Detail page renders the person as a heading.
    await expect(page.getByRole('heading', { name, exact: false }).first()).toBeVisible();

    // Back returns to the feed with cards intact.
    await page.goBack();
    await expect(page).toHaveURL(/\/(en\/)?feed/);
    await expect(page.getByRole('button', { name: 'Connect' }).first()).toBeVisible();
  });
});
