/**
 * Generate Real AuditReport using production code
 * Uses the actual runAudit from auditEngine.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = '/Users/casabero/Documents/GitHub/aura/experiments/datasets/titanic.csv';
const FIXTURES_DIR = __dirname;

// Calculate SHA-256 of dataset
const datasetContent = fs.readFileSync(DATASET_PATH);
const datasetSha256 = crypto.createHash('sha256').update(datasetContent).digest('hex');
console.log('Dataset SHA-256:', datasetSha256);

// Import production code
const { runAudit } = await import('/Users/casabero/Documents/GitHub/aura/src/services/auditEngine.ts');
const { parseCsv } = await import('/Users/casabero/Documents/GitHub/aura/src/services/csvService.ts');

// Load and parse CSV using production parser
async function loadDataset() {
  // Read CSV manually for Node.js
  const content = fs.readFileSync(DATASET_PATH, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

  // Parse CSV handling quoted fields
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || '';
      const num = parseFloat(val);
      row[h] = (val !== '' && !isNaN(num) && val !== '') ? num : val;
    });
    data.push(row);
  }
  return { data, headers };
}

console.log('Loading Titanic dataset...');
const { data, headers } = await loadDataset();
console.log(`Loaded ${data.length} rows, ${headers.length} columns`);

// Run actual production audit
console.log('Running production runAudit...');
const auditReport = runAudit(data, headers, ',');

// Calculate SHA-256 of AuditReport
const reportJson = JSON.stringify(auditReport, null, 2);
const reportSha256 = crypto.createHash('sha256').update(reportJson).digest('hex');
console.log('AuditReport SHA-256:', reportSha256);

// Save AuditReport fixture
fs.writeFileSync(
  path.join(FIXTURES_DIR, 'titanic-audit-report.json'),
  reportJson
);
console.log('Saved: titanic-audit-report.json');

// Print issues found
console.log('\n=== Issues Found ===');
auditReport.issues.forEach(issue => {
  console.log(`- ${issue.ruleName} (${issue.category}) - Column: ${issue.column || 'N/A'} - Count: ${issue.count}`);
});

// Save metadata
const metadata = {
  nombre: 'titanic',
  filas: data.length,
  columnas: headers.length,
  fingerprint: `fp_${datasetSha256.substring(0, 8)}`,
  datasetSha256,
  auditReportSha256: reportSha256,
  fechaDeGeneracion: new Date().toISOString(),
  commitSha: 'main (working tree)',
  versionDelFixture: '2.0.0',
  origenDataset: 'experiments/datasets/titanic.csv',
  motor: 'auditEngine.ts runAudit',
  nota: 'Generado usando código productivo real'
};

fs.writeFileSync(
  path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'),
  JSON.stringify(metadata, null, 2)
);
console.log('\nSaved: titanic-dataset-metadata.json');
console.log('\nDone!');
