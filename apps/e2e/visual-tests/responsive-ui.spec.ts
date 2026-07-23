import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

async function expectHealthyPage(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main')).toBeVisible();
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasOverflow).toBeFalsy();
}

for (const viewport of viewports) {
  test(`public learner surfaces are responsive at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    await page.goto('http://127.0.0.1:3001/', { waitUntil: 'networkidle' });
    await expectHealthyPage(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('http://127.0.0.1:3001/courses', { waitUntil: 'networkidle' });
    await expectHealthyPage(page);

    await page.goto('http://127.0.0.1:3001/login', { waitUntil: 'networkidle' });
    await expectHealthyPage(page);
    await expect(page.locator('input')).toHaveCount(2);
    expect(browserErrors).toEqual([]);
  });

  test(`staff login is responsive in dark mode at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    await page.goto('http://127.0.0.1:3002/login', { waitUntil: 'networkidle' });
    await expectHealthyPage(page);
    await expect(page.locator('input')).toHaveCount(3);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
}

test('interactive controls expose keyboard focus and minimum primary touch targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('http://127.0.0.1:3001/login', { waitUntil: 'networkidle' });

  await page.keyboard.press('Tab');
  const focused = page.locator(':focus-visible');
  await expect(focused).toBeVisible();

  const primaryTargets = page.locator('button, input');
  const count = await primaryTargets.count();
  for (let index = 0; index < count; index += 1) {
    const box = await primaryTargets.nth(index).boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});
