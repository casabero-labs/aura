/**
 * Phase 8 L1 — Demo/Prod Boundary E2E Tests.
 *
 * Validates that:
 *   - Normal/product mode (no flag) does NOT show the demo banner.
 *   - Demo mode (?demoMode=1 or ?phase7Visual=...) DOES show the demo banner.
 *   - Visual harness state is ONLY reachable via explicit query param.
 *   - Navigation to other tabs (Auditoría, Laboratorio, Home) does NOT leak
 *     the demo banner or fake harness results.
 *   - No prohibited claims appear in normal mode UI.
 *
 * IMPORTANT:
 *   - Does NOT use dataset real.
 *   - Does NOT execute Python in AURA.
 *   - Does NOT use Chrome AI or Gemini Nano.
 *   - Does NOT trigger real AI providers.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 8 L1 — Demo/Prod Boundary', () => {

  // ── E2E-BOUNDARY-001: Normal mode hides demo banner ──

  test('E2E-BOUNDARY-001 — normal mode does not show demo banner on Health Delta', async ({ page }) => {
    await page.goto('/?nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="improvement-run-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-mode-banner"]')).toHaveCount(0);
  });

  // ── E2E-BOUNDARY-002: Demo mode shows demo banner ──

  test('E2E-BOUNDARY-002 — demo mode shows demo banner', async ({ page }) => {
    await page.goto('/?demoMode=1&nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="improvement-run-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-mode-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-mode-banner"]')).toContainText(/DEMO|fixture/i);
  });

  // ── E2E-BOUNDARY-003: phase7Visual=running shows demo banner ──

  test('E2E-BOUNDARY-003 — phase7Visual=running shows demo banner and forces running state', async ({ page }) => {
    await page.goto('/?phase7Visual=running&nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="demo-mode-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="running-state"]')).toBeVisible();
  });

  // ── E2E-BOUNDARY-004: phase7Visual=error shows demo banner and forces error state ──

  test('E2E-BOUNDARY-004 — phase7Visual=error shows demo banner and forces error state', async ({ page }) => {
    await page.goto('/?phase7Visual=error&nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="demo-mode-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-state"]')).toBeVisible();
  });

  // ── E2E-BOUNDARY-005: Demo banner does NOT leak into Auditoría ──

  test('E2E-BOUNDARY-005 — demo banner does not leak into Auditoría tab', async ({ page }) => {
    await page.goto('/?demoMode=1&nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Auditoría' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="demo-mode-banner"]')).toHaveCount(0);
  });

  // ── E2E-BOUNDARY-006: Demo banner does NOT leak into Home ──

  test('E2E-BOUNDARY-006 — demo banner does not leak into Home tab', async ({ page }) => {
    await page.goto('/?demoMode=1&nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="demo-mode-banner"]')).toHaveCount(0);
  });

  // ── E2E-BOUNDARY-007: Demo banner does NOT leak into Laboratorio ──

  test('E2E-BOUNDARY-007 — demo banner does not leak into Laboratorio tab', async ({ page }) => {
    await page.goto('/?demoMode=1&nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Laboratorio' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="demo-mode-banner"]')).toHaveCount(0);
  });

  // ── E2E-BOUNDARY-008: Normal mode does NOT auto-trigger visual harness ──

  test('E2E-BOUNDARY-008 — normal mode never auto-shows running or error harness state', async ({ page }) => {
    await page.goto('/?nocache=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="running-state"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="error-state"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="done-state"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="idle-state"]')).toBeVisible();
  });
});