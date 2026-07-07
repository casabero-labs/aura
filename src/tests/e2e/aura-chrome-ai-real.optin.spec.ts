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
 * SMOKE ACTIVATION:
 *   AURA_E2E_REAL_CHROME_AI=true
 *   AURA_E2E_BASE_URL="http://127.0.0.1:3000"
 *   AURA_CHROME_AI_PROFILE_DIR="$HOME/.aura/chrome-ai-profile"
 *
 * FLOW ACTIVATION (additionally):
 *   AURA_E2E_REAL_CHROME_AI_FLOW=true
 *
 * Flow test is STRICT: requires Chrome AI real throughout the flow.
 * If harness forces mock provider, mock===false assertion fails → test fails.
 * Flow test does NOT use VITE_PHASE4_E2E_HARNESS (harness bypasses Chrome AI).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { launchChromeWithCdp, waitForLanguageModelReady } from './helpers/chromeAiCdp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REAL_CHROME_AI = process.env.AURA_E2E_REAL_CHROME_AI?.trim().toLowerCase() === 'true';
const REAL_FLOW = process.env.AURA_E2E_REAL_CHROME_AI_FLOW?.trim().toLowerCase() === 'true';
const BASE_URL = process.env.AURA_E2E_BASE_URL?.trim() || '';
const PROFILE_DIR = process.env.AURA_CHROME_AI_PROFILE_DIR?.trim() || '';
const CDP_PORT = parseInt(process.env.AURA_CHROME_REMOTE_DEBUGGING_PORT?.trim() || '9222', 10);
const CHROME_PATH = process.env.AURA_CHROME_EXECUTABLE_PATH?.trim() || undefined;
const SMOKE_ACTIVE = REAL_CHROME_AI && BASE_URL.length > 0 && PROFILE_DIR.length > 0;
const FLOW_ACTIVE = SMOKE_ACTIVE && REAL_FLOW;

const DIAG_FLOW_CSV = path.resolve(__dirname, './fixtures/aura_l10_full_flow_issues.csv');

/**
 * Installs an interceptor on globalThis.LanguageModel.create that records
 * every call made by the application (not by the test itself).
 * This provides evidence that the app actually used Chrome AI for diagnosis.
 *
 * Returns a cleanup function. Call after diagnosis completes and check
 * window.__AURA_CHROME_AI_CALLS__ for evidence.
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

  test('L12B-CD-02 — Chrome AI AURA diagnosis flow', async () => {
    test.skip(!FLOW_ACTIVE, 'Requires AURA_E2E_REAL_CHROME_AI_FLOW=true (flow test is strict: harness bypasses Chrome AI)');

    const ctx = await launchChromeWithCdp({ profileDir: PROFILE_DIR, baseUrl: BASE_URL, chromePath: CHROME_PATH, cdpPort: CDP_PORT });

    const flow = {
      lm: false,
      profile: false,
      diag: false,
      generated: false,
      logs: false,
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

      await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Empezar auditoría/i }).click();
      await page.waitForTimeout(500);

      await page.locator('[data-testid="csv-file-input"]').setInputFiles(DIAG_FLOW_CSV);

      await page.waitForFunction(
        () => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState === 'profile',
        { timeout: 30_000 });
      flow.profile = true;

      for (const target of ['calibration', 'diagnosis'] as string[]) {
        const reached = await page.waitForFunction(
          (s) => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState === s, target,
          { timeout: 15_000 }).then(() => true).catch(() => false);
        if (reached && target === 'calibration') {
          const btn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar/i });
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(1000); }
        }
        if (reached && target === 'diagnosis') { flow.diag = true; }
      }

      if (flow.diag) {
        const genBtn = page.locator('[data-testid="diagnosis-stage"]').getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
        if (await genBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await installLanguageModelInterceptor(page);
          await genBtn.click();
          flow.generated = true;
          await page.waitForTimeout(8000);
          flow.logs = (await page.locator('[data-testid^="log-line-"]').count().catch(() => 0)) > 0;
          flow.result = await page.locator('[data-testid="stage-decision-summary"]').isVisible({ timeout: 10_000 }).catch(() => false);

          const calls = await page.evaluate(() => (window as any).__AURA_CHROME_AI_CALLS__);
          flow.realChromeAiCreateCalled = !!(calls?.createCalled);
          flow.realChromeAiPromptCalled = !!(calls?.promptCalled);
          flow.usedRealChromeAi = flow.realChromeAiCreateCalled && flow.realChromeAiPromptCalled;
        }
      }
    } catch (e: any) { flow.err = e.message; }

    await ctx.close();

    expect(flow.lm, 'Chrome AI LanguageModel must be present').toBe(true);
    expect(flow.profile, 'Profile stage must be reached').toBe(true);
    expect(flow.diag, 'Diagnosis stage must be reached').toBe(true);
    expect(flow.generated, 'Diagnosis must be generated').toBe(true);
    expect(flow.result, 'Diagnosis result must be visible').toBe(true);
    expect(flow.usedRealChromeAi, 'App must call real LanguageModel.create and prompt for diagnosis').toBe(true);
    expect(flow.realChromeAiCreateCalled, 'LanguageModel.create must have been called by the app').toBe(true);
    expect(flow.realChromeAiPromptCalled, 'LanguageModel session.prompt must have been called by the app').toBe(true);
  });
});
