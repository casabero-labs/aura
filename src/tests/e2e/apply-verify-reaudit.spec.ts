import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 320, height: 780, label: '320px' },
]) {
  test(`reaudit comparison is honest and reflows without overflow at ${viewport.label}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?av-fixture=verified-reaudited', { waitUntil: 'domcontentloaded' });

    const summary = page.getByTestId('apply-verify-reaudit-summary');
    await expect(summary).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Antes y después' })).toBeVisible();
    await expect(page.getByText('Ejecución verificada; resultado reauditable')).toBeVisible();
    await expect(page.getByText('La reauditoría usa el mismo motor determinista de AURA y no sustituye validación de dominio')).toBeVisible();
    await expect(page.getByTestId('reaudit-resolved-findings')).toHaveText('1');

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      step: (() => {
        const element = document.querySelector<HTMLElement>('[data-testid="apply-verify-step"]');
        return element ? element.scrollWidth - element.clientWidth : -1;
      })(),
    }));
    expect(overflow).toEqual({ document: 0, body: 0, step: 0 });

    if (viewport.width === 320) {
      const findingColumns = await page.locator('.reaudit-findings-grid').evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
      );
      expect(findingColumns).toBe(1);
    }
    expect(consoleErrors).toEqual([]);
  });
}
