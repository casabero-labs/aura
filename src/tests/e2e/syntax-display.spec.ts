import { expect, test } from '@playwright/test';

test.describe('Syntax display — estándar showcase-ink', () => {
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

    expect(colors.outer).toBe('rgb(238, 242, 246)');
    expect(colors.head).toBe('rgb(255, 255, 255)');
    expect(colors.body).toBe('rgb(238, 242, 246)');
    expect(colors.font).toContain('JetBrains Mono');
    expect(colors.shadow).not.toBe('none');
  });
});
