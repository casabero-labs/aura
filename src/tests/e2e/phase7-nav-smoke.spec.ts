import { test, expect } from '@playwright/test';

const ACCESSIBLE_NAV_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 640, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const;

const CANONICAL_DESTINATIONS = ['Home', 'Auditoría', 'Laboratorio', 'Configuración'];

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

test.describe('Issue #41 — accessible navigation disclosure', () => {
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
      const desktopMenu = primaryNav.locator('.nav-center-menu');
      const toggle = primaryNav.locator('.mobile-nav-toggle');
      const mobileMenu = page.locator('#mobile-navigation');

      await expect(brand).toBeVisible();
      await expect(brand).toHaveAttribute('type', 'button');

      if (viewport.width > 920) {
        await expect(toggle).toBeHidden();
        await expect(mobileMenu).toHaveAttribute('hidden', '');
        await expect(mobileMenu.getByRole('button')).toHaveCount(0);
        await expect(desktopMenu.getByRole('button')).toHaveText(CANONICAL_DESTINATIONS);
        await expect(desktopMenu.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
        await expect(desktopMenu.getByRole('button', { name: 'Trazabilidad' })).toHaveCount(0);

        await desktopMenu.getByRole('button', { name: 'Auditoría' }).click();
        await brand.focus();
        await page.keyboard.press('Enter');
        await expect(desktopMenu.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

        await desktopMenu.getByRole('button', { name: 'Auditoría' }).click();
        await brand.focus();
        await page.keyboard.press('Space');
        await expect(desktopMenu.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

        await brand.focus();
        await page.keyboard.press('Tab');
        await expect(desktopMenu.getByRole('button', { name: 'Home' })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(brand).toBeFocused();
      } else {
        await expect(desktopMenu).toBeHidden();
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAccessibleName('Abrir menú de navegación');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toHaveAttribute('aria-controls', 'mobile-navigation');
        await expect(mobileMenu).toHaveAttribute('hidden', '');
        await expect(mobileMenu.getByRole('button')).toHaveCount(0);
        const closedAccessibilitySnapshot = await page.locator('body').ariaSnapshot();
        for (const destination of CANONICAL_DESTINATIONS) {
          expect(closedAccessibilitySnapshot).not.toContain(`button "${destination}"`);
        }

        const toggleBox = await toggle.boundingBox();
        expect(toggleBox?.width).toBeGreaterThanOrEqual(44);
        expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

        await brand.focus();
        await page.keyboard.press('Tab');
        await expect(toggle).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(brand).toBeFocused();
        await page.keyboard.press('Tab');

        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAccessibleName('Cerrar menú de navegación');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(mobileMenu).not.toHaveAttribute('hidden', '');
        await expect(mobileMenu.getByRole('button')).toHaveText(CANONICAL_DESTINATIONS);
        await expect(mobileMenu.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
        await expect(mobileMenu.getByRole('button', { name: 'Trazabilidad' })).toHaveCount(0);
        const openAccessibilitySnapshot = await page.locator('body').ariaSnapshot();
        for (const destination of CANONICAL_DESTINATIONS) {
          expect(openAccessibilitySnapshot).toContain(`button "${destination}"`);
        }

        await page.keyboard.press('Tab');
        await expect(mobileMenu.getByRole('button', { name: 'Home' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAccessibleName('Abrir menú de navegación');
        await expect(mobileMenu).toHaveAttribute('hidden', '');
        await expect(mobileMenu.getByRole('button')).toHaveCount(0);

        await page.keyboard.press('Space');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await expect(mobileMenu.getByRole('button', { name: 'Auditoría' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(toggle).toBeFocused();
        await expect(mobileMenu).toHaveAttribute('hidden', '');

        await page.keyboard.press('Space');
        await expect(mobileMenu.getByRole('button', { name: 'Auditoría' })).toHaveAttribute('aria-current', 'page');
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
      }

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      expect(consoleErrors).toEqual([]);

      if (viewport.width <= 920) {
        await toggle.press('Space');
        await expect(toggle).toHaveAccessibleName('Cerrar menú de navegación');
        await expect(mobileMenu).toBeVisible();
      }

      await page.screenshot({
        path: `test-results/issue-41-nav-${viewport.width}.png`,
        fullPage: true,
      });
    });
  }
});
