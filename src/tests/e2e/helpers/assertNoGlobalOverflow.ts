import { expect, type Page } from '@playwright/test';

export async function assertNoGlobalOverflow(page: Page, surface: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return {
      viewportWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });

  expect(
    metrics.documentScrollWidth,
    `${surface}: document has horizontal overflow ${JSON.stringify(metrics)}`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(
    metrics.bodyScrollWidth,
    `${surface}: body has horizontal overflow ${JSON.stringify(metrics)}`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}
