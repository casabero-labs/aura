/**
 * Generate Real AuditReport using production PapaParse + auditEngine.ts
 * Fase 0D: No absolute paths. Full git SHA.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Papa = require('papaparse');

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DATASET_PATH = path.join(REPO_ROOT, 'experiments/datasets/titanic.csv');
const FIXTURES_DIR = path.join(SCRIPT_DIR, 'fixtures');

// Import production code via relative path
const auditEnginePath = path.join(REPO_ROOT, 'src/services/auditEngine.ts');
const { runAudit } = await import(auditEnginePath);

// ---- Parse CSV using PapaParse identically to production ----
const csvContent = fs.readFileSync(DATASET_PATH, 'utf-8');
const parseResult = Papa.parse(csvContent, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  delimiter: ''
});

const data = parseResult.data;
const fields = parseResult.meta.fields || [];
const delimiter = parseResult.meta.delimiter || ',';

console.log(`Loaded ${data.length} rows, ${fields.length} columns (delimiter: ${delimiter})`);

// ---- SHA-256 of dataset ----
const datasetContent = fs.readFileSync(DATASET_PATH);
const datasetSha256 = crypto.createHash('sha256').update(datasetContent).digest('hex');
console.log('Dataset SHA-256:', datasetSha256);

// ---- Full git SHA ----
let gitSha = '';
try {
  const cp = await import('node:child_process');
  gitSha = cp.execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch {
  gitSha = 'unknown';
}

// ---- Run production audit ----
const auditReport = runAudit(data, fields, delimiter);
const reportJson = JSON.stringify(auditReport, null, 2);
const auditReportSha256 = crypto.createHash('sha256').update(reportJson).digest('hex');
console.log('AuditReport SHA-256:', auditReportSha256);

// ---- Save AuditReport ----
fs.writeFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), reportJson);
console.log('Saved: titanic-audit-report.json');

console.log('\n=== Issues Found ===');
auditReport.issues.forEach(i => {
  console.log(`- ${i.ruleName} | ${i.column || 'N/A'} | ${i.id} | count=${i.count}`);
});

// ---- Save metadata (relative paths only) ----
const metadata = {
  nombre: 'titanic',
  filas: data.length,
  columnas: fields.length,
  fingerprint: `fp_${datasetSha256.substring(0, 12)}`,
  datasetSha256,
  auditReportSha256,
  fechaDeGeneracion: new Date().toISOString(),
  commitSha: gitSha,
  versionDelFixture: '4.0.0',
  origenDataset: 'experiments/datasets/titanic.csv',
  motor: 'auditEngine.ts runAudit + PapaParse (production config)',
  parserConfig: { header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: '' },
  nota: 'Fase 0D — parsing identico a csvService.ts productivo, sin rutas absolutas'
};

fs.writeFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), JSON.stringify(metadata, null, 2));
console.log('\nSaved: titanic-dataset-metadata.json');
console.log('Commit SHA:', gitSha);
console.log('Done!');