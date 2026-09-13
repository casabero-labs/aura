import { expect, test } from '@playwright/test';

test.describe('Syntax display — estándar Editorial', () => {
  test('el asistente de Ollama usa superficie clara, cabecera, tipografía mono y copia', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.nav-center-menu').getByRole('button', { name: 'Configuración' }).click();
    await page.getByText('Ollama local', { exact: true }).click();

    const openSetup = page.getByTestId('ollama-open-setup');
    await expect(openSetup).toBeVisible({ timeout: 20_000 });
    await openSetup.click();

    const display = page.getByTestId('ollama-setup-log');
    await expect(display).toBeVisible();
    await expect(display.locator('.syntax-display__filename')).toHaveText('ollama.setup.log');
    await expect(display.getByRole('button', { name: 'Copiar ollama.setup.log' })).toBeVisible();

    const colors = await display.evaluate((element) => {
      const outer = getComputedStyle(element);
      const head = getComputedStyle(element.querySelector('.syntax-display__head')!);
      const body = getComputedStyle(element.querySelector('.syntax-display__body')!);
      return {
        outer: outer.backgroundColor,
        head: head.backgroundColor,
        body: body.backgroundColor,
        font: body.fontFamily,
        shadow: outer.boxShadow,
      };
    });

    expect(colors.outer).toBe('rgb(251, 251, 249)');
    expect(colors.head).toBe('rgb(255, 255, 255)');
    expect(colors.body).toBe('rgb(247, 247, 244)');
    expect(colors.font).toContain('SFMono-Regular');
    expect(colors.shadow).toBe('none');

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'macOS' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    const macOSGuide = page.getByTestId('ollama-macos-service-guide');
    await expect(macOSGuide).toBeVisible();
    await expect(page.getByTestId('ollama-macos-homebrew-command')).toContainText('brew services restart ollama');
    await expect(page.getByTestId('ollama-macos-app-command')).toContainText('open -a Ollama');
    await expect(page.getByTestId('ollama-macos-verify-command')).toContainText(/Origin: http:\/\/127\.0\.0\.1:\d+/);
    await expect(page.getByTestId('ollama-macos-address-in-use')).toContainText('bind: address already in use');
    await expect(page.getByTestId('ollama-macos-homebrew-command')).not.toContainText('ollama serve');

    await page.getByRole('button', { name: 'Ya configuré y reinicié Ollama' }).click();

    const commands = [
      'ollama run hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
      'ollama run hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL',
      'ollama run hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL',
    ];
    for (const command of commands) {
      await expect(page.getByText(command, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/DeepSeek R1 0528/i)).toHaveCount(0);
    await expect(page.locator('.ollama-wizard-model-card .syntax-display')).toHaveCount(3);
  });
});
