import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const evidenceDir = '/Users/casabero/Documents/Codex/audits/aura-2026-09-10/screenshots';
mkdirSync(evidenceDir, { recursive: true });

const dir = mkdtempSync(join(tmpdir(), 'aura-ux-p1-'));
const emptyCsv = join(dir, 'vacio.csv');
const validCsv = join(dir, 'ok.csv');
writeFileSync(emptyCsv, '');
writeFileSync(validCsv, 'id,name\n001,Ana\n002,Bob\n');

test.describe('UX P1 wave 0 — empty input, deterministic scope, destroy dialog', () => {
  test('rejects an empty CSV, continues without verified remediation, and keeps destroy focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Empezar auditoría/i }).click();

    await page.locator('[data-testid="csv-file-input"]').setInputFiles(emptyCsv);
    await expect(page.getByText(/No se pudo auditar/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Dataset saludable/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Continuar al diagnóstico/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Seleccionar otro archivo/i })).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, '15-csv-vacio-rechazado.png'), fullPage: true });

    await page.getByRole('button', { name: /Seleccionar otro archivo/i }).click();
    await page.locator('[data-testid="csv-file-input"]').setInputFiles(validCsv);
    await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Continuar al diagnóstico/i }).click();
    await expect(page.getByRole('button', { name: /Continuar con informe determinista/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Continuar con informe determinista/i }).click();

    await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('status')).toContainText(/corrección con ejecución verificada/i);
    await expect(page.getByTestId('diagnostic-report-generate-script')).toBeDisabled();
    await expect(page.getByRole('button', { name: /Aplicar y verificar/i })).toHaveCount(0);
    await page.screenshot({ path: join(evidenceDir, '16-alcance-determinista.png'), fullPage: true });

    await page.getByRole('button', { name: /Ir a exportación/i }).click();
    const destroy = page.getByTestId('export-destroy-session');
    await expect(destroy).toBeVisible();
    await destroy.click();

    const dialog = page.getByTestId('destroy-session-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, '17-dialogo-destructivo.png'), fullPage: true });

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="destroy-session-dialog"]');
      return !!modal && modal.contains(document.activeElement);
    })).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(destroy).toBeFocused();
  });
});
