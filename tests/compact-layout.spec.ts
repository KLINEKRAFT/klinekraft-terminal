import { test, expect } from '@playwright/test';

for (const height of [600, 560]) {
  test(`all pages keep navigation in reach at 1024×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height });
    // Exercise real rendering without writing to the owner's saved content.
    await page.route('**/api/**', route => route.request().method() === 'GET'
      ? route.continue() : route.abort());
    await page.goto('/');
    const labels = ['Home', 'Games', 'Shackleton', 'GPS / Maps', 'Library', 'Notes', 'Paint', 'Calendar', 'Calculator', 'Files', 'Network', 'System', 'Settings', 'Emergency'];
    for (const [i, label] of labels.entries()) {
      const button = page.getByRole('button', { name: `${String(i + 1).padStart(2, '0')} ${label}`, exact: true });
      await expect(button).toBeInViewport();
      await button.click();
      await expect(page.getByRole('heading', { name: label, exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Return to desktop', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))).toEqual({ w: 1024, h: height });
    }
    await page.getByRole('button', { name: '07 Paint', exact: true }).click();
    await expect(page.locator('.paint-footer')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.paint-canvas-wrap')).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: '03 Shackleton', exact: true }).click();
    await expect(page.getByPlaceholder('Message Shackleton…')).toBeInViewport();
    await expect(page.getByText('Ask anything. Bring your Wikipedia along.')).toHaveCount(0);
  });
}
