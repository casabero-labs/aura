/**
 * Phase 10 L12B — Chrome AI Real Opt-In Test.
 *
 * Tests REAL Gemini Nano availability via a dedicated Chrome profile
 * launched natively and connected via Playwright CDP (connectOverCDP).
 *
 * ACTIVATION (all required):
 *   AURA_E2E_REAL_CHROME_AI=true
 *   AURA_E2E_BASE_URL="http://127.0.0.1:3000"
 *   AURA_CHROME_AI_PROFILE_DIR="$HOME/.aura/chrome-ai-profile"
 *
 * OPTIONAL:
 *   AURA_CHROME_REMOTE_DEBUGGING_PORT=9222
 *   AURA_CHROME_EXECUTABLE_PATH=/path/to/chrome
 *
 * RULES:
 *   - Does NOT run by default (opt-in only).
 *   - Does NOT run in standard CI.
 *   - Does NOT use personal Chrome profile.
 *   - Rejects unsafe profile paths (Default, Profile 1, etc.).
 *   - Does NOT fail standard pipeline if Gemini Nano unavailable.
 *   - Records honest state — never invents success.
 *   - Chrome is launched natively via child_process, NOT via launchPersistentContext.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  launchChromeWithCdp,
  waitForLanguageModelReady,
} from './helpers/chromeAiCdp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/product/aura/phase_10/l12_provider_evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Opt-in guard ──────────────────────────────────────────────────────────

const REAL_CHROME_AI = process.env.AURA_E2E_REAL_CHROME_AI?.trim().toLowerCase() === 'true';
const BASE_URL = process.env.AURA_E2E_BASE_URL?.trim() || '';
const PROFILE_DIR = process.env.AURA_CHROME_AI_PROFILE_DIR?.trim() || '';
const CDP_PORT = parseInt(process.env.AURA_CHROME_REMOTE_DEBUGGING_PORT?.trim() || '9222', 10);
const CHROME_PATH = process.env.AURA_CHROME_EXECUTABLE_PATH?.trim() || undefined;

const OPT_IN_ACTIVE = REAL_CHROME_AI && BASE_URL.length > 0 && PROFILE_DIR.length > 0;

// ── Evidence collector ────────────────────────────────────────────────────

interface ChromeAiRealEvidence {
  testRun: {
    timestamp: string;
    phase: string;
    testId: string;
    launchMethod: string;
    optIn: boolean;
    envVars: {
      AURA_E2E_REAL_CHROME_AI: string;
      AURA_E2E_BASE_URL: string;
      AURA_CHROME_AI_PROFILE_DIR: string;
      AURA_CHROME_REMOTE_DEBUGGING_PORT: string;
    };
    profilePath: string;
    chromePath: string;
    cdpPort: number;
  };
  chromeAi: {
    languageModelInGlobalThis: boolean;
    availabilityMethodCalled: boolean;
    availabilityResult: string | null;
    availabilityNormalized: string | null;
    modelReady: boolean;
    waitDurationMs: number;
    sessionCreated: boolean;
    promptExecuted: boolean;
    promptResponse: string | null;
    responseNonEmpty: boolean;
    usedMockProvider: boolean;
    error: string | null;
  };
  evidenceStatus: string;
  outputRecorded: boolean;
  outputPath: string;
  screenshotPath: string;
  allPassed: boolean;
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Phase 10 L12B — Chrome AI Real Opt-in (CDP)', () => {

  test.skip(!OPT_IN_ACTIVE, `
    Chrome AI real opt-in test requires:
      AURA_E2E_REAL_CHROME_AI=true
      AURA_E2E_BASE_URL=<url>
      AURA_CHROME_AI_PROFILE_DIR=<dir>
  `);

  test('L12B-CD-01 — Chrome AI CDP smoke real', async () => {
    const evidence: ChromeAiRealEvidence = {
      testRun: {
        timestamp: new Date().toISOString(),
        phase: 'L12B-CD',
        testId: 'L12B-CD-01',
        launchMethod: 'native_chrome_cdp',
        optIn: true,
        envVars: {
          AURA_E2E_REAL_CHROME_AI: String(process.env.AURA_E2E_REAL_CHROME_AI),
          AURA_E2E_BASE_URL: process.env.AURA_E2E_BASE_URL || '',
          AURA_CHROME_AI_PROFILE_DIR: process.env.AURA_CHROME_AI_PROFILE_DIR || '',
          AURA_CHROME_REMOTE_DEBUGGING_PORT: String(CDP_PORT),
        },
        profilePath: PROFILE_DIR,
        chromePath: CHROME_PATH || '(auto)',
        cdpPort: CDP_PORT,
      },
      chromeAi: {
        languageModelInGlobalThis: false,
        availabilityMethodCalled: false,
        availabilityResult: null,
        availabilityNormalized: null,
        modelReady: false,
        waitDurationMs: 0,
        sessionCreated: false,
        promptExecuted: false,
        promptResponse: null,
        responseNonEmpty: false,
        usedMockProvider: true,
        error: null,
      },
      evidenceStatus: 'incomplete',
      outputRecorded: false,
      outputPath: '',
      screenshotPath: '',
      allPassed: false,
    };

    let cdpCtx: Awaited<ReturnType<typeof launchChromeWithCdp>> | null = null;

    try {
      // 1. Launch Chrome natively via CDP
      const waitStart = Date.now();
      console.log(`Launching Chrome with profile: ${PROFILE_DIR}`);
      cdpCtx = await launchChromeWithCdp({
        profileDir: PROFILE_DIR,
        baseUrl: BASE_URL,
        chromePath: CHROME_PATH,
        cdpPort: CDP_PORT,
      });

      const page = cdpCtx.page;

      // 2. Navigate to AURA
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // 3. Check globalThis.LanguageModel
      const hasLanguageModel = await page.evaluate(() => {
        return typeof (globalThis as any).LanguageModel !== 'undefined';
      });
      evidence.chromeAi.languageModelInGlobalThis = hasLanguageModel;
      console.log(`globalThis.LanguageModel: ${hasLanguageModel}`);

      // 4. Wait for model readiness (retry for downloading)
      if (hasLanguageModel) {
        evidence.chromeAi.availabilityMethodCalled = true;

        const readyResult = await waitForLanguageModelReady(page, 180_000);
        evidence.chromeAi.availabilityNormalized = readyResult.availabilityNormalized;
        evidence.chromeAi.availabilityResult = readyResult.availabilityRaw;
        evidence.chromeAi.modelReady = readyResult.ready;
        evidence.chromeAi.waitDurationMs = Date.now() - waitStart;
        console.log(`Model availability: ${readyResult.availabilityNormalized} (${readyResult.ready ? 'ready' : 'not ready'})`);

        // 5. Execute prompt if ready
        if (readyResult.ready) {
          evidence.chromeAi.usedMockProvider = false;
          try {
            evidence.chromeAi.sessionCreated = true;
            const response = await page.evaluate(async () => {
              const lm = (globalThis as any).LanguageModel;
              const session = await lm.create({ temperature: 0.1, topK: 1 });
              const result = await session.prompt('Respond with exactly: AURA_CHROME_AI_READY');
              session.destroy();
              return result;
            });

            evidence.chromeAi.promptExecuted = true;
            evidence.chromeAi.promptResponse = response;
            evidence.chromeAi.responseNonEmpty = typeof response === 'string' && response.trim().length > 0;
            console.log(`Prompt response: ${response?.substring(0, 150)}`);
          } catch (e: any) {
            evidence.chromeAi.error = `Prompt execution failed: ${e.message}`;
            console.error(evidence.chromeAi.error);
          }
        } else {
          evidence.chromeAi.error = `Chrome AI not ready: ${readyResult.availabilityNormalized}`;
          console.log(evidence.chromeAi.error);
        }
      } else {
        evidence.chromeAi.error = 'globalThis.LanguageModel not found in this browser';
        console.log(evidence.chromeAi.error);
      }

      // 6. Screenshot
      const screenshotFile = 'chrome_ai_real_optin_result.png';
      await page.screenshot({
        path: path.resolve(SCREENSHOT_DIR, screenshotFile),
        fullPage: true,
      });
      evidence.screenshotPath = `screenshots/${screenshotFile}`;

    } catch (e: any) {
      evidence.chromeAi.error = evidence.chromeAi.error
        ? `${evidence.chromeAi.error}; Context error: ${e.message}`
        : `Context error: ${e.message}`;
      console.error(evidence.chromeAi.error);
    } finally {
      if (cdpCtx) {
        await cdpCtx.close();
      }
    }

    // 7. Determine overall status
    if (evidence.chromeAi.languageModelInGlobalThis && evidence.chromeAi.promptExecuted && evidence.chromeAi.responseNonEmpty) {
      evidence.evidenceStatus = 'preliminary_valid';
    } else if (evidence.chromeAi.languageModelInGlobalThis && evidence.chromeAi.modelReady) {
      evidence.evidenceStatus = 'attempted';  // ready but prompt failed
    } else if (evidence.chromeAi.error) {
      evidence.evidenceStatus = 'attempted_failed';
    }
    evidence.allPassed = evidence.chromeAi.promptExecuted === true && evidence.chromeAi.responseNonEmpty === true;

    // 8. Write evidence JSON
    const outputPath = path.resolve(EVIDENCE_DIR, 'chrome_ai_real_optin.json');
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
    evidence.outputRecorded = true;
    evidence.outputPath = outputPath;

    console.log(`L12B-CD complete. Status: ${evidence.evidenceStatus}`);
    console.log(`Evidence: ${outputPath}`);

    // Assert: at minimum LanguageModel must exist since we're on Chrome with flags
    expect(evidence.chromeAi.languageModelInGlobalThis, 'LanguageModel must exist in Chrome with Prompt API flags').toBe(true);
  });
});
