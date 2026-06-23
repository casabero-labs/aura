/**
 * Generate Real AuditReport using production PapaParse + auditEngine.ts
 * Fase 0C: Uses PapaParse identically to production csvService.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Papa = require('papaparse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = '/Users/casabero/Documents/GitHub/aura/experiments/datasets/titanic.csv';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Import production code
const { runAudit } = await import('/Users/casabero/Documents/GitHub/aura/src/services/auditEngine.ts');

// Parse CSV using PapaParse identically to production csvService.ts
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

// SHA-256
const datasetContent = fs.readFileSync(DATASET_PATH);
const datasetSha256 = crypto.createHash('sha256').update(datasetContent).digest('hex');
console.log('Dataset SHA-256:', datasetSha256);

// Run production audit
const auditReport = runAudit(data, fields, delimiter);
const reportJson = JSON.stringify(auditReport, null, 2);
const reportSha256 = crypto.createHash('sha256').update(reportJson).digest('hex');
console.log('AuditReport SHA-256:', reportSha256);

// Save
fs.writeFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), reportJson);
console.log('Saved: titanic-audit-report.json');

// Print issues
console.log('\n=== Issues Found ===');
auditReport.issues.forEach(i => {
  console.log(`- ${i.ruleName} | ${i.column || 'N/A'} | ${i.id} | count=${i.count}`);
});

// Save metadata
let gitSha = 'unknown';
try {
  const cp = await import('node:child_process');
  gitSha = cp.execSync('git rev-parse HEAD', { cwd: path.join(__dirname, '../../..') }).toString().trim();
} catch {
  gitSha = 'unknown';
}

const metadata = {
  nombre: 'titanic',
  filas: data.length,
  columnas: fields.length,
  fingerprint: `fp_${datasetSha256.substring(0, 12)}`,
  datasetSha256,
  auditReportSha256: reportSha256,
  fechaDeGeneracion: new Date().toISOString(),
  commitSha: gitSha,
  versionDelFixture: '3.0.0',
  origenDataset: 'experiments/datasets/titanic.csv',
  motor: 'auditEngine.ts runAudit + PapaParse (production config)',
  parserConfig: { header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: '' },
  nota: 'Fase 0C — parsing identico a csvService.ts productivo'
};

fs.writeFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), JSON.stringify(metadata, null, 2));
console.log('\nSaved: titanic-dataset-metadata.json');
console.log('Commit SHA:', gitSha);
console.log('Done!');
