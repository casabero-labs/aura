import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const QWEN = 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL';
const GEMMA = 'hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL';
const PHI = 'hf.co/unsloth/Phi-4-mini-instruct-GGUF:Q8_0';
const evidenceDir = '/Users/casabero/Documents/Codex/audits/aura-2026-09-10/screenshots';
mkdirSync(evidenceDir, { recursive: true });

test.describe('Local Ollama configuration', () => {
  test('lists installed Ollama models and saves Qwen 3.5 4B', async ({ page }) => {
    const tags = await fetch('http://127.0.0.1:11434/api/tags');
    test.skip(!tags.ok, 'Ollama is not answering on 127.0.0.1:11434');
    const installed = ((await tags.json()) as { models?: { name: string }[] }).models?.map((model) => model.name) ?? [];
    expect(installed).toEqual(expect.arrayContaining([QWEN, GEMMA, PHI]));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: 'Configuración' }).click();
    await expect(page.getByTestId('settings-workspace')).toBeVisible();

    await page.getByTestId('provider-mode-ollama').click();
    await page.getByTestId('ollama-test-connection').click();
    await expect(page.getByText(/Ollama conectado/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/3 modelos encontrados/)).toBeVisible();

    const select = page.getByTestId('ollama-model-select');
    await expect(select.locator('option')).toHaveCount(3);
    await expect(select.locator(`option[value="${QWEN}"]`)).toHaveCount(1);
    await expect(select.locator(`option[value="${GEMMA}"]`)).toHaveCount(1);
    await expect(select.locator(`option[value="${PHI}"]`)).toHaveCount(1);

    await select.selectOption(QWEN);
    await page.getByTestId('evidence-mode-smart_sample').click();
    await page.getByRole('button', { name: /Guardar configuración/i }).first().click();
    await page.screenshot({ path: join(evidenceDir, '18-ollama-local-configurado.png'), fullPage: true });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Configuración' }).click();
    await expect(page.getByTestId('provider-mode-ollama')).toHaveClass(/settings-provider-card--active/);
    await expect(page.getByTestId('ollama-model-select')).toHaveValue(QWEN);
    await expect(page.getByText(/modelo: hf\.co\/unsloth\/Qwen3\.5-4B-GGUF:UD-Q4_K_XL/)).toBeVisible();
  });
});
