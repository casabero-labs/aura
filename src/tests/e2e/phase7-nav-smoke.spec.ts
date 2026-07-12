import { test, expect } from '@playwright/test';

test.describe('Phase 7 L1 — E2E Smoke: Navigation + Laboratorio', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      await page.screenshot({ path: `test-results/phase7-smoke-${testInfo.title.replace(/\s+/g, '-').toLowerCase()}.png` });
    }
  });

  test.describe('A. Navegación — E2E-NAV', () => {

    test('E2E-NAV-001 — Home carga correctamente', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      await expect(navCenterMenu).toBeVisible();

      await expect(navCenterMenu.getByRole('button', { name: 'Home' })).toBeVisible();
      await expect(navCenterMenu.getByRole('button', { name: 'Auditoría' })).toBeVisible();
      await expect(navCenterMenu.getByRole('button', { name: 'Laboratorio' })).toBeVisible();
      await expect(navCenterMenu.getByRole('button', { name: 'Configuración' })).toBeVisible();
    });

    test('E2E-NAV-002 — Auditoría abre correctamente', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const auditoriaBtn = navCenterMenu.getByRole('button', { name: 'Auditoría' });

      await auditoriaBtn.click();
      await expect(auditoriaBtn).toHaveClass(/active/);
    });

    test('E2E-NAV-003 — Configuración no expone el laboratorio retirado', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const configBtn = navCenterMenu.getByRole('button', { name: 'Configuración' });

      await configBtn.click();
      await expect(configBtn).toHaveClass(/active/);

      await expect(page.getByText(/Laboratorio avanzado/i)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Abrir laboratorio experimental/i })).toHaveCount(0);
    });

    test('E2E-NAV-004 — Laboratorio abre correctamente', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const laboratoryBtn = navCenterMenu.getByRole('button', { name: 'Laboratorio' });

      await laboratoryBtn.click();
      await expect(laboratoryBtn).toHaveClass(/active/);

      const laboratoryPage = page.getByRole('heading', { name: 'Laboratorio de evaluación LLM', exact: true });
      await expect(laboratoryPage).toBeVisible();

      const runButton = page.getByRole('button', { name: 'Crear experimento' });
      await expect(runButton).toBeVisible();
    });

    test('E2E-NAV-005 — Configuración abre correctamente', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const configBtn = navCenterMenu.getByRole('button', { name: 'Configuración' });

      await configBtn.click();
      await expect(configBtn).toHaveClass(/active/);

      const guardBtn = page.getByRole('button', { name: /Guardar configuración/i });
      await expect(guardBtn.first()).toBeVisible();
    });

    test('E2E-NAV-006 — Laboratorio no deja Auditoría activa', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const auditoriaBtn = navCenterMenu.getByRole('button', { name: 'Auditoría' });
      const laboratoryBtn = navCenterMenu.getByRole('button', { name: 'Laboratorio' });

      await auditoriaBtn.click();
      await expect(auditoriaBtn).toHaveClass(/active/);

      await laboratoryBtn.click();
      await expect(laboratoryBtn).toHaveClass(/active/);
      await expect(auditoriaBtn).not.toHaveClass(/active/);
    });

    test('E2E-NAV-007 — Desde Laboratorio se puede volver a Auditoría', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const laboratoryBtn = navCenterMenu.getByRole('button', { name: 'Laboratorio' });
      const auditoriaBtn = navCenterMenu.getByRole('button', { name: 'Auditoría' });

      await laboratoryBtn.click();
      await expect(laboratoryBtn).toHaveClass(/active/);

      await auditoriaBtn.click();
      await expect(auditoriaBtn).toHaveClass(/active/);
      await expect(laboratoryBtn).not.toHaveClass(/active/);
    });

    test('E2E-NAV-008 — Mobile nav permite abrir Laboratorio', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const mobileToggle = page.locator('.mobile-nav-toggle');
      await expect(mobileToggle).toBeVisible();

      await mobileToggle.click();

      const navLinks = page.locator('.nav-links');
      await expect(navLinks).toHaveClass(/nav-links-open/);

      const laboratoryLink = navLinks.getByRole('button', { name: 'Laboratorio' });
      await expect(laboratoryLink).toBeVisible();

      await laboratoryLink.click();

      const runButton = page.getByRole('button', { name: 'Crear experimento' });
      await expect(runButton).toBeVisible();
    });

  });

});
