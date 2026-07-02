import { test, expect } from '@playwright/test';
import { QA, login, seedWelcomeSeen } from './helpers/auth';

/**
 * Journey: match feed core actions.
 * qa-ind-01 is a 90%-complete profile with 2 reciprocal matches, so the feed
 * renders the ProfileCard grid (>=2 items). Connect/shortlist are idempotent
 * across runs — the API treats a duplicate request as success (409 → "Sent!"),
 * and shortlist simply toggles.
 */
test.describe('matching — feed actions', () => {
  test.beforeEach(async ({ page, context }) => {
    await seedWelcomeSeen(context);
    await login(page, QA.individualMatchable);
    await page.goto('/feed');
    // Grid is present (not the completion guide / empty state).
    await expect(page.getByRole('button', { name: 'Connect' }).first()).toBeVisible();
  });

  test('feed loads with profile cards', async ({ page }) => {
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
  });

  test('Connect sends a match request', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect' }).first().click();

    // Connect Sheet opens with the note textarea.
    await expect(page.locator('#connect-note')).toBeVisible();
    await page.locator('#connect-note').fill('Hello from the E2E suite');

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/matchmaking/requests') &&
          r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Send Request' }).click(),
    ]);
    // The Connect flow reaches the API. Accepted outcomes against the fixed QA
    // seed account: 200/201 (sent), 409 (already requested in a prior run), or
    // 429 (FREE-tier daily interest quota exhausted — expected after repeated
    // runs against the same seeded profile). Anything else (404/500) is a real
    // failure of the wiring.
    expect([200, 201, 409, 429]).toContain(resp.status());
    if (resp.status() !== 429) {
      await expect(page.getByRole('button', { name: 'Sent!' })).toBeVisible();
    }
  });

  test('Shortlist persists to the API', async ({ page }) => {
    // Accessible-name "Shortlist" substring-matches both "Shortlist" and
    // "Remove from shortlist", so this locator survives either initial state.
    const shortlist = page.getByRole('button', { name: 'Shortlist' }).first();

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/api\/v1\/matchmaking\/shortlists\//.test(r.url()) &&
          ['POST', 'DELETE'].includes(r.request().method()),
      ),
      shortlist.click(),
    ]);
    // POST (add) or DELETE (remove) round-trips successfully — 409 tolerated
    // since server state persists across runs.
    expect([200, 201, 204, 409]).toContain(resp.status());
  });

  test('profile drawer opens with real data', async ({ page }) => {
    const name = (await page.locator('article h3').first().innerText()).trim();
    // The card image is the clickable open-region (onOpen); clicking it opens
    // the quick-view drawer.
    await page.getByRole('img', { name }).first().click();

    // Right-side drawer (a dialog) with the profile name + full-profile CTA.
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: /full profile/i }).first()).toBeVisible();
  });

  test('Load more fetches the next page @slow', async ({ page }) => {
    const loadMore = page.getByRole('button', { name: 'Load more profiles' });
    // The QA seed for qa-ind-01 is a single page (2 matches); the button only
    // renders when more pages exist.
    test.skip((await loadMore.count()) === 0, 'seed has a single feed page');

    const before = await page.locator('article').count();
    await loadMore.click();
    await expect
      .poll(async () => page.locator('article').count())
      .toBeGreaterThan(before);
  });
});
