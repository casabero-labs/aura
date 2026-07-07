/**
 * Phase 10 L12B — Chrome AI Real Opt-In Test.
 *
 * Tests REAL Gemini Nano availability via a dedicated persistent Chrome profile.
 *
 * ACTIVATION (all required):
 *   AURA_E2E_REAL_CHROME_AI=true
 *   AURA_E2E_BASE_URL="https://aura.casabero.com"
 *   AURA_CHROME_AI_PROFILE_DIR="$HOME/.aura/chrome-ai-profile"
 *
 * RULES:
 *   - Does NOT run by default (opt-in only).
 *   - Does NOT run in standard CI.
 *   - Does NOT use personal Chrome profile.
 *   - Rejects unsafe profile paths (Default, Profile 1, etc.).
 *   - Does NOT fail standard pipeline if Gemini Nano unavailable.
 *   - Records honest state — never invents success.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/product/aura/phase_10/l12_provider_evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Opt-in guard ──────────────────────────────────────────────────────────

const REAL_CHROME_AI = process.env.AURA_E2E_REAL_CHROME_AI?.trim().toLowerCase() === 'true';
const BASE_URL = process.env.AURA_E2E_BASE_URL?.trim() || '';
const PROFILE_DIR = process.env.AURA_CHROME_AI_PROFILE_DIR?.trim() || '';

const OPT_IN_ACTIVE = REAL_CHROME_AI && BASE_URL.length > 0 && PROFILE_DIR.length > 0;

// ── Profile safety validation ─────────────────────────────────────────────

const UNSAFE_PROFILE_NAMES = ['default', 'profile 1', 'profile 2', 'profile 3', 'profile 4'];
function isUnsafeProfilePath(dirPath: string): string | null {
  const lowerDir = dirPath.toLowerCase();
  for (const name of UNSAFE_PROFILE_NAMES) {
    if (lowerDir.includes(name)) {
      return name;
    }
  }
  return null;
}

function validateProfilePath(dirPath: string): { valid: boolean; reason?: string } {
  if (!dirPath || dirPath.length === 0) {
    return { valid: false, reason: 'Profile path is empty' };
  }

  const unsafe = isUnsafeProfilePath(dirPath);
  if (unsafe) {
    return { valid: false, reason: `Profile path contains unsafe name: "${unsafe}"` };
  }

  const chromeDefaults = [
    '/chrome/user data',
    '\\chrome\\user data',
    '/google/chrome',
    '\\google\\chrome',
    '/chromium',
    '\\chromium',
    '/brave',
    '\\brave',
  ];
  const lower = dirPath.toLowerCase();
  for (const def of chromeDefaults) {
    if (lower.includes(def)) {
      return { valid: false, reason: `Profile path looks like a default Chrome data dir: "${def}"` };
    }
  }

  const auraProfileMarker = '.aura';
  if (!lower.includes(auraProfileMarker)) {
    return { valid: false, reason: 'Profile path must be under .aura dedicated directory' };
  }

  return { valid: true };
}

// ── Evidence collector ────────────────────────────────────────────────────

interface ChromeAiRealEvidence {
  testRun: {
    timestamp: string;
    phase: string;
    testId: string;
    optIn: boolean;
    envVars: {
      AURA_E2E_REAL_CHROME_AI: string;
      AURA_E2E_BASE_URL: string;
      AURA_CHROME_AI_PROFILE_DIR: string;
    };
    profileValidation: { valid: boolean; reason?: string };
    profilePath: string;
  };
  chromeAi: {
    languageModelInGlobalThis: boolean;
    availabilityMethodCalled: boolean;
    availabilityResult: string | null;
    availabilityNormalized: string | null;
    sessionCreated: boolean;
    promptExecuted: boolean;
    promptResponse: string | null;
    ackResponseMatch: boolean;
    error: string | null;
  };
  evidenceStatus: string;
  outputRecorded: boolean;
  outputPath: string;
  screenshotPath: string;
  allPassed: boolean;
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Phase 10 L12B — Chrome AI Real Opt-in', () => {

  test.skip(!OPT_IN_ACTIVE, `
    Chrome AI real opt-in test requires:
      AURA_E2E_REAL_CHROME_AI=true
      AURA_E2E_BASE_URL=<url>
      AURA_CHROME_AI_PROFILE_DIR=<dir>
  `);

  test('L12B-01 — Chrome AI real validation with dedicated profile', async () => {
    // 1. Validate profile path
    const profileValidation = validateProfilePath(PROFILE_DIR);
    expect(profileValidation.valid, `Profile validation: ${profileValidation.reason}`).toBe(true);

    // 2. Ensure profile directory exists
    fs.mkdirSync(PROFILE_DIR, { recursive: true });

    // 3. Launch persistent context with dedicated profile
    const { chromium } = await import('playwright');
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: 'chrome',
      headless: false,
      args: [
        '--enable-features=PromptAPI,OptimizationGuideOnDeviceModel',
        '--enable-optimization-guide-on-device-model',
      ],
    });

    const evidence: ChromeAiRealEvidence = {
      testRun: {
        timestamp: new Date().toISOString(),
        phase: 'L12B',
        testId: 'L12B-01',
        optIn: true,
        envVars: {
          AURA_E2E_REAL_CHROME_AI: String(process.env.AURA_E2E_REAL_CHROME_AI),
          AURA_E2E_BASE_URL: process.env.AURA_E2E_BASE_URL || '',
          AURA_CHROME_AI_PROFILE_DIR: process.env.AURA_CHROME_AI_PROFILE_DIR || '',
        },
        profileValidation,
        profilePath: PROFILE_DIR,
      },
      chromeAi: {
        languageModelInGlobalThis: false,
        availabilityMethodCalled: false,
        availabilityResult: null,
        availabilityNormalized: null,
        sessionCreated: false,
        promptExecuted: false,
        promptResponse: null,
        ackResponseMatch: false,
        error: null,
      },
      evidenceStatus: 'incomplete',
      outputRecorded: false,
      outputPath: '',
      screenshotPath: '',
      allPassed: false,
    };

    try {
      const page = context.pages()[0] || await context.newPage();

      // 4. Navigate to AURA
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // 5. Check globalThis.LanguageModel
      const hasLanguageModel = await page.evaluate(() => {
        return typeof (globalThis as any).LanguageModel !== 'undefined';
      });
      evidence.chromeAi.languageModelInGlobalThis = hasLanguageModel;
      console.log(`globalThis.LanguageModel: ${hasLanguageModel}`);

      // 6. Try availability
      if (hasLanguageModel) {
        evidence.chromeAi.availabilityMethodCalled = true;
        try {
          const availabilityResult = await page.evaluate(async () => {
            const lm = (globalThis as any).LanguageModel;
            if (typeof lm.availability === 'function') {
              const result = await lm.availability();
              return JSON.stringify(result);
            }
            return null;
          });

          evidence.chromeAi.availabilityResult = availabilityResult;
          console.log(`LanguageModel.availability(): ${availabilityResult}`);

          // Normalize availability
          if (availabilityResult) {
            try {
              const parsed = JSON.parse(availabilityResult);
              const rawValue = typeof parsed === 'string' ? parsed
                : parsed?.available || parsed?.status || null;

              if (rawValue === 'readily' || rawValue === 'available') {
                evidence.chromeAi.availabilityNormalized = 'ready';
              } else if (rawValue === 'after-download' || rawValue === 'downloadable') {
                evidence.chromeAi.availabilityNormalized = 'downloadable';
              } else if (rawValue === 'downloading') {
                evidence.chromeAi.availabilityNormalized = 'downloading';
              } else if (rawValue === 'no' || rawValue === 'unavailable') {
                evidence.chromeAi.availabilityNormalized = 'unavailable';
              } else {
                evidence.chromeAi.availabilityNormalized = `unknown:${rawValue}`;
              }
            } catch {
              evidence.chromeAi.availabilityNormalized = `parse_error:${availabilityResult}`;
            }
          }

          // 8. If available, execute prompt
          if (evidence.chromeAi.availabilityNormalized === 'ready') {
            evidence.chromeAi.sessionCreated = true;
            try {
              const response = await page.evaluate(async () => {
                const lm = (globalThis as any).LanguageModel;
                const session = await lm.create();
                const result = await session.prompt('Responde exactamente: AURA_OK');
                session.destroy();
                return result;
              });

              evidence.chromeAi.promptExecuted = true;
              evidence.chromeAi.promptResponse = response;
              evidence.chromeAi.ackResponseMatch = response?.includes('AURA_OK') === true;
              console.log(`Prompt response: ${response?.substring(0, 100)}`);
            } catch (e: any) {
              evidence.chromeAi.error = `Prompt execution failed: ${e.message}`;
              console.error(evidence.chromeAi.error);
            }
          } else {
            const statusMsg = `Chrome AI not ready: ${evidence.chromeAi.availabilityNormalized}`;
            evidence.chromeAi.error = statusMsg;
            console.log(statusMsg);
          }
        } catch (e: any) {
          evidence.chromeAi.error = `Availability check failed: ${e.message}`;
          console.error(evidence.chromeAi.error);
        }
      } else {
        evidence.chromeAi.error = 'globalThis.LanguageModel not found in this browser';
        console.log(evidence.chromeAi.error);
      }

      // Screenshot
      const screenshotFile = 'chrome_ai_real_optin_result.png';
      await page.screenshot({
        path: path.resolve(SCREENSHOT_DIR, screenshotFile),
        fullPage: true,
      });
      evidence.screenshotPath = `screenshots/${screenshotFile}`;

      await context.close();
    } catch (e: any) {
      evidence.chromeAi.error = evidence.chromeAi.error
        ? `${evidence.chromeAi.error}; Context error: ${e.message}`
        : `Context error: ${e.message}`;
      console.error(evidence.chromeAi.error);
    }

    // Determine overall status
    if (evidence.chromeAi.languageModelInGlobalThis && evidence.chromeAi.promptResponse) {
      evidence.evidenceStatus = evidence.chromeAi.ackResponseMatch
        ? 'preliminary_valid'
        : 'attempted_failed';
    } else if (evidence.chromeAi.languageModelInGlobalThis && evidence.chromeAi.availabilityResult) {
      evidence.evidenceStatus = 'attempted_failed';
    } else if (evidence.chromeAi.error) {
      evidence.evidenceStatus = 'attempted_failed';
    }
    evidence.allPassed = evidence.chromeAi.ackResponseMatch === true;

    // 11. Write evidence JSON
    const outputPath = path.resolve(EVIDENCE_DIR, 'chrome_ai_real_optin.json');
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
    evidence.outputRecorded = true;
    evidence.outputPath = outputPath;

    // Never fail the test — we document the state honestly
    // The test only FAILS if something unexpected (like profile validation)
    expect(profileValidation.valid).toBe(true);
    console.log(`L12B complete. Status: ${evidence.evidenceStatus}`);
    console.log(`Evidence: ${outputPath}`);
  });
});
