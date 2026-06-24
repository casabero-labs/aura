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
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const Papa = require('papaparse');
const { createHash } = require('node:crypto');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.resolve(__dirname, 'local-validation-results');

// Resolve datasets dir — check existence in order
function resolveDatasetsDir() {
  const candidates = [
    { env: 'AURA_DATASETS_DIR', path: process.env.AURA_DATASETS_DIR },
    { env: 'relative', path: path.resolve(REPO_ROOT, 'experiments/datasets') },
    { env: 'fallback', path: '/Users/casabero/Documents/GitHub/aura/experiments/datasets' },
  ];

  for (const c of candidates) {
    if (c.path && fs.existsSync(c.path)) {
      return c.path;
    }
  }

  throw new Error(
    'No datasets directory found. Checked:\n' +
    candidates.map(c => `  - ${c.env}: ${c.path || '(not set)'}`).join('\n')
  );
}

const DATASETS_DIR = resolveDatasetsDir();

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
const { buildDiagnosisPromptV2, buildEnvelopeRef } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/diagnosisPromptV2.ts'));
const { validateDiagnosisResponseV2 } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/diagnosisValidatorV2.ts'));
const { buildRemediationContext } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/remediationContextV2.ts'));
const { buildRemediationPlanV2, buildRemediationPlanId } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/remediationBuilderV2.ts'));
const { validateRemediationPlanV2 } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/remediationValidatorV2.ts'));
const { sha256hex } = await import(path.resolve(REPO_ROOT, 'src/contracts/llm/hash.ts'));

// ── Provenance metadata ──
function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const auditEngineSha256 = sha256(path.resolve(REPO_ROOT, 'src/services/auditEngine.ts'));
// Hash all Contracts v2 module files for accurate provenance
const v2Modules = [
  'src/contracts/llm/diagnosisPromptV2.ts',
  'src/contracts/llm/diagnosisParserV2.ts',
  'src/contracts/llm/diagnosisValidatorV2.ts',
  'src/contracts/llm/diagnosisPipelineV2.ts',
  'src/contracts/llm/diagnosisV2Errors.ts',
  'src/contracts/llm/types.ts',
  'src/contracts/llm/index.ts',
  'src/contracts/llm/remediationBuilderV2.ts',
  'src/contracts/llm/remediationValidatorV2.ts',
  'src/contracts/llm/remediationContextV2.ts',
  'src/contracts/llm/remediationApprovalV2.ts',
  'src/contracts/llm/remediationPolicyV2.ts',
  'src/contracts/llm/hash.ts',
].map(f => path.resolve(REPO_ROOT, f)).filter(f => fs.existsSync(f));

// Sort for deterministic order
v2Modules.sort();
const v2ModuleContent = v2Modules.map(f => sha256(f)).join('');
const contractsV2Sha256 = createHash('sha256').update(v2ModuleContent).digest('hex');
const commitSha = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
const sourceTreeDirty = execSync('git status --porcelain', { cwd: REPO_ROOT }).toString().trim().length > 0;

// ── Results store ──
const results = {
  harnessVersion: '1.1.0',
  generatedAt: new Date().toISOString(),
  commitSha,
  sourceTreeDirty,
  auditEngineSha256,
  contractsV2Sha256,
  datasetsDir: DATASETS_DIR,
  summary: { total: 0, passed: 0, failed: 0, unsupported: 0 },
  files: [],
  diagnosis: { promptHashStable: true, fixtures: [] },
  remediation: { plansBuilt: 0, plansValid: 0, planHashStable: true, unsafeUpgrades: 0, invalidReferences: 0 },
};

// ── Main ──

async function main() {
  console.log(`[validate-local] Datasets dir: ${DATASETS_DIR}`);
  if (!fs.existsSync(DATASETS_DIR)) {
    console.error(`[validate-local] ERROR: datasets dir not found: ${DATASETS_DIR}`);
    process.exit(1);
  }

  const allEntries = fs.readdirSync(DATASETS_DIR);
  const unsupportedFiles = [];
  const entries = allEntries.filter(f => {
    const fullPath = path.join(DATASETS_DIR, f);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return false;
      const ext = path.extname(f).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        unsupportedFiles.push({ file: f, cause: `Unsupported extension: ${ext || '(none)'}` });
        return false;
      }
      if (stat.size > MAX_FILE_SIZE) {
        unsupportedFiles.push({ file: f, cause: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB` });
        return false;
      }
      return true;
    } catch (err) {
      unsupportedFiles.push({ file: f, cause: `Error reading: ${err.message}` });
      return false;
    }
  });

  // Register unsupported files
  for (const uf of unsupportedFiles) {
    results.files.push({
      file: uf.file,
      path: path.join(DATASETS_DIR, uf.file),
      status: 'UNSUPPORTED',
      error: uf.cause,
    });
  }

  console.log(`[validate-local] Found ${entries.length} compatible, ${unsupportedFiles.length} unsupported`);

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
  console.log(`\n=== REMEDIATION (Phase 3) ===`);
  console.log(`Plans built: ${results.remediation.plansBuilt}`);
  console.log(`Plans valid: ${results.remediation.plansValid}`);
  console.log(`planHashStable: ${results.remediation.planHashStable}`);
  console.log(`unsafeUpgrades: ${results.remediation.unsafeUpgrades}`);
  console.log(`invalidReferences: ${results.remediation.invalidReferences}`);

  const globalFail = results.summary.failed > 0
    || !results.remediation.planHashStable
    || results.remediation.invalidReferences > 0
    || results.remediation.unsafeUpgrades > 0;

  process.exit(globalFail ? 1 : 0);
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
    remediation: null,
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
          ruleId: i.ruleId,
          automaticAuthorization: i.automaticAuthorization,
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

    // ── Diagnosis fixture (deterministic, no model call) ──
    let diagValid = false;
    let diagErrors = [];
    try {
      const diagEnvelope = _buildEvidenceEnvelopeV2(reportInput, {
        privacyLevel: 'local_full',
        datasetSha256: record.sha256,
        delimiter,
      });
      const promptPackage = buildDiagnosisPromptV2(diagEnvelope);
      const envelopeRef = buildEnvelopeRef(diagEnvelope);

      // Verify prompt hash is stable
      const promptPackage2 = buildDiagnosisPromptV2(diagEnvelope);
      if (promptPackage.promptHash !== promptPackage2.promptHash) {
        results.diagnosis.promptHashStable = false;
      }

      // Build a minimal deterministic diagnosis fixture that mirrors envelope issues
      const diagIssues = (diagEnvelope.issues || []).map(iss => ({
        issueId: iss.issueId,
        evidenceRefs: iss.evidenceRefs || [],
        hypothesis: `Automatically generated from ${iss.ruleName || iss.ruleId}`,
        confidence: 0.5,
        // requiresHumanReview=true when: review_only, unauthorized, empty evidenceRefs, or column ambiguous/duplicate
        requiresHumanReview: iss.actionability === 'review_only'
          || !iss.automaticAuthorization?.authorized
          || !(iss.evidenceRefs && iss.evidenceRefs.length > 0)
          || (iss.columnId && diagEnvelope.columns.find(c => c.columnId === iss.columnId && (c.isAmbiguous || c.isDuplicate)) !== undefined),
        limits: ['Deterministic fixture — no model inference applied'],
      }));

      const diagBlocks = (diagEnvelope.issues || []).map(iss => ({
        issueId: iss.issueId,
        ruleId: iss.ruleId,
        columnId: iss.columnId || null,
        scope: iss.scope || 'column',
        observation: `${iss.ruleName || iss.ruleId}: ${iss.count} affected (${iss.affectedPercentage}%)`,
        recommendation: 'Review this issue in the context of the dataset domain',
      }));

      const diagnosisFixture = {
        contractId: 'aura.diagnosis.v2',
        contractVersion: '2.0.0',
        evidenceEnvelopeRef: envelopeRef,
        responseId: `diag-fixture-${record.file.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60)}`,
        issues: diagIssues,
        diagnosisBlocks: diagBlocks,
        limitations: ['Deterministic diagnosis fixture — no LLM inference performed'],
        generatedAt: new Date().toISOString(),
      };

      // Validate the fixture against its own envelope
      const validation = validateDiagnosisResponseV2(diagnosisFixture, diagEnvelope);
      diagValid = validation.valid;
      diagErrors = validation.errors.map(e => ({ path: e.path, message: e.message }));

      results.diagnosis.fixtures.push({
        file: record.file,
        envelopeRef,
        promptHash: promptPackage.promptHash,
        promptHashStable: promptPackage.promptHash === promptPackage2.promptHash,
        issueCount: diagIssues.length,
        blockCount: diagBlocks.length,
        validation: {
          valid: validation.valid,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
          errors: diagErrors,
        },
      });
    } catch (diagErr) {
      diagValid = false;
      diagErrors = [{ path: '', message: `Diagnosis fixture generation failed: ${diagErr.message}` }];
      results.diagnosis.fixtures.push({
        file: record.file,
        error: `Diagnosis fixture generation failed: ${diagErr.message}`,
      });
    }

    // ── Phase 3: Remediation Plan v2 ──
    let remediationData = null;
    try {
      // Build envelope for local_full (deterministic, no model call)
      const remEnvelope = _buildEvidenceEnvelopeV2(reportInput, {
        privacyLevel: 'local_full',
        datasetSha256: record.sha256,
        delimiter,
      });
      const remPromptPkg = buildDiagnosisPromptV2(remEnvelope);
      const remEnvelopeRef = buildEnvelopeRef(remEnvelope);

      // Build diagnosis fixture (mirrors envelope issues)
      const remDiagIssues = (remEnvelope.issues || []).map(iss => ({
        issueId: iss.issueId,
        evidenceRefs: iss.evidenceRefs || [],
        hypothesis: `Auto-generated from ${iss.ruleName || iss.ruleId}`,
        confidence: 0.5,
        requiresHumanReview: iss.actionability === 'review_only'
          || !iss.automaticAuthorization?.authorized
          || !(iss.evidenceRefs && iss.evidenceRefs.length > 0)
          || (iss.columnId && remEnvelope.columns.find(c => c.columnId === iss.columnId && (c.isAmbiguous || c.isDuplicate)) !== undefined),
        limits: ['Deterministic fixture — no LLM'],
      }));

      const remDiagBlocks = (remEnvelope.issues || []).map(iss => ({
        issueId: iss.issueId,
        ruleId: iss.ruleId,
        columnId: iss.columnId || null,
        scope: iss.scope || 'column',
        observation: `${iss.ruleName || iss.ruleId}: ${iss.count} affected`,
        recommendation: 'Review this issue',
      }));

      const remDiagnosisFixture = {
        contractId: 'aura.diagnosis.v2',
        contractVersion: '2.0.0',
        evidenceEnvelopeRef: remEnvelopeRef,
        responseId: `diag-fixture-${record.file.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60)}`,
        issues: remDiagIssues,
        diagnosisBlocks: remDiagBlocks,
        limitations: ['Deterministic diagnosis fixture — no LLM inference performed'],
        generatedAt: new Date().toISOString(),
      };

      // Build remediation context
      const remCtx = buildRemediationContext(remEnvelope);
      remCtx.evidenceEnvelopeRef = remPromptPkg.evidenceEnvelopeRef;
      remCtx.datasetFingerprint = record.sha256;

      // Build DiagnosisExecutionResult with remediationContext
      const remExecResult = {
        version: 2,
        diagnosis: remDiagnosisFixture,
        metrics: { latencyMs: 0, tokensGenerated: 0, model: 'fixture', provider: 'test', isLocal: true },
        promptHash: remPromptPkg.promptHash,
        evidenceEnvelopeRef: remPromptPkg.evidenceEnvelopeRef,
        promptVersion: '1',
        rawResponseHash: 'r-rem',
        remediationContext: remCtx,
      };

      // Build plan
      const remPlan = buildRemediationPlanV2(remExecResult);

      // Verify planId stability
      const remPlan2 = buildRemediationPlanV2(remExecResult);
      const planHashStable = remPlan.planId === remPlan2.planId;
      if (!planHashStable) results.remediation.planHashStable = false;

      // Validate plan
      const remValidation = validateRemediationPlanV2(remPlan, remExecResult);

      // Compute plan hash (stable, excluding approvalStatus)
      const planStableJson = JSON.stringify(remPlan.plan.map(a => {
        const { approvalStatus, ...rest } = a;
        return rest;
      }).sort((a, b) => a.actionId.localeCompare(b.actionId)));
      const planHash = createHash('sha256').update(planStableJson).digest('hex').slice(0, 16);

      // Count actionability categories
      const autoSafeCount = remPlan.plan.filter(a => a.actionability === 'auto_safe').length;
      const reviewOnlyCount = remPlan.plan.filter(a => a.actionability === 'review_only').length;
      const notActionableCount = remPlan.exclusions.length;
      const pendingCount = remPlan.plan.filter(a => a.approvalStatus === 'pending').length;

      // Count unsafe upgrades and invalid references from validation
      const unsafeUpgrades = remValidation.errors.filter(e => e.code === 'REMEDIATION_ACTIONABILITY_UPGRADE').length;
      const invalidRefs = remValidation.errors.filter(e =>
        e.code === 'REMEDIATION_REFERENCE_INVALID' ||
        e.code === 'REMEDIATION_ACTION_ID_INVALID'
      ).length;

      if (unsafeUpgrades > 0) results.remediation.unsafeUpgrades += unsafeUpgrades;
      if (invalidRefs > 0) results.remediation.invalidReferences += invalidRefs;

      results.remediation.plansBuilt += 1;
      if (remValidation.valid) results.remediation.plansValid += 1;

      remediationData = {
        diagnosisRef: remPlan.diagnosisRef,
        planId: remPlan.planId,
        planHash,
        planHashStable,
        totalActions: remPlan.plan.length,
        autoSafeCount,
        reviewOnlyCount,
        notActionableCount,
        pendingCount,
        exclusionCount: remPlan.exclusions.length,
        invalidReferences: invalidRefs,
        unsafeUpgrades,
        validation: {
          valid: remValidation.valid,
          errorCount: remValidation.errors.length,
          errors: remValidation.errors.map(e => ({ code: e.code, path: e.path, message: e.message })),
        },
      };
    } catch (remErr) {
      remediationData = {
        error: `Remediation plan build failed: ${remErr.message}`,
        validation: { valid: false, errorCount: 1, errors: [{ code: 'BUILD_ERROR', path: '', message: remErr.message }] },
      };
    }

    record.remediation = remediationData;

    // Determine overall status — includes diagnosis AND remediation validity
    // BUDGET_UNSATISFIABLE on tight budgets is expected, not a failure
    const entries = Object.entries(record.envelopes);
    const nonTightErrors = entries.filter(([key, e]) =>
      !e.valid && e.code !== 'BUDGET_UNSATISFIABLE'
    );
    const tightBudgetOnly = entries.filter(([key, e]) =>
      !e.valid && e.code === 'BUDGET_UNSATISFIABLE'
    ).length;

    const remValid = remediationData?.validation?.valid ?? false;
    const remUnsafe = (remediationData?.unsafeUpgrades ?? 0) > 0;
    const remInvalidRefs = (remediationData?.invalidReferences ?? 0) > 0;
    const remPlanHashStable = remediationData?.planHashStable ?? false;
    const remHasError = !!remediationData?.error;

    // FAIL conditions: envelope errors, diagnosis invalid, remediation invalid, unsafe upgrades, invalid refs, hash unstable
    const failConditions =
      nonTightErrors.length > 0 ||
      !diagValid ||
      !remValid ||
      remUnsafe ||
      remInvalidRefs ||
      !remPlanHashStable ||
      remHasError;

    if (failConditions) {
      record.status = 'FAIL';
      if (!diagValid) record.diagnosisError = diagErrors[0]?.message ?? 'Invalid diagnosis fixture';
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
  lines.push(`## Remediation (Phase 3)`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Plans built | ${results.remediation.plansBuilt} |`);
  lines.push(`| Plans valid | ${results.remediation.plansValid} |`);
  lines.push(`| planHashStable | ${results.remediation.planHashStable} |`);
  lines.push(`| unsafeUpgrades | ${results.remediation.unsafeUpgrades} |`);
  lines.push(`| invalidReferences | ${results.remediation.invalidReferences} |`);
  lines.push('');

  for (const file of results.files) {
    const icon = file.status === 'PASS' ? '✅' : file.status === 'FAIL' ? '❌' : '⚠️';
    lines.push(`## ${icon} ${file.file}`);
    lines.push('');
    lines.push(`- **Status:** ${file.status}`);
    lines.push(`- **SHA-256:** \`${file.sha256 || 'N/A'}\``);
    lines.push(`- **Size:** ${file.sizeBytes ? formatBytes(file.sizeBytes) : 'N/A'}`);
    lines.push(`- **Rows:** ${file.rowCount || 0} × **Cols:** ${file.colCount || 0}`);
    lines.push(`- **Issues:** ${file.issuesCount || 0}`);
    lines.push(`- **Duplicate columns:** ${file.duplicateColumns || 0}`);
    lines.push(`- **Duration:** ${file.durationMs || 0}ms`);

    if (file.error) {
      lines.push(`- **Error:** ${file.error}`);
    }

    if (file.envelopes && Object.keys(file.envelopes).length > 0) {
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

    if (file.remediation) {
      const rem = file.remediation;
      lines.push('');
      lines.push(`**Remediation Plan:** ${rem.error ? '❌ ' + rem.error : '✅ Valid'}`);
      if (!rem.error) {
        lines.push(`- **planId:** \`${rem.planId}\``);
        lines.push(`- **planHash:** \`${rem.planHash}\` (stable: ${rem.planHashStable})`);
        lines.push(`- **Actions:** ${rem.totalActions} total · ${rem.autoSafeCount} auto_safe · ${rem.reviewOnlyCount} review_only`);
        lines.push(`- **Exclusions:** ${rem.exclusionCount} not_actionable`);
        lines.push(`- **Pending:** ${rem.pendingCount}`);
        lines.push(`- **unsafeUpgrades:** ${rem.unsafeUpgrades}`);
        lines.push(`- **invalidReferences:** ${rem.invalidReferences}`);
        lines.push(`- **validation:** ${rem.validation?.valid ? '✅ PASS' : '❌ FAIL'} (${rem.validation?.errorCount ?? 0} errors)`);
        if (rem.validation?.errors?.length > 0) {
          for (const err of rem.validation.errors) {
            lines.push(`  - \`${err.code}\` @ ${err.path}: ${err.message}`);
          }
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
