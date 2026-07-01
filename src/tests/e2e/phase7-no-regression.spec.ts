/**
 * Phase 7 Loop 4 — No-Regression Suite.
 *
 * Verifies that Health Delta workspace does NOT break:
 * - MainPipeline / Auditoría
 * - BenchmarkLab / Laboratorio
 * - Settings / Configuración
 * - Footer / workspace mode
 *
 * IMPORTANT:
 * - Does NOT use dataset real.
 * - Does NOT execute Python in AURA.
 * - Does NOT use Chrome AI or Gemini Nano.
 * - Does NOT trigger real AI providers.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 7 L4 — No-Regression Suite', () => {

  // ── E2E-REG-001: MainPipeline no se rompe ──

  test('E2E-REG-001 — MainPipeline intact after Health Delta round-trip', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Auditoría' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.sys-main').first()).toBeVisible();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="improvement-run-panel"]')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="improvement-run-panel"]')).not.toBeVisible();
    await expect(page.locator('.sys-main').first()).toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  // ── E2E-REG-002: BenchmarkLab no se rompe ──

  test('E2E-REG-002 — BenchmarkLab intact after visiting Health Delta', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="improvement-run-panel"]')).toBeVisible();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Laboratorio' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Laboratorio de Modelos')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="improvement-run-panel"]')).not.toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  // ── E2E-REG-003: Settings no se rompe ──

  test('E2E-REG-003 — Settings intact after visiting Health Delta', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="improvement-run-panel"]')).toBeVisible();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Configuración' }).click();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-testid="settings-workspace"]')).toBeVisible({ timeout: 15_000 });

    expect(consoleErrors).toHaveLength(0);
  });

  // ── E2E-REG-004: Footer workspace mode ──

  test('E2E-REG-004 — Footer hidden in workspaces, visible on home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await expect(page.locator('.sys-footer')).toBeVisible();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="improvement-run-panel"]')).toBeVisible();
    await expect(page.locator('.sys-footer')).toBeHidden();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Laboratorio' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Laboratorio de Modelos')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sys-footer')).toBeHidden();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Configuración' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="settings-workspace"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sys-footer')).toBeHidden();

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Home' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.sys-footer')).toBeVisible();
  });

});
