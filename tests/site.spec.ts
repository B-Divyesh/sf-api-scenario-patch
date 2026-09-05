import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home has a first-screen sample action and no serious accessibility issues', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/API Scenario Patch/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('img')).toHaveAttribute('alt', /requests pass through/i);

  const action = page.getByRole('link', { name: 'Try it with sample data' }).first();
  await expect(action).toBeVisible();
  expect((await action.boundingBox())?.y ?? 9999).toBeLessThan(700);

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
  await page.locator('#install-command').focus();
  await expect(page.locator('#install-command')).toBeFocused();
  for (const selector of ['.steps p', '.diff-snippet', '.proof-list small', 'footer']) {
    const size = await page.locator(selector).first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(size, `${selector} must honor the 16px type floor`).toBeGreaterThanOrEqual(16);
  }
  for (const target of await page.locator('a:visible, button:visible').all()) {
    const box = await target.boundingBox();
    expect(box?.width, 'visible target width').toBeGreaterThanOrEqual(44);
    expect(box?.height, 'visible target height').toBeGreaterThanOrEqual(44);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('390px demo terminal is keyboard reachable, scrollable, and free of serious accessibility issues', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/?demo=1');
  const terminal = page.getByLabel('Sample asp demo terminal output');
  await terminal.focus();
  await expect(terminal).toBeFocused();
  const before = await terminal.evaluate((element) => ({ left: element.scrollLeft, width: element.scrollWidth, client: element.clientWidth }));
  expect(before.width).toBeGreaterThan(before.client);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => terminal.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before.left);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('Back restores the landing scroll position and the link that opened Privacy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const privacy = page.locator('footer a[href="/privacy/"]');
  await privacy.scrollIntoViewIfNeeded();
  const savedPosition = await page.evaluate(() => window.scrollY);
  expect(savedPosition).toBeGreaterThan(1_000);
  await privacy.click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(savedPosition - 160);
  await expect(privacy).toBeFocused();
});

test('@claim:no-third-party-browser-requests browser demo makes only same-origin requests', async ({ page }) => {
  const foreignRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') foreignRequests.push(request.url());
  });
  await page.goto('/demo/?demo=1');
  await page.getByRole('button', { name: 'Generate sample scenario patch' }).click();
  await expect(page.getByLabel('Generated scenario patch')).toBeVisible();
  expect(foreignRequests).toEqual([]);
});

test('@claim:demo-isolated-storage browser demo stores no sample data and reset works', async ({ page, context }) => {
  await page.goto('/demo/?demo=1');
  await page.getByRole('button', { name: 'Generate sample scenario patch' }).click();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Demo reset. The bundled sample is ready.')).toBeAttached();
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('@claim:no-account-hosted-workspace site has no account form or hosted workspace route', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('form, input[type="password"], input[type="email"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Try it with sample data' }).first()).toHaveAttribute('href', '/demo/?demo=1');
});

test('@claim:site-no-forms-or-analytics static site has no form controls or analytics requests', async ({ page }) => {
  const requests: { type: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ type: request.resourceType(), url: request.url() }));
  await page.goto('/');
  await page.getByRole('link', { name: 'Try it with sample data' }).first().click();
  await page.getByRole('button', { name: 'Generate sample scenario patch' }).click();
  await expect(page.locator('form, input, textarea, select')).toHaveCount(0);
  expect(requests.filter((request) => ['fetch', 'xhr'].includes(request.type))).toEqual([]);
  expect(requests.every((request) => new URL(request.url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:offline-reload offline reload works after the first visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4173/demo/?demo=1');
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    expect(await page.evaluate(async () => (await caches.keys()).includes('asp-site-v5'))).toBe(true);
    await context.setOffline(true);
    await page.goto('http://127.0.0.1:4173/demo/');
    await expect(page.locator('main')).toBeVisible();
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});

test('routes have metadata, navigation, and focusable destination headings', async ({ page }) => {
  for (const route of ['/', '/demo/', '/privacy/', '/terms/', '/404.html']) {
    await page.goto(route);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('footer')).toContainText('Built by Param Factory');
    await expect(page.locator('h1')).toBeFocused();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }
});

test('the built 404 page is a useful accessible error state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/404.html');
  await expect(page).toHaveTitle('Page not found — API Scenario Patch');
  await expect(page.getByRole('heading', { level: 1, name: 'That route was not recorded.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('reduced motion removes demo transition animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Generate sample scenario patch' }).click();
  const duration = await page.locator('.fresh-patch').evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
