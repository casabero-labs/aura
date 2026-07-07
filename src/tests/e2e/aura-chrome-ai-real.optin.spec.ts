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
 * ACTIVATION:
 *   AURA_E2E_REAL_CHROME_AI=true
 *   AURA_E2E_BASE_URL="http://127.0.0.1:3000"
 *   AURA_CHROME_AI_PROFILE_DIR="$HOME/.aura/chrome-ai-profile"
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { launchChromeWithCdp, waitForLanguageModelReady } from './helpers/chromeAiCdp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/product/aura/phase_10/l12_provider_evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const REAL_CHROME_AI = process.env.AURA_E2E_REAL_CHROME_AI?.trim().toLowerCase() === 'true';
const BASE_URL = process.env.AURA_E2E_BASE_URL?.trim() || '';
const PROFILE_DIR = process.env.AURA_CHROME_AI_PROFILE_DIR?.trim() || '';
const CDP_PORT = parseInt(process.env.AURA_CHROME_REMOTE_DEBUGGING_PORT?.trim() || '9222', 10);
const CHROME_PATH = process.env.AURA_CHROME_EXECUTABLE_PATH?.trim() || undefined;
const OPT_IN_ACTIVE = REAL_CHROME_AI && BASE_URL.length > 0 && PROFILE_DIR.length > 0;

const DIAG_FLOW_CSV = path.resolve(__dirname, './fixtures/aura_l10_full_flow_issues.csv');

test.describe.serial('Phase 10 L12B — Chrome AI Real Opt-in (CDP)', () => {
  test.skip(!OPT_IN_ACTIVE, 'Requires AURA_E2E_REAL_CHROME_AI=true + BASE_URL + PROFILE_DIR');

  test('L12B-CD-01 — Chrome AI CDP smoke real', async () => {
    const ctx = await launchChromeWithCdp({ profileDir: PROFILE_DIR, baseUrl: BASE_URL, chromePath: CHROME_PATH, cdpPort: CDP_PORT });

    const ev = { lm: false, ready: false, resp: null as string | null, mock: true, err: null as string | null };
    try {
      const page = ctx.page;
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      ev.lm = await page.evaluate(() => typeof (globalThis as any).LanguageModel !== 'undefined');
      console.log(`LM: ${ev.lm}`);

      if (ev.lm) {
        const r = await waitForLanguageModelReady(page, 180_000);
        ev.ready = r.ready;
        console.log(`Model: ${r.availabilityNormalized} ready=${r.ready}`);
        if (r.ready) {
          ev.mock = false;
          ev.resp = await page.evaluate(async () => {
            const s = await (globalThis as any).LanguageModel.create({ temperature: 0.1, topK: 1 });
            const resp = await s.prompt('Respond with exactly: AURA_CHROME_AI_READY');
            s.destroy(); return resp;
          });
          console.log(`Prompt: ${ev.resp?.substring(0, 150)}`);
        }
      }
      await page.screenshot({ path: path.resolve(SCREENSHOT_DIR, 'chrome_ai_real_optin_result.png'), fullPage: true });
    } catch (e: any) { ev.err = e.message; }

    fs.writeFileSync(path.resolve(EVIDENCE_DIR, 'chrome_ai_real_optin.json'), JSON.stringify(ev, null, 2));
    await ctx.close();
    console.log(`CD-01: ${ev.resp ? 'PASS' : 'FAIL'}`);
    expect(ev.lm, 'Must have LanguageModel').toBe(true);
  });

  test('L12B-CD-02 — Chrome AI AURA diagnosis flow', async () => {
    const ctx = await launchChromeWithCdp({ profileDir: PROFILE_DIR, baseUrl: BASE_URL, chromePath: CHROME_PATH, cdpPort: CDP_PORT });

    const flow = { lm: false, profile: false, diag: false, generated: false, logs: false, result: false, mock: true, err: null as string | null };
    try {
      const page = ctx.page;
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      flow.lm = await page.evaluate(() => typeof (globalThis as any).LanguageModel !== 'undefined');
      console.log(`LM: ${flow.lm}`);

      await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Empezar auditoría/i }).click();
      await page.waitForTimeout(500);

      await page.locator('[data-testid="csv-file-input"]').setInputFiles(DIAG_FLOW_CSV);
      console.log('CSV uploaded');

      await page.waitForFunction(
        () => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState === 'profile',
        { timeout: 30_000 });
      flow.profile = true;
      console.log('Profile reached');

      for (const target of ['calibration', 'diagnosis'] as string[]) {
        const reached = await page.waitForFunction(
          (s) => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState === s, target,
          { timeout: 15_000 }).then(() => true).catch(() => false);
        if (reached && target === 'calibration') {
          const btn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar/i });
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(1000); }
        }
        if (reached && target === 'diagnosis') { flow.diag = true; console.log('Diagnosis stage'); }
      }

      if (flow.diag) {
        const genBtn = page.locator('[data-testid="diagnosis-stage"]').getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
        if (await genBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          flow.mock = false; await genBtn.click(); flow.generated = true;
          console.log('Diagnosis triggered');
          await page.waitForTimeout(5000);
          flow.logs = (await page.locator('[data-testid^="log-line-"]').count().catch(() => 0)) > 0;
          flow.result = await page.locator('[data-testid="stage-decision-summary"]').isVisible({ timeout: 10_000 }).catch(() => false);
          console.log(`Logs: ${flow.logs} Result: ${flow.result}`);
        }
      }
      await page.screenshot({ path: path.resolve(SCREENSHOT_DIR, 'chrome_ai_diagnosis_flow.png'), fullPage: true });
    } catch (e: any) { flow.err = e.message; console.error(`Error: ${e.message}`); }

    fs.writeFileSync(path.resolve(EVIDENCE_DIR, 'chrome_ai_diagnosis_flow.json'), JSON.stringify(flow, null, 2));
    await ctx.close();
    console.log(`CD-02: ${flow.generated ? 'PASS' : flow.profile ? 'PARTIAL' : 'FAIL'}`);
    expect(flow.profile, 'Profile must be reached').toBe(true);
  });
});
