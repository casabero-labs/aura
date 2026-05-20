import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'docs/evidence/screenshots');
const docxOutDir = path.join(outDir, 'docx_figures');
const datasetsDir = path.join(repoRoot, 'docs/evidence/datasets');
const appUrl = process.env.AURA_EVIDENCE_URL || 'http://127.0.0.1:5173/';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docxOutDir, { recursive: true });

const datasets = [
  { id: 'clientes', file: 'clientes_sucio.csv' },
  { id: 'inventario', file: 'inventario_sucio.csv' },
  { id: 'operaciones', file: 'operaciones_sucio.csv' },
];

async function safeClick(page, name) {
  await page.getByRole('button', { name }).click();
  await page.waitForTimeout(650);
}

async function captureViewport(page, filename) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const target = path.join(outDir, filename);
  const docxTarget = path.join(docxOutDir, filename);
  await page.screenshot({ path: target, fullPage: false });
  fs.copyFileSync(target, docxTarget);
}

async function loadDataset(page, dataset) {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles(path.join(datasetsDir, dataset.file));
  await page.waitForSelector('.profile-stage-header, .dataset-profile', { timeout: 15000 });
  await page.waitForTimeout(900);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
});

try {
  for (const dataset of datasets) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
    await loadDataset(page, dataset);
    await captureViewport(page, `aura-${dataset.id}-perfil.png`);

    if (dataset.id === 'clientes') {
      await safeClick(page, /Abrir diagnóstico/i);
      await page.waitForSelector('.diagnosis-stage', { timeout: 10000 });
      await captureViewport(page, 'aura-clientes-diagnostico.png');

      await safeClick(page, /Comparar modelos/i);
      await page.waitForSelector('.benchmark-lab-page', { timeout: 10000 });
      await captureViewport(page, 'aura-clientes-script.png');

      await page.goto(appUrl, { waitUntil: 'networkidle' });
      await safeClick(page, /Modelos/i);
      await page.waitForSelector('.settings-sheet', { timeout: 10000 });
      await captureViewport(page, 'aura-clientes-revision.png');
    }

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Capturas actualizadas en ${outDir}`);
