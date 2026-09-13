import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';
import { assertNoGlobalOverflow } from './helpers/assertNoGlobalOverflow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TITANIC_CSV = path.resolve(__dirname, './fixtures/titanic-l13g.csv');

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 768, height: 1024 },
  { width: 320, height: 800 },
  { width: 390, height: 844 },
] as const;

async function assertEditorialSurface(page: Page, surface: string): Promise<void> {
  await page.evaluate(() => document.fonts?.ready);
  await assertNoGlobalOverflow(page, surface);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blockingViolations = results.violations.filter((violation) => (
    violation.impact === 'critical' || violation.impact === 'serious'
  ));

  expect(
    blockingViolations,
    `${surface}: axe critical/serious violations\n${JSON.stringify(blockingViolations, null, 2)}`,
  ).toEqual([]);
}

async function boot(page: Page): Promise<void> {
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
}

async function waitForHarness(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE4_INJECT__ === 'function'
      && typeof (window as any).__PHASE4_SET_STATE__ === 'function'
      && typeof (window as any).__PHASE4_GET_STATE__ === 'function',
    { timeout: 20_000 },
  );
}

async function setPipelineState(page: Page, state: string): Promise<void> {
  await page.evaluate((nextState) => (window as any).__PHASE4_SET_STATE__(nextState), state);
  await page.waitForTimeout(350);
}

async function waitForState(page: Page, state: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState),
    { timeout: 30_000 },
  ).toBe(state);
}

async function prepareReport(page: Page): Promise<void> {
  await waitForHarness(page);
  await page.locator('[data-testid="csv-file-input"]').setInputFiles(TITANIC_CSV);
  await waitForState(page, 'profile');
  await setPipelineState(page, 'diagnosis');

  const fingerprint = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.()?.fingerprint);
  const fixture = buildPhase4TitanicFixture(fingerprint);
  await page.evaluate((payload) => {
    (window as any).__PHASE4_INJECT__(payload.diagnosis, payload.plan, {
      analysisText: 'Diagnóstico controlado para verificación de accesibilidad.',
    });
  }, fixture);
  await setPipelineState(page, 'diagnostic_report');
  await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 15_000 });
}

async function assertKeyboardBasics(page: Page, viewportWidth: number): Promise<void> {
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido principal' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const mobileToggle = page.locator('.mobile-nav-toggle');
  if (viewportWidth <= 920) {
    await mobileToggle.focus();
    await page.keyboard.press('Enter');
    await expect(mobileToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-navigation')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('#mobile-navigation').getByRole('button').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(mobileToggle).toBeFocused();
  } else {
    const homeButton = page.getByRole('button', { name: 'Home' });
    await homeButton.focus();
    await page.keyboard.press('Enter');
    await expect(homeButton).toHaveAttribute('aria-current', 'page');
  }
}

async function navigatePrimary(page: Page, name: string, viewportWidth: number): Promise<void> {
  if (viewportWidth <= 920) {
    const toggle = page.locator('.mobile-nav-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') {
      await toggle.click();
    }
    await page.locator('#mobile-navigation').getByRole('button', { name }).click();
    return;
  }

  await page.getByRole('button', { name }).click();
}

test.describe('Aura Editorial — accesibilidad, overflow y degradación de fuentes', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px — surfaces principales y rama operativa`, async ({ page }) => {
      const runtimeErrors: string[] = [];
      const isExpectedDegradationNoise = (message: string): boolean => (
        /Failed to load resource: net::ERR_FAILED/i.test(message)
        || /localhost:11434\/api\/tags|127\.0\.0\.1:11434\/api\/tags/i.test(message)
        || /address space of `local`.*address space of `loopback`/i.test(message)
      );
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error'
          && !/preload assets|React DevTools/i.test(message.text())
          && !isExpectedDegradationNoise(message.text())) {
          runtimeErrors.push(message.text());
        }
      });
      await page.setViewportSize(viewport);
      await boot(page);

      await assertEditorialSurface(page, 'home');
      await assertKeyboardBasics(page, viewport.width);

      if (viewport.width === 1280) {
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        await assertEditorialSurface(page, 'home-200-percent-text');
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      }

      await page.getByRole('button', { name: /Empezar auditoría/i }).click();
      await expect(page.getByTestId('csv-file-input')).toBeAttached();
      await assertEditorialSurface(page, 'carga');
      // Continue from the same mounted pipeline so the controlled E2E harness
      // remains available while the real CSV upload establishes the profile.
      await prepareReport(page);

      await setPipelineState(page, 'profile');
      await assertEditorialSurface(page, 'perfil');
      await setPipelineState(page, 'diagnosis');
      await assertEditorialSurface(page, 'diagnostico');
      await setPipelineState(page, 'diagnostic_report');
      await assertEditorialSurface(page, 'informe');

      await setPipelineState(page, 'script');
      await expect(page.getByTestId('script-gen-v2-stage')).toBeVisible({ timeout: 10_000 });
      await assertEditorialSurface(page, 'correccion-opcional');

      await setPipelineState(page, 'review');
      await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 10_000 });
      await assertEditorialSurface(page, 'revision');

      await setPipelineState(page, 'execution');
      await expect(page.getByTestId('apply-verify-step')).toBeVisible({ timeout: 10_000 });
      await assertEditorialSurface(page, 'ejecucion');

      await setPipelineState(page, 'export');
      await expect(page.getByTestId('export-stage')).toBeVisible({ timeout: 10_000 });
      await assertEditorialSurface(page, 'exportacion');

      await navigatePrimary(page, 'Configuración', viewport.width);
      await expect(page.getByTestId('settings-workspace')).toBeVisible({ timeout: 10_000 });
      await assertEditorialSurface(page, 'configuracion');
      await page.getByRole('button', { name: /Volver a auditoría/i }).click();

      await navigatePrimary(page, 'Home', viewport.width);
      await page.getByRole('button', { name: 'Ayuda' }).click();
      await expect(page.getByTestId('help-center')).toBeVisible({ timeout: 10_000 });
      await assertEditorialSurface(page, 'ayuda');
      await page.getByRole('button', { name: /Volver a auditoría/i }).click();

      await navigatePrimary(page, 'Laboratorio', viewport.width);
      await expect(page.getByRole('heading', { name: 'Laboratorio de evaluación LLM', exact: true })).toBeVisible({ timeout: 15_000 });
      await assertEditorialSurface(page, 'laboratorio');

      expect(runtimeErrors, 'no debe haber errores JS críticos').toEqual([]);
    });
  }
});
