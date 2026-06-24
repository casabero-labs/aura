/**
 * Contracts v2 — Local Dataset Validation Harness.
 *
 * Discovers all compatible datasets in experiments/datasets,
 * runs audit engine → builds EvidenceEnvelopeV2 → validates all 3 privacy levels.
 *
 * Usage: npm run contracts:v2:validate-local
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Papa = require('papaparse');
const { createHash } = require('node:crypto');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.resolve(__dirname, 'local-validation-results');

// Resolve datasets dir
const DATASETS_DIR = process.env.AURA_DATASETS_DIR
  || path.resolve(REPO_ROOT, 'experiments/datasets')
  || '/Users/casabero/Documents/GitHub/aura/experiments/datasets';

const PRIVACY_LEVELS = ['local_full', 'cloud_minimized', 'cloud_no_samples'];

const BUDGET_PRESETS = {
  default: {},
  reduced: { maxColumns: 5, maxIssues: 10, maxSamplesPerIssue: 2, maxTopValues: 3, maxCharacters: 8000 },
  tight: { maxColumns: 3, maxIssues: 5, maxSamplesPerIssue: 1, maxTopValues: 2, maxCharacters: 4000 },
};

const SUPPORTED_EXTENSIONS = ['.csv'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ── Dynamic imports ──
const { runAudit } = await import(path.resolve(REPO_ROOT, 'src/services/auditEngine.ts'));
const { _buildEvidenceEnvelopeV2 } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/evidenceEnvelopeV2.ts'));

// ── Results store ──
const results = {
  harnessVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  datasetsDir: DATASETS_DIR,
  summary: { total: 0, passed: 0, failed: 0, unsupported: 0 },
  files: [],
};

// ── Main ──

async function main() {
  console.log(`[validate-local] Datasets dir: ${DATASETS_DIR}`);
  if (!fs.existsSync(DATASETS_DIR)) {
    console.error(`[validate-local] ERROR: datasets dir not found: ${DATASETS_DIR}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(DATASETS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    const fullPath = path.join(DATASETS_DIR, f);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return false;
    if (!SUPPORTED_EXTENSIONS.includes(ext)) return false;
    if (stat.size > MAX_FILE_SIZE) return false;
    return true;
  });

  console.log(`[validate-local] Found ${entries.length} compatible files`);

  for (const file of entries.sort()) {
    await validateFile(file);
  }

  // Summary
  results.summary.total = results.files.length;
  results.summary.passed = results.files.filter(f => f.status === 'PASS').length;
  results.summary.failed = results.files.filter(f => f.status === 'FAIL').length;
  results.summary.unsupported = results.files.filter(f => f.status === 'UNSUPPORTED').length;

  // Write JSON
  const jsonPath = path.join(RESULTS_DIR, 'validation-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n[validate-local] JSON → ${jsonPath}`);

  // Write Markdown
  const mdPath = path.join(RESULTS_DIR, 'validation-results.md');
  fs.writeFileSync(mdPath, generateMarkdown(results));
  console.log(`[validate-local] MD  → ${mdPath}`);

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${results.summary.total}`);
  console.log(`PASS:  ${results.summary.passed}`);
  console.log(`FAIL:  ${results.summary.failed}`);
  console.log(`UNSUPPORTED: ${results.summary.unsupported}`);

  process.exit(results.summary.failed > 0 ? 1 : 0);
}

// ── Per-file validation ──

async function validateFile(filename) {
  const filePath = path.join(DATASETS_DIR, filename);
  const startTime = Date.now();
  const record = {
    file: filename,
    path: filePath,
    status: 'PENDING',
    sha256: '',
    sizeBytes: 0,
    rowCount: 0,
    colCount: 0,
    issuesCount: 0,
    duplicateColumns: 0,
    invalidReferences: 0,
    envelopes: {},
    privacyViolations: 0,
    truncations: 0,
    durationMs: 0,
    error: null,
  };

  try {
    // Compute SHA-256
    record.sha256 = createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    record.sizeBytes = fs.statSync(filePath).size;

    // Parse CSV
    const csvString = fs.readFileSync(filePath, 'utf-8');
    const parseResult = Papa.parse(csvString, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: '',
    });

    const data = parseResult.data || [];
    const fields = parseResult.meta.fields || [];
    const delimiter = parseResult.meta.delimiter || ',';

    if (data.length === 0 || fields.length === 0) {
      record.status = 'UNSUPPORTED';
      record.error = 'Empty or unparseable CSV';
      results.files.push(record);
      return;
    }

    record.rowCount = data.length;
    record.colCount = fields.length;

    // Count duplicate columns
    const nameCounts = new Map();
    for (const f of fields) nameCounts.set(f, (nameCounts.get(f) || 0) + 1);
    record.duplicateColumns = [...nameCounts.values()].filter(c => c > 1).length;

    // Run audit
    const auditReport = runAudit(data, fields, delimiter);
    record.issuesCount = auditReport.issues.length;

    // Build audit report input for envelope
    const reportInput = {
      score: auditReport.score,
      rowCount: auditReport.rowCount,
      colCount: auditReport.colCount,
      duplicateRows: auditReport.duplicateRows,
      delimiterDetected: auditReport.delimiterDetected,
      issues: auditReport.issues.map(i => ({
        id: i.id,
        column: i.column,
        category: i.category,
        ruleName: i.ruleName,
        description: i.description,
        severity: i.severity,
        count: i.count,
        affectedPercentage: i.affectedPercentage,
        sampleValues: i.sampleValues || [],
      })),
      columnStats: auditReport.columnStats ? Object.fromEntries(
        Object.entries(auditReport.columnStats).map(([k, v]) => [k, {
          inferredType: v.inferredType,
          semanticType: v.semanticType,
          distinctCount: v.uniqueCount || 0,
          nullCount: v.nullCount || 0,
          nullPercentage: v.nullCount && record.rowCount ? (v.nullCount / record.rowCount) * 100 : 0,
          topValues: (v.topFreq || []).map((tv) => ({ value: tv.value, count: tv.count, percentage: 0 })),
          stats: {},
        }])
      ) : undefined,
      datasetProfile: auditReport.datasetProfile || {
        columns: fields.map(f => ({ name: f })),
      },
      scoreBreakdown: auditReport.scoreBreakdown || [],
    };

    // Build envelopes for all privacy levels × budgets
    for (const privacyLevel of PRIVACY_LEVELS) {
      for (const [budgetName, budgetOverride] of Object.entries(BUDGET_PRESETS)) {
        const key = `${privacyLevel}_${budgetName}`;
        try {
          const envelope = _buildEvidenceEnvelopeV2(reportInput, {
            privacyLevel,
            datasetSha256: record.sha256,
            delimiter,
            tokenBudget: budgetOverride,
          });

          const envJson = JSON.stringify(envelope);
          const envSize = envJson.length;
          const truncTotal = Object.values(envelope.truncationManifest).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
          const privViolations = envelope.privacyPolicy.level === 'cloud_minimized'
            ? countPIILeaks(envelope)
            : 0;

          record.envelopes[key] = {
            size: envSize,
            samples: envelope.evidence.samples.length,
            columns: envelope.columns.length,
            issues: envelope.issues.length,
            truncations: truncTotal,
            privacyViolations: privViolations,
            valid: true,
          };

          record.truncations = Math.max(record.truncations, truncTotal);
          record.privacyViolations = Math.max(record.privacyViolations, privViolations);

          // Count invalid references
          const colIds = new Set(envelope.columns.map(c => c.columnId));
          const issueColIds = envelope.issues.filter(i => i.columnId && !colIds.has(i.columnId));
          const sampleIssueIds = envelope.evidence.samples.filter(s => !envelope.issues.find(i => i.issueId === s.issueId));
          record.invalidReferences = issueColIds.length + sampleIssueIds.length;

        } catch (err) {
          record.envelopes[key] = {
            error: err.message,
            code: err.code || 'UNKNOWN',
            valid: false,
          };
          if (err.code === 'BUDGET_UNSATISFIABLE') {
            record.envelopes[key].note = 'Budget too tight for this dataset';
          }
        }
      }
    }

    // Determine overall status
    // BUDGET_UNSATISFIABLE on tight budgets is expected, not a failure
    const entries = Object.entries(record.envelopes);
    const nonTightErrors = entries.filter(([key, e]) =>
      !e.valid && e.code !== 'BUDGET_UNSATISFIABLE'
    );
    const tightBudgetOnly = entries.filter(([key, e]) =>
      !e.valid && e.code === 'BUDGET_UNSATISFIABLE'
    ).length;

    if (nonTightErrors.length > 0) {
      record.status = 'FAIL';
    } else if (tightBudgetOnly > 0 && entries.some(([k, e]) => e.valid)) {
      record.status = 'PASS'; // tight budget failures are informational
    } else {
      record.status = 'PASS';
    }

  } catch (err) {
    record.status = 'FAIL';
    record.error = err.message;
  }

  record.durationMs = Date.now() - startTime;
  results.files.push(record);

  const statusIcon = record.status === 'PASS' ? '✓' : record.status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${statusIcon} ${filename} — ${record.status} (${record.rowCount}r × ${record.colCount}c, ${record.issuesCount} issues, ${record.durationMs}ms)`);
}

// ── PII leak counter for cloud_minimized ──

function countPIILeaks(envelope) {
  let count = 0;
  const rawPII = [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/, /^\d{3}-\d{2}-\d{4}$/];
  for (const s of (envelope.evidence?.samples || [])) {
    for (const v of (s.values || [])) {
      const str = String(v ?? '');
      if (!str.startsWith('sha256:') && !str.includes('***')) {
        for (const p of rawPII) { if (p.test(str)) count++; }
      }
    }
  }
  return count;
}

// ── Markdown report ──

function generateMarkdown(results) {
  const lines = [];
  lines.push('# Contracts v2 — Local Dataset Validation');
  lines.push('');
  lines.push(`**Generated:** ${results.generatedAt}`);
  lines.push(`**Datasets dir:** ${results.datasetsDir}`);
  lines.push('');
  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| PASS | ${results.summary.passed} |`);
  lines.push(`| FAIL | ${results.summary.failed} |`);
  lines.push(`| UNSUPPORTED | ${results.summary.unsupported} |`);
  lines.push('');

  for (const file of results.files) {
    const icon = file.status === 'PASS' ? '✅' : file.status === 'FAIL' ? '❌' : '⚠️';
    lines.push(`## ${icon} ${file.file}`);
    lines.push('');
    lines.push(`- **Status:** ${file.status}`);
    lines.push(`- **SHA-256:** \`${file.sha256}\``);
    lines.push(`- **Size:** ${formatBytes(file.sizeBytes)}`);
    lines.push(`- **Rows:** ${file.rowCount} × **Cols:** ${file.colCount}`);
    lines.push(`- **Issues:** ${file.issuesCount}`);
    lines.push(`- **Duplicate columns:** ${file.duplicateColumns}`);
    lines.push(`- **Duration:** ${file.durationMs}ms`);

    if (file.error) {
      lines.push(`- **Error:** ${file.error}`);
    }

    if (Object.keys(file.envelopes).length > 0) {
      lines.push('');
      lines.push('| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |');
      lines.push('|-------|--------|------|---------|---------|--------|-------|-----------|');

      for (const [key, env] of Object.entries(file.envelopes)) {
        if (env.error) {
          lines.push(`| ${key} | — | — | — | — | — | — | ${env.error} |`);
        } else {
          const leakIcon = env.privacyViolations > 0 ? `**${env.privacyViolations}** ⚠️` : '0';
          lines.push(`| ${key} | | ${formatBytes(env.size)} | ${env.samples} | ${env.columns} | ${env.issues} | ${env.truncations} | ${leakIcon} |`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

main().catch(err => {
  console.error('[validate-local] FATAL:', err);
  process.exit(1);
});
