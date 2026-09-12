import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const QWEN = 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL';
const evidenceDir = '/Users/casabero/Documents/Codex/audits/aura-2026-09-10/screenshots';
mkdirSync(evidenceDir, { recursive: true });

const rows = ['id,name,note'];
for (let index = 1; index <= 199; index += 1) {
  rows.push(`${String(index).padStart(3, '0')},persona-${index},ok`);
}
rows.push('999,persona-sentinel,n/a');
rows.push('001,persona-1-dup,ok');

const dir = mkdtempSync(join(tmpdir(), 'aura-ux-qwen-'));
const csvPath = join(dir, 'sentinelas.csv');
writeFileSync(csvPath, `${rows.join('\n')}\n`);

async function overflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function startAudit(page: import('@playwright/test').Page) {
  const resume = page.getByTestId('home-resume-audit');
  if (await resume.isVisible().catch(() => false)) {
    await page.getByTestId('home-start-new').click();
    const dialog = page.getByTestId('new-analysis-dialog').or(page.getByTestId('destroy-session-dialog'));
    if (await dialog.isVisible().catch(() => false)) {
      await page.getByTestId('new-analysis-confirm').or(page.getByTestId('destroy-session-confirm')).click();
    }
  }
  const start = page.getByRole('button', { name: /Empezar auditoría/i });
  if (await start.isVisible().catch(() => false)) await start.click();
}

test.describe.configure({ mode: 'serial' });

test.describe('Local Qwen walkthrough and viewports', () => {
  test.beforeEach(async ({ page }) => {
    const tags = await fetch('http://127.0.0.1:11434/api/tags');
    test.skip(!tags.ok, 'Ollama is not answering');
  });

  test('profile, resume and 320/390 do not overflow', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await startAudit(page);
    await page.locator('[data-testid="csv-file-input"]').setInputFiles(csvPath);
    await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId('profile-priorities')).toBeVisible();
    await expect(page.getByTestId('profile-priorities')).not.toContainText('0% de registros afectados');
    await expect(page.getByTestId('profile-priorities')).toContainText(/de 20[01]/);
    await page.locator('[data-testid="profile-tech-disclosure"] summary').click();
    await expect(page.getByText(/IQR es el rango entre cuartiles/)).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, '19-perfil-conteos.png'), fullPage: true });

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 780 });
      await expect(page.getByTestId('profile-hero')).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(8);
      await page.screenshot({ path: join(evidenceDir, `20-perfil-${width}.png`), fullPage: true });
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Home' }).first().click();
    await expect(page.getByTestId('home-resume-audit')).toBeVisible();
    await expect(page.getByTestId('home-resume-meta')).toContainText('Perfil base');
    await page.screenshot({ path: join(evidenceDir, '21-portada-reanudar.png'), fullPage: true });
  });

  test('Qwen diagnosis can cancel, then complete without timed cognitive copy', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: 'Configuración' }).click();
    await page.getByTestId('provider-mode-ollama').click();
    await page.getByTestId('ollama-test-connection').click();
    await expect(page.getByText(/Ollama conectado/)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('ollama-model-select').selectOption(QWEN);
    await page.getByTestId('evidence-mode-smart_sample').click();
    await page.getByRole('button', { name: /Guardar configuración/i }).first().click();

    await startAudit(page);
    if (await page.getByTestId('home-resume-audit').isVisible().catch(() => false)) {
      await page.getByTestId('home-resume-audit').click();
    }
    if (await page.locator('[data-testid="csv-file-input"]').count()) {
      await page.locator('[data-testid="csv-file-input"]').setInputFiles(csvPath);
      await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 25_000 });
    }
    if (await page.getByTestId('profile-continue-diagnosis').isVisible().catch(() => false)) {
      await page.getByTestId('profile-continue-diagnosis').click();
    }

    await expect(page.getByTestId('diagnosis-hero-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('diagnosis-generate').click();
    await expect(page.getByTestId('progress-disclosure')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('progress-disclosure')).toContainText(/Enviando solicitud|Recibiendo respuesta|transcurridos/i);
    await expect(page.getByTestId('progress-disclosure')).not.toContainText('Analizando hallazgos críticos');
    await page.getByTestId('progress-disclosure-cancel').click();
    await expect(page.getByTestId('progress-disclosure')).toContainText(/Cancel/i);
    await page.screenshot({ path: join(evidenceDir, '22-diagnostico-cancelado.png'), fullPage: true });

    await page.getByTestId('diagnosis-generate').click();
    await expect(page.getByTestId('progress-disclosure')).toContainText(/Enviando solicitud|Recibiendo respuesta|transcurridos/i);
    await expect(page.getByRole('button', { name: /Continuar al reporte diagnóstico/i })).toBeVisible({ timeout: 240_000 });
    await page.screenshot({ path: join(evidenceDir, '23-diagnostico-qwen.png'), fullPage: true });
    await page.getByRole('button', { name: /Continuar al reporte diagnóstico/i }).click();

    await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('diagnostic-report-stage')).toContainText(/Señal pendiente de contexto|999/);
    await page.screenshot({ path: join(evidenceDir, '24-informe-sentinela.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 780 });
    expect(await overflow(page)).toBeLessThanOrEqual(8);
    await page.setViewportSize({ width: 320, height: 780 });
    expect(await overflow(page)).toBeLessThanOrEqual(8);
    await page.setViewportSize({ width: 1280, height: 900 });

    const copy = page.getByRole('button', { name: 'Corregir una copia' });
    if (await copy.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await copy.click();
      const plan = page.getByTestId('remediation-stage');
      if (await plan.isVisible({ timeout: 20_000 }).catch(() => false)) {
        await expect(plan).toContainText(/Antes y después propuesto|Cerrar sin cambios|Conservar como válido|Aprobar/);
        await page.screenshot({ path: join(evidenceDir, '25-plan-v2.png'), fullPage: true });
        const closeWithout = page.getByRole('button', { name: 'Cerrar sin cambios' });
        if (await closeWithout.isVisible().catch(() => false)) {
          await closeWithout.click();
        } else {
          await page.getByRole('button', { name: /Exportar|Volver/i }).first().click();
        }
      }
    }

    if (await page.getByTestId('diagnostic-report-stage').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Exportar informe|Ir a exportación/i }).first().click();
    }
    await expect(page.getByTestId('export-pdf-desc')).toContainText(/diagnóstico inicial/i);
    await page.screenshot({ path: join(evidenceDir, '26-export-diagnostico-inicial.png'), fullPage: true });
  });
});
