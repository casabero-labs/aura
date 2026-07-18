import { expect, test } from '@playwright/test';

const report = {
  score: 88, rowCount: 5, colCount: 3, duplicateRows: 0,
  issues: [], columnStats: {}, scoreBreakdown: [], delimiterDetected: ',',
};

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile-320', width: 320, height: 780 },
]) {
  test(`Exportación honesta sin remediación — ${viewport.name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.waitForFunction(() => (
      typeof (window as any).__L9_SET_REPORT__ === 'function'
      && typeof (window as any).__PHASE4_SET_STATE__ === 'function'
    ));
    await page.evaluate((fixture) => {
      (window as any).__L9_SET_REPORT__(fixture);
      (window as any).__PHASE4_SET_STATE__('export');
    }, report);

    await expect(page.getByTestId('export-stage')).toBeVisible();
    await expect(page.getByTestId('export-remediation-not-run')).toHaveText(
      'El análisis fue completado, pero no se ejecutó una remediación sobre el dataset',
    );
    await expect(page.getByTestId('export-download-evidence-package')).toBeVisible();
    await expect(page.getByTestId('export-download-json')).toBeVisible();
    await expect(page.getByTestId('export-download-corrected-csv')).toHaveCount(0);

    const primaryStyle = await page.getByTestId('export-download-evidence-package').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        height: element.getBoundingClientRect().height,
      };
    });
    expect(primaryStyle.background).not.toBe('rgb(30, 30, 28)');
    expect(primaryStyle.border).not.toBe('rgba(0, 0, 0, 0)');
    expect(primaryStyle.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(consoleErrors).toEqual([]);
    await page.screenshot({ path: `test-results/aura-remediation-export-${viewport.name}.png`, fullPage: true });
  });
}
