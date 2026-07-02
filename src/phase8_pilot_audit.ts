// ── Phase 8 L3: Controlled Pilot Run ──
// Standalone script to run AURA audit on controlled_customers_phase8.csv
// Invoked from src/ directory where papaparse and auditEngine are available.
// Usage: npx tsx phase8_pilot_audit.ts

import { readFileSync, writeFileSync } from 'node:fs';
import Papa from 'papaparse';
import { runAudit } from './services/auditEngine';
import { buildDeterministicCleaningScript } from './services/deterministicScriptBuilder';
import { buildColabNotebookJSON } from './services/colabExporter';

const CSV_PATH = '../docs/tercera_entrega_aura/03_evidencia/phase_08/datasets/controlled_customers_phase8.csv';
const OUT_DIR = '../docs/tercera_entrega_aura/03_evidencia/phase_08/pilot_run_l3';

const csvContent = readFileSync(CSV_PATH, 'utf-8');
const parsed = Papa.parse(csvContent, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  delimiter: '',
});

const data = parsed.data as Record<string, any>[];
const fields: string[] = parsed.meta.fields ?? [];
const delimiter = parsed.meta.delimiter ?? ',';

console.log(`[L3] Controlled Pilot Run`);
console.log(`  Dataset: controlled_customers_phase8.csv`);
console.log(`  Rows: ${data.length}, Columns: ${fields.length}, Delimiter: "${delimiter}"`);

const report = runAudit(data, fields, delimiter);

console.log(`  Score: ${report.score}/100`);
console.log(`  Issues found: ${report.issues.length}`);
console.log(`  Duplicate rows: ${report.duplicateRows}`);

report.issues.forEach(i => {
  console.log(`    [${i.severity}] ${i.ruleName} — ${i.column ?? 'dataset'} (${i.count})`);
});

writeFileSync(`${OUT_DIR}/aura_audit_controlled_customers_phase8.json`, JSON.stringify(report, null, 2));
console.log(`  [OK] Audit JSON saved`);

const issuesCsvHeader = ['id','severity','category','ruleName','ruleId','column','count','affectedPercentage','description','sampleValues'];
const issuesCsvRows = report.issues.map(i => [
  i.id, i.severity, i.category, i.ruleName, i.ruleId,
  i.column ?? '', i.count, i.affectedPercentage.toFixed(2),
  `"${(i.description ?? '').replace(/"/g, '""')}"`,
  `"${String(i.sampleValues ?? []).replace(/"/g, '""')}"`,
].join(','));
const issuesCsv = [issuesCsvHeader.join(','), ...issuesCsvRows].join('\n');
writeFileSync(`${OUT_DIR}/aura_issues_controlled_customers_phase8.csv`, issuesCsv);
console.log(`  [OK] Issues CSV saved`);

const script = buildDeterministicCleaningScript(report);
const scriptWithHeader = `# AURA Generated Script — Phase 8 L3 Pilot Run
# Dataset: controlled_customers_phase8.csv (SYNTHETIC — NO PII)
# Generated for controlled synthetic dataset. Review required. Not executed inside AURA.
# Python is executed externally (Colab). AURA does NOT execute Python.
# This dataset was NOT modified. A controlled fixture copy is used.

${script}`;
writeFileSync(`${OUT_DIR}/script_candidate_controlled_customers_phase8.py`, scriptWithHeader);
console.log(`  [OK] Script candidate saved`);

// Build tentative colab notebook
// Note: buildColabNotebookJSON needs datasetName, csvFields, approvedScript, auditSummary
// We can't provide full ApprovedScriptV2 (no plan/remediation), but we can still export the basis
try {
  const notebookStr = buildColabNotebookJSON({
    datasetName: 'controlled_customers_phase8.csv',
    csvFields: fields,
    approvedScript: script,
    auditSummary: {
      score: report.score,
      rowCount: report.rowCount,
      colCount: report.colCount,
      issueCount: report.issues.length,
      truncated: false,
    },
  });
  writeFileSync(`${OUT_DIR}/notebook_candidate_controlled_customers_phase8.json`, notebookStr);
  console.log(`  [OK] Notebook candidate saved`);
} catch(e: any) {
  console.log(`  [SKIP] Notebook not generated: ${e.message}`);
}

// Build pilot summary
const totalIssues = report.issues.length;

console.log(`\n[L3] Summary: ${totalIssues} issues detected. Phase 8 L3 pilot audit complete.`);
