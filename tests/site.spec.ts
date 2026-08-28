import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home supports the keyboard demo and has no serious accessibility issues', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/API Scenario Patch/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('img')).toHaveAttribute('alt', /requests passing through/i);

  const button = page.getByRole('button', { name: 'Build the safe patch' });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Generated scenario patch')).toBeVisible();
  await expect(page.getByLabel('Generated scenario patch').locator('code')).toContainText('${REDACTED_CARD}');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('390px layout has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('privacy, terms, and offline state are reachable', async ({ page, context }) => {
  for (const route of ['/privacy/', '/terms/']) {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toBeVisible();
  }
  await page.goto('/');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('status')).toContainText('Offline');
  await context.setOffline(false);
});

test('reduced motion removes looping demo animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page.locator('.loading-state span').evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
