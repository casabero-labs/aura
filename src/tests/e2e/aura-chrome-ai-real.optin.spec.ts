/**
 * Phase 10 L12B — Chrome AI Real Opt-In Test.
 * Tests REAL Gemini Nano via dedicated profile, launched natively + CDP.
 *
 * Uses child_process.spawn to launch Chrome with full Prompt API flags,
 * then chromium.connectOverCDP() to connect. This avoids Playwright's
 * launchPersistentContext which injects --disable-* flags blocking
 * the on-device model service.
 *
 * Tests run SERIALLY — Chrome profile locks to a single instance.
 *
 * TARGET: Production (https://aura.casabero.com)
 * Chrome AI / Gemini Nano are local to the user's Chrome profile.
 * AURA itself is tested against PRODUCTION.
 *
 * SMOKE ACTIVATION:
 *   AURA_E2E_REAL_CHROME_AI=true
 *   AURA_E2E_BASE_URL="https://aura.casabero.com"  (default)
 *   AURA_CHROME_AI_PROFILE_DIR="$HOME/.aura/chrome-ai-profile"
 *
 * FLOW ACTIVATION (additionally):
 *   AURA_E2E_REAL_CHROME_AI_FLOW=true
 *
 * Flow test is STRICT: requires Chrome AI real throughout the flow.
 * Flow runs against PRODUCTION — NO harness, NO __PHASE4_GET_STATE__,
 * NO dev server, NO mocks. Navigation via real UI selectors only.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { launchChromeWithCdp, waitForLanguageModelReady } from './helpers/chromeAiCdp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REAL_CHROME_AI = process.env.AURA_E2E_REAL_CHROME_AI?.trim().toLowerCase() === 'true';
const REAL_FLOW = process.env.AURA_E2E_REAL_CHROME_AI_FLOW?.trim().toLowerCase() === 'true';
const BASE_URL = process.env.AURA_E2E_BASE_URL?.trim() || 'https://aura.casabero.com';
const PROFILE_DIR = process.env.AURA_CHROME_AI_PROFILE_DIR?.trim() || '';
const CDP_PORT = parseInt(process.env.AURA_CHROME_REMOTE_DEBUGGING_PORT?.trim() || '9222', 10);
const CHROME_PATH = process.env.AURA_CHROME_EXECUTABLE_PATH?.trim() || undefined;
const SMOKE_ACTIVE = REAL_CHROME_AI && BASE_URL.length > 0 && PROFILE_DIR.length > 0;
const FLOW_ACTIVE = SMOKE_ACTIVE && REAL_FLOW;

const DIAG_FLOW_CSV = path.resolve(__dirname, './fixtures/aura_l10_full_flow_issues.csv');

/**
 * Installs an interceptor on globalThis.LanguageModel.create that records
 * every call made by the APPLICATION (not by the test itself).
 * This proves the app actually used Chrome AI for diagnosis.
 *
 * The interceptor wraps LanguageModel.create to catch:
 * - createCalled: whether the app created a session
 * - promptCalled: whether session.prompt was called with the diagnosis prompt
 * - responses: the raw text responses captured (truncated to 500 chars)
 */
async function installLanguageModelInterceptor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const lm = (globalThis as any).LanguageModel;
    if (!lm || typeof lm.create !== 'function') return;

    (window as any).__AURA_CHROME_AI_CALLS__ = {
      createCalled: false,
      promptCalled: false,
      responses: [] as string[],
    };

    const originalCreate = lm.create.bind(lm);

    (lm as any).create = async (...createArgs: any[]) => {
      (window as any).__AURA_CHROME_AI_CALLS__.createCalled = true;
      const session = await originalCreate(...createArgs);
      const originalPrompt = session.prompt?.bind(session);

      if (typeof originalPrompt === 'function') {
        (session as any).prompt = async (...promptArgs: any[]) => {
          (window as any).__AURA_CHROME_AI_CALLS__.promptCalled = true;
          const response = await originalPrompt(...promptArgs);
          (window as any).__AURA_CHROME_AI_CALLS__.responses.push(
            typeof response === 'string' ? response.slice(0, 500) : String(response),
          );
          return response;
        };
      }

      return session;
    };
  });
}

type ResetResult =
  | { stateDetected: 'clean_upload'; resetAttempted: false; resetSucceeded: true; uploadInputVisible: true }
  | { stateDetected: 'advanced_existing_dataset'; resetAttempted: true; resetSucceeded: boolean; uploadInputVisible: boolean }
  | { stateDetected: 'unknown'; resetAttempted: false; resetSucceeded: false; uploadInputVisible: false };

/**
 * Detects and resets the app to the upload step if needed.
 * Production may have persistent state from a previous session.
 */
async function resetToUploadIfNeeded(page: Page): Promise<ResetResult> {
  const uploadInput = page.locator('[data-testid="csv-file-input"]');

  if (await uploadInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { stateDetected: 'clean_upload', resetAttempted: false, resetSucceeded: true, uploadInputVisible: true };
  }

  const advancedStateVisible =
    await page.getByText(/PERFIL DEL DATASET/i).isVisible({ timeout: 3000 }).catch(() => false)
    || await page.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i }).isVisible({ timeout: 3000 }).catch(() => false)
    || await page.getByText(/Riesgo moderado|Riesgo alto|Riesgo bajo/i).isVisible({ timeout: 3000 }).catch(() => false);

  const nuevoAnalisis = page.getByRole('button', { name: /NUEVO ANÁLISIS|Nuevo análisis/i });

  if (advancedStateVisible || await nuevoAnalisis.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (await nuevoAnalisis.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nuevoAnalisis.click();
      await page.waitForTimeout(2000);
      try {
        await uploadInput.waitFor({ state: 'attached', timeout: 8000 });
        const visibleAfterReset = await uploadInput.isVisible({ timeout: 5000 }).catch(() => false);
        return {
          stateDetected: 'advanced_existing_dataset',
          resetAttempted: true,
          resetSucceeded: visibleAfterReset,
          uploadInputVisible: visibleAfterReset,
        };
      } catch {
        return {
          stateDetected: 'advanced_existing_dataset',
          resetAttempted: true,
          resetSucceeded: false,
          uploadInputVisible: false,
        };
      }
    }
  }

  return { stateDetected: 'unknown', resetAttempted: false, resetSucceeded: false, uploadInputVisible: false };
}

test.describe.serial('Phase 10 L12B — Chrome AI Real Opt-in (CDP)', () => {
  test.skip(!SMOKE_ACTIVE, 'Requires AURA_E2E_REAL_CHROME_AI=true + BASE_URL + PROFILE_DIR');

  test('L12B-CD-01 — Chrome AI CDP smoke real', async () => {
    const ctx = await launchChromeWithCdp({ profileDir: PROFILE_DIR, baseUrl: BASE_URL, chromePath: CHROME_PATH, cdpPort: CDP_PORT });

    const ev = { lm: false, ready: false, resp: null as string | null, mock: true, err: null as string | null };
    try {
      const page = ctx.page;
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      ev.lm = await page.evaluate(() => typeof (globalThis as any).LanguageModel !== 'undefined');

      if (ev.lm) {
        const r = await waitForLanguageModelReady(page, 180_000);
        ev.ready = r.ready;
        if (r.ready) {
          ev.mock = false;
          ev.resp = await page.evaluate(async () => {
            const s = await (globalThis as any).LanguageModel.create({ temperature: 0.1, topK: 1 });
            const resp = await s.prompt('Respond with exactly: AURA_CHROME_AI_READY');
            s.destroy(); return resp;
          });
        }
      }
    } catch (e: any) { ev.err = e.message; }

    await ctx.close();
    expect(ev.lm, 'Must have LanguageModel').toBe(true);
    expect(ev.ready, 'Model must be ready').toBe(true);
    expect(ev.mock, 'Must use real Chrome AI, not mock').toBe(false);
  });

  test('L12B-CD-02 — Chrome AI AURA diagnosis flow (production)', async () => {
    test.skip(!FLOW_ACTIVE, 'Requires AURA_E2E_REAL_CHROME_AI_FLOW=true');

    const ctx = await launchChromeWithCdp({ profileDir: PROFILE_DIR, baseUrl: BASE_URL, chromePath: CHROME_PATH, cdpPort: CDP_PORT });

    const flow = {
      lm: false,
      initialState: 'unknown' as ResetResult['stateDetected'],
      resetAttempted: false,
      resetSucceeded: false,
      uploadInputVisible: false,
      uploaded: false,
      profileStageReached: false,
      calibrationStageReached: false,
      diagStageReached: false,
      generated: false,
      result: false,
      usedRealChromeAi: false,
      realChromeAiCreateCalled: false,
      realChromeAiPromptCalled: false,
      err: null as string | null,
    };
    try {
      const page = ctx.page;
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      flow.lm = await page.evaluate(() => typeof (globalThis as any).LanguageModel !== 'undefined');

      // ── 0. Home: click "Empezar auditoría" ──
      await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Empezar auditoría/i }).click();

      // ── 1. State normalization: handle persistent state from previous session ──
      const resetState = await resetToUploadIfNeeded(page);
      flow.initialState = resetState.stateDetected;
      flow.resetAttempted = resetState.resetAttempted;
      flow.resetSucceeded = resetState.resetSucceeded;
      flow.uploadInputVisible = resetState.uploadInputVisible;

      if (!flow.uploadInputVisible) {
        throw new Error(
          `SELECTOR_REQUIRED: upload input not visible after reset (state=${resetState.stateDetected})`,
        );
      }

      // ── 2. Upload step: upload CSV ──
      await page.locator('[data-testid="csv-file-input"]').setInputFiles(DIAG_FLOW_CSV);
      flow.uploaded = true;

      // ── 3. Profile stage: wait for "Continuar" button to be ready ──
      try {
        await page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar/i })
          .waitFor({ state: 'visible', timeout: 30_000 });
        flow.profileStageReached = true;
      } catch {
        flow.profileStageReached = await page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar/i })
          .isVisible({ timeout: 5000 }).catch(() => false);
      }

      // ── 4. Calibration stage: click "Continuar" if visible ──
      if (flow.profileStageReached) {
        const calBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar/i });
        if (await calBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await calBtn.click();
          flow.calibrationStageReached = true;
          await page.waitForTimeout(2000);
        }
      }

      // ── 5. Diagnosis stage: click "Continuar" again if visible ──
      const calBtn2 = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar/i });
      if (await calBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
        await calBtn2.click();
        await page.waitForTimeout(2000);
      }

      // ── 6. Diagnosis stage: locate and click "Generar diagnóstico" ──
      const diagBtn = page.locator('[data-testid="diagnosis-stage"]').getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
      const diagVisible = await diagBtn.isVisible({ timeout: 10_000 }).catch(() => false);

      if (diagVisible) {
        flow.diagStageReached = true;
        await installLanguageModelInterceptor(page);
        await diagBtn.click();
        flow.generated = true;

        // ── 7. Wait for diagnosis result to appear ──
        await page.waitForTimeout(10_000);
        flow.result = await page.locator('[data-testid="stage-decision-summary"]')
          .isVisible({ timeout: 15_000 }).catch(() => false);

        // ── 8. Read Chrome AI usage evidence ──
        const calls = await page.evaluate(() => (window as any).__AURA_CHROME_AI_CALLS__);
        flow.realChromeAiCreateCalled = !!(calls?.createCalled);
        flow.realChromeAiPromptCalled = !!(calls?.promptCalled);
        flow.usedRealChromeAi = flow.realChromeAiCreateCalled && flow.realChromeAiPromptCalled;
      }
    } catch (e: any) { flow.err = e.message; }

    await ctx.close();

    // ── Strict assertions: NO partial pass, NO manual mock flag ──
    expect(flow.lm, 'Chrome AI LanguageModel must be present').toBe(true);
    expect(flow.uploadInputVisible, 'Upload input must be visible after reset/state normalization').toBe(true);
    expect(flow.uploaded, 'CSV must be uploaded').toBe(true);
    expect(flow.profileStageReached, 'Profile stage must be reached').toBe(true);
    expect(flow.diagStageReached, 'Diagnosis stage must be reached').toBe(true);
    expect(flow.generated, 'Diagnosis must be generated (button clicked)').toBe(true);
    expect(flow.result, 'Diagnosis result must be visible in UI').toBe(true);
    expect(flow.usedRealChromeAi, 'App must call real LanguageModel.create AND session.prompt for diagnosis').toBe(true);
    expect(flow.realChromeAiCreateCalled, 'LanguageModel.create must have been called by the app').toBe(true);
    expect(flow.realChromeAiPromptCalled, 'session.prompt must have been called by the app').toBe(true);
  });
});
