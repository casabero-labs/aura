import { test, expect } from '@playwright/test';
import Papa from 'papaparse';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '../../..');
const examples = path.join(root, 'experiments/rule-engine');
const source = (name: string) => ({ name: `${name}.csv`, mimeType: 'text/csv',
  buffer: Buffer.from(Papa.unparse(JSON.parse(fs.readFileSync(path.join(examples, 'fixtures', `${name}.json`), 'utf8')))) });
const openUpload = async (page: any) => {
  await page.goto('/');
  const start = page.getByRole('button', { name: /Empezar|Comenzar/ }).first();
  if (await start.isVisible()) await start.click();
  await expect(page.getByTestId('csv-file-input')).toBeAttached();
};

test('real upload preserves identifier text and shows every detected problem', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openUpload(page);
  await page.getByTestId('csv-file-input').setInputFiles(source('clientes_sucio'));
  const region = page.getByRole('region', { name: 'Todos los hallazgos' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('row')).toHaveCount(14);
  await expect(region.getByText('Fecha no válida')).toBeVisible();
  await expect(region.getByText('Identificador repetido')).toBeVisible();
  const documentRow = page.getByTestId('profile-column-table').getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'documento', exact: true }) });
  await expect(documentRow.getByText('string', { exact: true })).toBeVisible();
  await page.getByText('Columnas detectadas', { exact: true }).click();
  await expect(page.locator('.col-detail-header').filter({ hasText: 'email' })).toContainText('1 hallazgos');
  await expect(page.getByText('OK', { exact: true })).toHaveCount(0);
  fs.mkdirSync(path.join(examples, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(examples, 'screenshots/clientes-general.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('profile-continue-diagnosis')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(examples, 'screenshots/clientes-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('declared rules find invalid states and the clean exercise has no alerts', async ({ page }) => {
  await openUpload(page);
  await page.getByText('Reglas propias del archivo (opcional)').click();
  await page.getByLabel('Archivo de reglas (.json)').setInputFiles(path.join(examples, 'clientes.rules.json'));
  await expect(page.getByText('Reglas listas: clientes.rules.json')).toBeVisible();
  await page.getByTestId('csv-file-input').setInputFiles(source('clientes_sucio'));
  await expect(page.getByRole('region', { name: 'Todos los hallazgos' }).getByText('Valor no permitido', { exact: true })).toBeVisible();
  await expect(page.getByText('Número fuera de la regla declarada', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(examples, 'screenshots/clientes-con-reglas.png'), fullPage: true });
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  const confirm = page.getByTestId('new-analysis-dialog');
  await expect(confirm).toBeVisible();
  await confirm.getByTestId('new-analysis-confirm').click();
  await page.getByRole('button', { name: /Empezar|Comenzar/ }).first().click();
  await expect(page.getByTestId('csv-file-input')).toBeAttached();
  await page.getByTestId('csv-file-input').setInputFiles(source('clientes_groundtruth'));
  await expect(page.getByText('Sin alertas prioritarias en las reglas evaluadas')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Todos los hallazgos' })).toHaveCount(0);
});
