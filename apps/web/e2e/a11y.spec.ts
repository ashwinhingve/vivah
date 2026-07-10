/**
 * Smart Shaadi — accessibility e2e (UX audit Wave 2)
 *
 * Runs axe-core against the highest-traffic public routes and the auth
 * surface, which is the first thing every user touches. Gate: zero
 * `critical` and `serious` impact violations.
 *
 * Run locally:  pnpm --filter @smartshaadi/web e2e a11y.spec.ts
 * CI gate:      added to the pre-push e2e suite once dev stack is up.
 *
 * Note: this spec uses /[locale]/ prefixes since the App Router went bilingual.
 * If you add a new route to scan, prefix it with /en (or /hi).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_ROUTES: { name: string; path: string }[] = [
  { name: 'home',     path: '/en' },
  { name: 'login',    path: '/en/login' },
  { name: 'register', path: '/en/register' },
  { name: 'help',     path: '/en/help' },
];

test.describe('a11y — public surface', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} has no WCAG 2.2 AA critical or serious violations`, async ({ page }) => {
      // Snap entrance animations to their rest state so axe measures final
      // colors, not mid-transition blends (framer-motion honors this via
      // MotionConfig reducedMotion="user").
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      // Opacity entrance animations still run under reduced motion (framer
      // only disables transforms). Let them settle so axe measures final
      // colors, not mid-fade blends.
      await page.waitForTimeout(2500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      if (blocking.length > 0) {
        const summary = blocking
          .map((v) => `  • ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
          .join('\n');
        // eslint-disable-next-line no-console
        console.log(`\nA11y violations on ${route.path}:\n${summary}\n`);
      }

      expect(blocking, `axe-core found ${blocking.length} critical/serious violations on ${route.path}`).toEqual([]);
    });
  }
});

test.describe('a11y — landmarks present', () => {
  test('home has main landmark', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('home has navigation landmark', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('nav, [role="navigation"]').first()).toBeAttached();
  });
});
