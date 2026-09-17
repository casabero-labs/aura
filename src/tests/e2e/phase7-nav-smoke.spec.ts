import { test, expect } from '@playwright/test';

const ACCESSIBLE_NAV_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 640, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const;

const CANONICAL_DESTINATIONS = ['Auditoría', 'Laboratorio'];
const CANONICAL_UTILITIES = ['Configuración', 'Ayuda'];

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

    test('E2E-NAV-001 — Inicio carga correctamente', async ({ page }) => {
      const nav = page.getByRole('navigation', { name: 'Navegación principal' });
      await expect(nav.getByRole('button', { name: 'Ir al inicio' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Auditoría' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Laboratorio' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Configuración' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Ayuda' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Auditar un CSV' })).toBeVisible();
    });

    test('E2E-NAV-002 — Auditoría abre correctamente', async ({ page }) => {
      const navCenterMenu = page.locator('.nav-center-menu');
      const auditoriaBtn = navCenterMenu.getByRole('button', { name: 'Auditoría' });

      await auditoriaBtn.click();
      await expect(auditoriaBtn).toHaveClass(/active/);
    });

    test('E2E-NAV-003 — Configuración no expone el laboratorio retirado', async ({ page }) => {
      const configBtn = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Configuración' });

      await configBtn.click();
      await expect(configBtn).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('settings-view')).toBeVisible();

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
      const configBtn = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Configuración' });

      await configBtn.click();
      await expect(configBtn).toHaveAttribute('aria-current', 'page');

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

    test('E2E-NAV-008 — Mobile muestra Laboratorio sin hamburguesa', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Sin hamburguesa: la nav va en dos líneas y los destinos siguen visibles.
      await expect(page.locator('.mobile-nav-toggle')).toHaveCount(0);
      const laboratoryBtn = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Laboratorio' });
      await expect(laboratoryBtn).toBeVisible();

      await laboratoryBtn.click();

      const runButton = page.getByRole('button', { name: 'Crear experimento' });
      await expect(runButton).toBeVisible();
    });

  });

});

test.describe('Issue #41 — accessible two-line navigation', () => {
  for (const viewport of ACCESSIBLE_NAV_VIEWPORTS) {
    test(`${viewport.width}px — keyboard, semantics, focus, console and overflow`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));

      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

      const primaryNav = page.getByRole('navigation', { name: 'Navegación principal' });
      const brand = primaryNav.getByRole('button', { name: 'Ir al inicio' });
      const work = primaryNav.locator('.nav-work');

      await expect(brand).toBeVisible();
      await expect(brand).toHaveAttribute('type', 'button');
      await expect(brand).toHaveAttribute('aria-current', 'page');
      await expect(work.getByRole('button')).toHaveText(CANONICAL_DESTINATIONS);
      for (const name of CANONICAL_UTILITIES) {
        await expect(primaryNav.getByRole('button', { name })).toBeVisible();
      }
      await expect(primaryNav.getByRole('button', { name: 'Trazabilidad' })).toHaveCount(0);

      await work.getByRole('button', { name: 'Auditoría' }).click();
      await expect(work.getByRole('button', { name: 'Auditoría' })).toHaveAttribute('aria-current', 'page');
      await brand.focus();
      await page.keyboard.press('Enter');
      await expect(brand).toHaveAttribute('aria-current', 'page');

      await brand.focus();
      await page.keyboard.press('Tab');
      await expect(work.getByRole('button', { name: 'Auditoría' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(brand).toBeFocused();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalOverflow).toBe(false);
      expect(consoleErrors).toEqual([]);

      await page.screenshot({
        path: `test-results/issue-41-nav-${viewport.width}.png`,
        fullPage: true,
      });
    });
  }
});
