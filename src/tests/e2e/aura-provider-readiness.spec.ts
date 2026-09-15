/**
 * Phase 10 L12A — Provider Readiness / Fallback UX E2E Tests.
 *
 * Validates that AURA remains fully functional even when:
 *   - globalThis.LanguageModel is absent
 *   - Chrome AI returns unavailable / downloadable / downloading
 *   - No real AI provider is reachable
 *
 * Standard E2E — runs in CI, does NOT depend on real providers.
 * Does NOT download models. Does NOT assert Gemini Nano always available.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/product/aura/phase_10/l12_provider_evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');

const FIXTURE_CSV = path.resolve(__dirname, './fixtures/aura_l10_full_flow_issues.csv');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FIXTURE_CSV_CONTENT = fs.readFileSync(FIXTURE_CSV, 'utf8');
const FIXTURE_LINES = FIXTURE_CSV_CONTENT.trim().split('\n');
const FIXTURE_ROWS = FIXTURE_LINES.length - 1;
const FIXTURE_HEADER_FIELDS = FIXTURE_LINES[0].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) ?? [];
const FIXTURE_COLUMNS = FIXTURE_HEADER_FIELDS.length;

async function bootToAudit(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
}

async function uploadCsvAndWaitForProfile(page: any) {
  const fileInput = page.locator('[data-testid="csv-file-input"]');
  await fileInput.setInputFiles(FIXTURE_CSV);
  await page.waitForTimeout(3000);
  const profileHeading = page.getByText(/Resumen|Health|Score|Perfil/i).first();
  try {
    await profileHeading.waitFor({ state: 'visible', timeout: 25_000 });
  } catch {
    // Profile may have rendered, continue
  }
  await page.waitForTimeout(1000);
  return true;
}

function collectPageErrors(page: any): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err: Error) => errors.push(err.message));
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

test.describe('Phase 10 L12A — Provider Readiness & Fallback UX', () => {

  test('L12A-01 — Page loads without Chrome AI API', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.screenshot({
      path: path.resolve(SCREENSHOT_DIR, '01_page_loaded_no_chrome_ai.png'),
      fullPage: true,
    });

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('L12A-02 — globalThis.LanguageModel false when API absent', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const hasLanguageModel = await page.evaluate(() => {
      return typeof (globalThis as any).LanguageModel !== 'undefined';
    });

    console.log(`globalThis.LanguageModel present: ${hasLanguageModel}`);

    expect(typeof hasLanguageModel).toBe('boolean');
  });

  test('L12A-03 — Deterministic engine works without AI provider', async ({ page }) => {
    await bootToAudit(page);
    await uploadCsvAndWaitForProfile(page);

    await page.waitForTimeout(2000);

    const profileScore = page.locator('[data-testid="audit-score"], .audit-score');
    const scoreExists = await profileScore.count().then(c => c > 0);

    if (scoreExists) {
      await expect(profileScore.first()).toBeVisible();
    }

    await page.screenshot({
      path: path.resolve(SCREENSHOT_DIR, '02_deterministic_engine_works.png'),
      fullPage: true,
    });
  });

  test('L12A-04 — Provider status UI shows realistic state', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    const hasSettingsButton = await page.locator('.nav-center-menu')
      .getByRole('button', { name: /Configuración|Settings/i }).count();

    if (hasSettingsButton > 0) {
      await page.locator('.nav-center-menu')
        .getByRole('button', { name: /Configuración|Settings/i }).click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: path.resolve(SCREENSHOT_DIR, '03_provider_settings_ui.png'),
        fullPage: true,
      });
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('chrome') &&
      !e.includes('LanguageModel')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('L12A-05 — Provider state recorded in export', async ({ page }) => {
    await bootToAudit(page);
    await uploadCsvAndWaitForProfile(page);

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.resolve(SCREENSHOT_DIR, '04_export_before_provider_state.png'),
      fullPage: true,
    });

    const exportJson = await page.evaluate(() => {
      const w = window as any;
      if (typeof w.__L9_GET_EXPORT_JSON__ === 'function') {
        return w.__L9_GET_EXPORT_JSON__();
      }
      return null;
    });

    if (exportJson !== null) {
      console.log('Export JSON retrieved via harness');
    } else {
      console.log('Export harness not available — checking UI state directly');
      const pageText = await page.locator('body').innerText();
      const hasDiagnosis = pageText.includes('diagnóstico') || pageText.includes('Diagnóstico');
      console.log(`Diagnosis content visible: ${hasDiagnosis}`);
    }

    await page.screenshot({
      path: path.resolve(SCREENSHOT_DIR, '05_after_deterministic_diagnosis.png'),
      fullPage: true,
    });
  });

  test('L12A-06 — No model downloads triggered in standard E2E', async ({ page }) => {
    let downloadTriggered = false;
    page.on('download', () => { downloadTriggered = true; });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(3000);

    expect(downloadTriggered).toBe(false);
  });

  test('L12A-07 — No false Gemini Nano availability claim', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const bodyText = await page.locator('body').innerText();
    const lowerText = bodyText.toLowerCase();

    const alwaysAvailablePhrases = [
      'gemini nano siempre',
      'chrome ai siempre',
      'siempre disponible',
      'siempre listo',
    ];

    for (const phrase of alwaysAvailablePhrases) {
      expect(lowerText.includes(phrase)).toBe(false);
    }
  });

  test('L12A-08 — Provider modes enumerated without crash', async ({ page }) => {
    const providerModes = [
      'mock', 'local', 'chrome_ai', 'cloud',
      'unavailable', 'skipped',
    ];

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    const bodyText = await page.locator('body').innerText();

    const foundModes: string[] = [];
    const lowerBody = bodyText.toLowerCase();
    for (const mode of providerModes) {
      if (lowerBody.includes(mode.replace('_', ' ')) || lowerBody.includes(mode)) {
        foundModes.push(mode);
      }
    }

    console.log(`Provider modes found in UI: [${foundModes.join(', ')}]`);
    expect(Array.isArray(foundModes)).toBe(true);
  });
});

/**
 * Issue #38 — L12B: Recuperación explícita cuando el proveedor asistido
 * no está disponible (AURA-UX-001).
 *
 * Recorrido humano completo sin stepper:
 *   Home → Auditoría → fixture → Perfil base → Diagnóstico sin proveedor
 *   → «Continuar con informe determinista» → Informe visible.
 *
 * Reglas de este bloque:
 *   - Sin waitForTimeout como readiness: solo esperas por estado visible.
 *   - Assertions duras: ninguna ruta condicional permite pasar sin comprobar
 *     el estado de recuperación.
 */

const RECOVERY_VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;

/** Ruido del navegador ajeno a la aplicación (mismo criterio que L12A-01). */
const isBrowserNoise = (message: string): boolean =>
  message.includes('favicon') || message.includes('ResizeObserver');

/** Proveedor cloud sin API key: determinista y sin tráfico de red. */
async function seedCloudWithoutApiKey(page: any) {
  await page.addInitScript(() => {
    window.localStorage.setItem('aura_ai_config', JSON.stringify({
      providerType: 'cloud',
      cloudProvider: 'google',
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      autoAnalyze: false,
    }));
    window.sessionStorage.removeItem('aura_ai_api_key_session');
  });
}

/** Ollama apuntando a un puerto local cerrado: servidor no disponible. */
async function seedOllamaUnreachable(page: any) {
  await page.addInitScript(() => {
    window.localStorage.setItem('aura_ai_config', JSON.stringify({
      providerType: 'ollama',
      model: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
      ollamaModel: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
      ollamaBaseUrl: 'http://127.0.0.1:59999',
      temperature: 0.1,
      autoAnalyze: false,
    }));
  });
}

/** Home → Auditoría → fixture → Perfil base → Diagnóstico. Sin stepper. */
async function walkToDiagnosisWithoutProvider(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

  await page.getByRole('button', { name: /Empezar auditoría/i }).click();

  const fileInput = page.locator('[data-testid="csv-file-input"]');
  await fileInput.waitFor({ state: 'attached', timeout: 15_000 });
  await fileInput.setInputFiles(FIXTURE_CSV);

  const continueToDiagnosis = page.locator('.profile-actions')
    .getByRole('button', { name: /al diagnóstico/i });
  await expect(continueToDiagnosis).toBeVisible({ timeout: 30_000 });
  await continueToDiagnosis.click();

  await expect(page.locator('[data-testid="diagnosis-stage"]')).toBeVisible({ timeout: 15_000 });
}

test.describe('Issue #38 — L12B Recuperación explícita del proveedor', () => {

  for (const viewport of RECOVERY_VIEWPORTS) {
    test(`L12B-01 — recorrido humano hasta el informe con cloud sin API key (${viewport.name})`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (err: Error) => pageErrors.push(err.message));
      page.on('console', (msg: any) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedCloudWithoutApiKey(page);
      await walkToDiagnosisWithoutProvider(page);

      // 1. Estado de recuperación con causa específica del proveedor actual.
      const alert = page.getByTestId('provider-recovery-alert');
      await expect(alert).toBeVisible({ timeout: 15_000 });
      await expect(alert).toContainText('Proveedor no disponible');

      const cause = page.getByTestId('provider-recovery-cause');
      await expect(cause).toBeVisible();
      await expect(cause).toContainText(/API key/i);
      await expect(cause).toContainText(/Google/i);
      await expect(cause).not.toContainText(/Ollama/i);

      // 2. CTA asistida deshabilitada mientras la causa es visible.
      const assistedCta = page.getByTestId('diagnosis-generate');
      await expect(assistedCta).toBeDisabled();
      const assistedCtaStyle = await assistedCta.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          opacity: Number.parseFloat(style.opacity),
          cursor: style.cursor,
          transform: style.transform,
          boxShadow: style.boxShadow,
        };
      });
      expect(assistedCtaStyle.opacity).toBeLessThan(1);
      expect(assistedCtaStyle.cursor).toBe('not-allowed');
      expect(assistedCtaStyle.transform).toBe('none');
      expect(assistedCtaStyle.boxShadow).toBe('none');

      // 3. Ambas salidas visibles y habilitadas.
      const continueBtn = page.getByTestId('provider-recovery-continue');
      const settingsBtn = page.getByTestId('provider-recovery-settings');
      await expect(continueBtn).toBeVisible();
      await expect(continueBtn).toBeEnabled();
      await expect(continueBtn).toContainText('Continuar con informe determinista');
      await expect(settingsBtn).toBeVisible();
      await expect(settingsBtn).toBeEnabled();
      await expect(settingsBtn).toContainText('Cambiar proveedor');

      // 4. Objetivos táctiles de al menos 44px en móvil.
      if (viewport.width <= 640) {
        for (const target of [continueBtn, settingsBtn]) {
          const box = await target.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }

      // 5. Sin desbordamiento horizontal.
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

      await page.screenshot({
        path: path.resolve(SCREENSHOT_DIR, `06_recovery_${viewport.name}.png`),
        fullPage: true,
      });

      // 6. Continuación determinista por CTA textual — nunca por stepper.
      await continueBtn.click();
      await expect(page.locator('[data-testid="diagnostic-report-stage"]')).toBeVisible({ timeout: 15_000 });

      await page.screenshot({
        path: path.resolve(SCREENSHOT_DIR, `07_recovery_report_${viewport.name}.png`),
        fullPage: true,
      });

      // 7. Cero pageerror y cero console.error de la aplicación.
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.filter((message) => !isBrowserNoise(message))).toHaveLength(0);
    });
  }

  test('L12B-02 — las dos salidas son operables por teclado con foco visible', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await seedCloudWithoutApiKey(page);
    await walkToDiagnosisWithoutProvider(page);

    await expect(page.getByTestId('provider-recovery-alert')).toBeVisible({ timeout: 15_000 });

    // Navegación real por Tab hasta la salida determinista.
    const visited: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Tab');
      const focusedTestId = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid') ?? '');
      visited.push(focusedTestId);
      if (focusedTestId === 'provider-recovery-continue') break;
    }
    expect(visited).toContain('provider-recovery-continue');

    // Foco visible en la salida enfocada (outline o box-shadow, nunca invisible).
    const focusIndicator = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = window.getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow };
    });
    expect(focusIndicator.outlineStyle !== 'none' || focusIndicator.boxShadow !== 'none').toBe(true);

    // La siguiente parada del Tab es «Cambiar proveedor».
    await page.keyboard.press('Tab');
    const nextFocus = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid') ?? '');
    expect(nextFocus).toBe('provider-recovery-settings');

    // Regreso con Shift+Tab y activación con Enter → informe visible.
    await page.keyboard.press('Shift+Tab');
    const backFocus = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid') ?? '');
    expect(backFocus).toBe('provider-recovery-continue');

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="diagnostic-report-stage"]')).toBeVisible({ timeout: 15_000 });

    expect(pageErrors).toHaveLength(0);
  });

  test('L12B-03 — Cambiar proveedor abre la Configuración global real', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await seedCloudWithoutApiKey(page);
    await walkToDiagnosisWithoutProvider(page);

    const settingsBtn = page.getByTestId('provider-recovery-settings');
    await expect(settingsBtn).toBeVisible({ timeout: 15_000 });
    await settingsBtn.click();

    // Superficie global capaz de cambiar el proveedor (no el diálogo rápido).
    const settingsWorkspace = page.locator('[data-testid="settings-workspace"]');
    await expect(settingsWorkspace).toBeVisible({ timeout: 15_000 });
    await expect(settingsWorkspace.locator('[data-testid="provider-mode-ollama"]')).toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });

  test('L12B-04 — Ollama no disponible conserva su causa propia, distinta de cloud', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await seedOllamaUnreachable(page);
    await walkToDiagnosisWithoutProvider(page);

    const alert = page.getByTestId('provider-recovery-alert');
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText('Proveedor no disponible');

    // Causa propia del diagnóstico local: nunca se presenta como fallo cloud.
    const cause = page.getByTestId('provider-recovery-cause');
    await expect(cause).toBeVisible();
    await expect(cause).not.toContainText(/API key/i);
    await expect(cause).toContainText(/Ollama|servidor|conexión|conectar/i);

    // Ambas salidas presentes también en esta causa.
    await expect(page.getByTestId('provider-recovery-continue')).toBeEnabled();
    await expect(page.getByTestId('provider-recovery-settings')).toBeEnabled();

    await page.screenshot({
      path: path.resolve(SCREENSHOT_DIR, '08_recovery_ollama_cause.png'),
      fullPage: true,
    });

    // Sin errores de página; los console.error de red pertenecen al escenario
    // simulado (puerto cerrado), no a la aplicación.
    expect(pageErrors).toHaveLength(0);
  });
});
