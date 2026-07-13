/**
 * Visual evidence for Apply & Verify step.
 * Captures 4 critical states (ready, awaiting_external_output, verified, invalid)
 * at both 1440px and 390px viewports using the dev fixture harness.
 * Screenshots go to docs/tercera_entrega_aura/03_evidencia/screenshots/apply-verify/
 */
import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/apply-verify');

const FIXTURES = [
  { name: '02_prepare_ready', param: 'ready', testId: 'apply-verify-ready' },
  { name: '03_awaiting_files', param: 'awaiting_external_output', testId: 'apply-verify-import' },
  { name: '04_verified', param: 'verified', testId: 'apply-verify-verified' },
  { name: '05_invalid', param: 'invalid', testId: 'apply-verify-error' },
];

for (const f of FIXTURES) {
  for (const viewport of [
    { width: 1440, height: 900, suffix: '1440' },
    { width: 390, height: 844, suffix: '390' },
  ]) {
    test(`screenshot ${f.name} at ${viewport.suffix}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/?av-fixture=${f.param}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator(`[data-testid="${f.testId}"]`).first().waitFor({ state: 'visible', timeout: 20_000 });
      // Extra pause for fonts and layout settle
      await page.waitForTimeout(300);
      // Verify no critical overflow
      const overflow = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="apply-verify-step"]') || document.querySelector('.step-card');
        if (!el) return 'no-element';
        const { overflowX, overflowY } = getComputedStyle(el);
        return overflowX === 'hidden' || overflowY === 'hidden' ? 'hidden' : `${overflowX} ${overflowY}`;
      });
      if (overflow === 'hidden') {
        test.info().annotations.push({ type: 'warning', description: 'overflow hidden detected' });
      }
      await page.screenshot({ path: path.join(OUT, `${f.name}_${viewport.suffix}.png`), fullPage: true });
    });
  }
}
