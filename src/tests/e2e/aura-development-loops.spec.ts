import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');

test('development loops guide the human flow from intent to deterministic evidence', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });

  await expect(page.getByRole('heading', { name: /Fases visibles para terminar AURA/i })).toBeVisible();
  await expect(page.getByText('Tenemos', { exact: true })).toBeVisible();
  await expect(page.getByText('Queremos', { exact: true })).toBeVisible();
  await expect(page.getByText('Debemos hacer', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Motor determinista formal' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Relacion entre flujo actual/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Lo que tenemos actualmente' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Requerido por la revision' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Fortalezas' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Debilidades' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Objetivos de desarrollo' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Loop y puerta E2E' })).toBeVisible();
  await expect(page.getByTestId('pipeline-matrix-row-upload')).toContainText('Subir CSV');
  await expect(page.getByTestId('pipeline-matrix-row-profile')).toContainText('Perfilar');
  await expect(page.getByTestId('pipeline-matrix-row-diagnosis')).toContainText('Diagnóstico');
  await expect(page.getByTestId('pipeline-matrix-row-script')).toContainText('Script');
  await expect(page.getByTestId('pipeline-matrix-row-review')).toContainText('Revisar');
  await expect(page.getByTestId('pipeline-matrix-row-export')).toContainText('Exportar');
  await expect(page.getByText(/Cargar CSV local/i)).toBeVisible();

  await page.setInputFiles('input[type="file"]', fixtureCsv);

  await expect(page.getByText(/Perfil del dataset/i)).toBeVisible();
  await expect(page.getByText('CONTRATO DE INGESTIÓN', { exact: true })).toBeVisible();
  await expect(page.getByText(/INGESTIÓN COMPLETA/i)).toBeVisible();
  await expect(page.getByText(/Evidencia de carga del dataset/i)).toBeVisible();
  await expect(page.getByText(/Dataset/i).first()).toBeVisible();

  // ── AURA-L02-B: Deterministic Validation Panel ──
  await expect(page.getByText(/VALIDACIÓN DETERMINISTA FORMAL/i)).toBeVisible();
  await expect(page.getByText(/Métricas por regla contra ground truth/i)).toBeVisible();
  await expect(page.getByText(/Macro Precisión/i)).toBeVisible();
  await expect(page.getByText(/Macro Recall/i)).toBeVisible();
  await expect(page.getByText(/Macro F1/i)).toBeVisible();
  await expect(page.locator('.dv-dataset-badge')).toContainText('synthetic_ground_truth.csv');

  await expect(page.getByRole('heading', { name: 'Benchmark LLM formal' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Laboratorio de Modelos/i })).toBeVisible();
});
