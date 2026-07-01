/**
 * Phase 7 Loop 3 — Claims Visible Verification.
 *
 * Verifies presence of required claims and absence of prohibited claims
 * in Health Delta UI across all visual states.
 *
 * States tested:
 * - idle: real navigation, no execution
 * - done: real flow execution with controlled fixtures
 * - running: visual harness `?phase7Visual=running`
 * - error: visual harness `?phase7Visual=error`
 *
 * IMPORTANT:
 * - Does NOT use dataset real.
 * - Does NOT execute Python in AURA.
 * - Does NOT use Chrome AI or Gemini Nano.
 * - Visual harness states are MOCKS — for UI verification only.
 */

import { test, expect } from '@playwright/test';

const PROHIBITED_PHRASES = [
  { pattern: /python ejecutado por aura/i, label: 'python ejecutado por aura' },
  { pattern: /aura executed python/i, label: 'aura executed python' },
  { pattern: /validación externa independiente/i, label: 'validación externa independiente' },
  { pattern: /independent external validation/i, label: 'independent external validation' },
  { pattern: /mejora sobre dataset real/i, label: 'mejora sobre dataset real' },
  { pattern: /improvement on real dataset/i, label: 'improvement on real dataset' },
  { pattern: /benchmark formal/i, label: 'benchmark formal' },
  { pattern: /formal benchmark/i, label: 'formal benchmark' },
  { pattern: /corrección productiva/i, label: 'corrección productiva' },
  { pattern: /production correction/i, label: 'production correction' },
  { pattern: /datos reales corregidos/i, label: 'datos reales corregidos' },
  { pattern: /real data corrected/i, label: 'real data corrected' },
];

function hasNegationNearby(text: string, phrasePattern: RegExp, window = 12): boolean {
  const match = text.match(phrasePattern);
  if (!match) return false;
  const idx = match.index ?? 0;
  const before = text.slice(Math.max(0, idx - window), idx).toLowerCase();
  return /(\bnot\b|\bno\b|\bnever\b|\bdoesn't\b|\bdoes not\b|\bdid not\b|\bwas not\b|\bwere not\b)/.test(before);
}

function getPanelText(page: any): Promise<string> {
  return page.locator('.improvement-run-panel').evaluate(el => {
    const Notices = Array.from(el.querySelectorAll<HTMLElement>(
      '.improvement-run-notice, .improvement-run-notice-green, .limitation-banner, [data-testid="colab-notice"], [data-testid="fixture-notice"]'
    ));
    const panelText = el.textContent ?? '';
    const noticeTexts = Notices.map(n => n.textContent ?? '').join(' ');
    return panelText + ' ' + noticeTexts;
  });
}

const CLAIM_FIXTURE = /controlled fixture|fixture copy|fixture only|fixture controlado/i;
const CLAIM_COLAB = /colab external|colab notebook|external colab|external runtime|google colab/i;
const CLAIM_NO_REAL = /no real datasets|no original data|not original data|fixture only|controlled fixture|fixture copy/i;
const CLAIM_NOT_INDEPENDENT = /not independent|not external|external colab notebook|external runtime|same audit|reaudit/i;

async function goToHealthDeltaIdle(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
  await page.waitForTimeout(300);
}

test.describe('Phase 7 L3 — Claims Visible Verification', () => {

  // ── E2E-CLM-001: Prohibited phrases absent in ALL states ──

  test('E2E-CLM-001 — no prohibited claims in idle state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    const text = await getPanelText(page);
    for (const { pattern, label } of PROHIBITED_PHRASES) {
      if (hasNegationNearby(text, pattern)) continue;
      expect(text, ` prohibited phrase "${label}" should not appear (unnegated)`).not.toMatch(pattern);
    }
  });

  test('E2E-CLM-001 — no prohibited claims in done state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    await page.getByRole('button', { name: /Run Improvement Flow/i }).click();
    await page.locator('[data-testid="done-state"]').waitFor({ state: 'visible', timeout: 15_000 });
    const text = await getPanelText(page);
    for (const { pattern, label } of PROHIBITED_PHRASES) {
      if (hasNegationNearby(text, pattern)) continue;
      expect(text, ` prohibited phrase "${label}" should not appear (unnegated)`).not.toMatch(pattern);
    }
  });

  test('E2E-CLM-001 — no prohibited claims in running state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=running', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="running-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    for (const { pattern, label } of PROHIBITED_PHRASES) {
      if (hasNegationNearby(text, pattern)) continue;
      expect(text, ` prohibited phrase "${label}" should not appear (unnegated)`).not.toMatch(pattern);
    }
  });

  test('E2E-CLM-001 — no prohibited claims in error state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="error-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    for (const { pattern, label } of PROHIBITED_PHRASES) {
      if (hasNegationNearby(text, pattern)) continue;
      expect(text, ` prohibited phrase "${label}" should not appear (unnegated)`).not.toMatch(pattern);
    }
  });

  // ── E2E-CLM-002: controlled fixture visible in idle ──

  test('E2E-CLM-002 — controlled fixture claim in idle state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_FIXTURE);
  });

  // ── E2E-CLM-003: Colab / external runtime visible in any state ──

  test('E2E-CLM-003 — Colab external claim in idle state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_COLAB);
  });

  test('E2E-CLM-003 — Colab external claim in running state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=running', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="running-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_COLAB);
  });

  test('E2E-CLM-003 — Colab external claim in done state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    await page.getByRole('button', { name: /Run Improvement Flow/i }).click();
    await page.locator('[data-testid="done-state"]').waitFor({ state: 'visible', timeout: 15_000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_COLAB);
  });

  test('E2E-CLM-003 — Colab external claim in error state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="error-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_COLAB);
  });

  // ── E2E-CLM-004: no real datasets / fixture only visible in any state ──

  test('E2E-CLM-004 — no real datasets claim in idle state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NO_REAL);
  });

  test('E2E-CLM-004 — no real datasets claim in running state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=running', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="running-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NO_REAL);
  });

  test('E2E-CLM-004 — no real datasets claim in done state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    await page.getByRole('button', { name: /Run Improvement Flow/i }).click();
    await page.locator('[data-testid="done-state"]').waitFor({ state: 'visible', timeout: 15_000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NO_REAL);
  });

  test('E2E-CLM-004 — no real datasets claim in error state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="error-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NO_REAL);
  });

  // ── E2E-CLM-005: not independent / reproducible visible in any state ──

  test('E2E-CLM-005 — not independent claim in idle state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NOT_INDEPENDENT);
  });

  test('E2E-CLM-005 — not independent claim in running state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=running', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="running-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NOT_INDEPENDENT);
  });

  test('E2E-CLM-005 — not independent claim in done state', async ({ page }) => {
    await goToHealthDeltaIdle(page);
    await page.getByRole('button', { name: /Run Improvement Flow/i }).click();
    await page.locator('[data-testid="done-state"]').waitFor({ state: 'visible', timeout: 15_000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NOT_INDEPENDENT);
  });

  test('E2E-CLM-005 — not independent claim in error state (harness)', async ({ page }) => {
    await page.goto('/?phase7Visual=error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="error-state"]').waitFor({ state: 'visible', timeout: 5000 });
    const text = await getPanelText(page);
    expect(text).toMatch(CLAIM_NOT_INDEPENDENT);
  });

});
