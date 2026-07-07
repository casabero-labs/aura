/**
 * Chrome AI CDP helper — launches Chrome natively with Prompt API flags
 * and connects via Playwright connectOverCDP.
 *
 * Opt-in only: requires AURA_E2E_REAL_CHROME_AI=true
 * Never runs in standard CI.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright';

export interface CdpContext {
  browser: Browser;
  browserProcess: ChildProcess;
  page: Page;
  close: () => Promise<void>;
}

const DEFAULT_CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const DEFAULT_CDP_PORT = 9222;

const UNSAFE_PROFILE_NAMES = [
  'default',
  'profile 1',
  'profile 2',
  'profile 3',
  'profile 4',
];

function validateProfilePath(dirPath: string): { valid: boolean; reason?: string } {
  if (!dirPath || dirPath.length === 0) {
    return { valid: false, reason: 'Profile path is empty' };
  }

  const lowerDir = dirPath.toLowerCase();
  for (const name of UNSAFE_PROFILE_NAMES) {
    if (lowerDir.includes(name)) {
      return { valid: false, reason: `Profile path contains unsafe name: "${name}"` };
    }
  }

  const chromeDefaults = [
    '/chrome/user data',
    '/google/chrome',
    '/chromium',
    '/brave',
  ];
  for (const def of chromeDefaults) {
    if (lowerDir.includes(def)) {
      return { valid: false, reason: `Profile path looks like a default Chrome data dir: "${def}"` };
    }
  }

  const allowNonAura = process.env.AURA_ALLOW_NON_AURA_PROFILE?.trim().toLowerCase() === 'true';
  if (!allowNonAura && !lowerDir.includes('.aura')) {
    return { valid: false, reason: 'Profile path must be under .aura dedicated directory' };
  }

  return { valid: true };
}

async function waitForPort(port: number, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // port not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`CDP port ${port} not available after ${timeoutMs}ms`);
}

export async function launchChromeWithCdp(options: {
  profileDir: string;
  baseUrl: string;
  chromePath?: string;
  cdpPort?: number;
}): Promise<CdpContext> {
  const chromePath = options.chromePath || DEFAULT_CHROME_PATH;
  const cdpPort = options.cdpPort || DEFAULT_CDP_PORT;

  // Safety
  const validation = validateProfilePath(options.profileDir);
  if (!validation.valid) {
    throw new Error(`Unsafe profile: ${validation.reason}`);
  }

  const args = [
    `--user-data-dir=${options.profileDir}`,
    `--remote-debugging-port=${cdpPort}`,
    '--no-first-run',
    '--no-sandbox',
    '--enable-features=PromptAPI,OptimizationGuideOnDeviceModel,PromptAPIForGeminiNano,BuiltInAIOnDeviceModel',
    '--enable-optimization-guide-on-device-model',
    options.baseUrl,
  ];

  console.log(`Launching Chrome: ${chromePath}`);
  const browserProcess = spawn(chromePath, args, {
    stdio: 'ignore',
    detached: false,
  });

  // Wait for CDP
  await waitForPort(cdpPort, 20_000);
  console.log(`CDP ready on port ${cdpPort}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0] || await contexts[0].newPage();

  return {
    browser,
    browserProcess,
    page,
    close: async () => {
      try { await browser.close(); } catch { /* ok */ }
      try { browserProcess.kill('SIGTERM'); } catch { /* ok */ }
      // Force kill after grace period
      setTimeout(() => {
        try { browserProcess.kill('SIGKILL'); } catch { /* ok */ }
      }, 3000);
    },
  };
}

/**
 * Wait for LanguageModel availability, retrying for downloading state.
 * Returns normalized status and whether a session can be created.
 */
export async function waitForLanguageModelReady(
  page: Page,
  timeoutMs = 180_000,
): Promise<{
  availabilityNormalized: string;
  availabilityRaw: string;
  ready: boolean;
}> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = await page.evaluate(async () => {
      const lm = (globalThis as any).LanguageModel;
      if (!lm) return { error: 'no_LanguageModel' };

      try {
        const avail = await lm.availability();
        const raw = JSON.stringify(avail);
        let norm = 'unknown';

        if (typeof avail === 'string') {
          const a = avail.toLowerCase();
          if (a === 'readily' || a === 'available') norm = 'ready';
          else if (a === 'after-download' || a === 'downloadable') norm = 'downloadable';
          else if (a === 'downloading') norm = 'downloading';
          else if (a === 'no' || a === 'unavailable') norm = 'unavailable';
          else norm = `unknown:${avail}`;
        }

        // Try creating session even if not marked ready
        let sessionOk = false;
        if (norm === 'ready' || norm === 'downloading') {
          try {
            const session = await lm.create({ temperature: 0.1, topK: 1 });
            const resp = await session.prompt('Say: hello');
            session.destroy();
            sessionOk = resp && resp.length > 0;
          } catch {
            // session not ready yet
          }
        }

        return { raw, norm, sessionOk };
      } catch (e: any) {
        return { error: e.message };
      }
    });

    if (result.error === 'no_LanguageModel') {
      return {
        availabilityNormalized: 'no_api',
        availabilityRaw: 'no_api',
        ready: false,
      };
    }

    if (result.sessionOk) {
      return {
        availabilityNormalized: result.norm,
        availabilityRaw: result.raw,
        ready: true,
      };
    }

    if (result.norm === 'ready' && !result.sessionOk) {
      // Service reports ready but session fails — retry
      console.log(`Service ready but session failed, retrying...`);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (result.norm === 'downloading') {
      console.log(`Model downloading, waiting...`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (result.norm === 'unavailable' || result.norm === 'no') {
      // Service might be starting — retry a few times
      console.log(`Model unavailable, retrying (${result.raw})...`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    // Unknown state — retry slowly
    console.log(`Model state "${result.norm}", retrying...`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Last attempt
  try {
    const final = await page.evaluate(async () => {
      const lm = (globalThis as any).LanguageModel;
      const avail = await lm.availability();
      return JSON.stringify(avail);
    });
    return {
      availabilityNormalized: 'timeout',
      availabilityRaw: final,
      ready: false,
    };
  } catch {
    return {
      availabilityNormalized: 'timeout',
      availabilityRaw: 'error',
      ready: false,
    };
  }
}
