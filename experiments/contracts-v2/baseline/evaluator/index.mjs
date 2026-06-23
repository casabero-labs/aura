/**
 * Main evaluator — Fase 0D.
 *
 * Orchestrates all sub-evaluators:
 * 1. AST extraction
 * 2. Python syntax validation (ast.parse)
 * 3. Phantom column detection
 * 4. Invented rules detection (structured)
 * 5. Citation evaluation (exact, char-by-char)
 * 6. Review retention (per-issue)
 * 7. Automatic action TP/FP/FN
 * 8. Unsafe action count and rate
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractActionsAST } from './astExtractor.mjs';
import { detectPhantomColumns } from './phantomColumnDetector.mjs';
import { detectInventedRulesStructured, loadActualRules } from './inventedRulesDetector.mjs';
import { evaluateCitationsExact, loadEligibleSamples } from './citationEvaluator.mjs';
import { evaluateReviewRetention } from './reviewRetentionEvaluator.mjs';
import { evaluateAutomaticActions, countUnsafeActions } from './autoActionsEvaluator.mjs';
import { validateScriptStructure } from './pythonValidator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_V2_DIR = path.resolve(__dirname, '../..');
const FIXTURES_DIR = path.join(CONTRACTS_V2_DIR, 'fixtures');
const RUNS_DIR = path.join(CONTRACTS_V2_DIR, 'baseline', 'runs');
const OUTPUT_PATH = path.join(CONTRACTS_V2_DIR, 'baseline', 'baseline-summary.json');

/**
 * Load fixtures from disk.
 */
export function loadFixtures() {
  const groundTruthPath = path.join(FIXTURES_DIR, 'titanic-ground-truth.json');
  const auditReportPath = path.join(FIXTURES_DIR, 'titanic-audit-report.json');
  const metadataPath = path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json');

  return {
    groundTruth: JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8')),
    auditReport: JSON.parse(fs.readFileSync(auditReportPath, 'utf-8')),
    metadata: JSON.parse(fs.readFileSync(metadataPath, 'utf-8')),
    paths: {
      groundTruth: groundTruthPath,
      auditReport: auditReportPath,
      metadata: metadataPath
    }
  };
}

/**
 * Evaluate a single run.
 */
export function evaluateRun(run, fixtures) {
  const { groundTruth, auditReport } = fixtures;
  const result = {
    runNumber: run.runNumber,
    seed: run.seed,
    status: run.status,
    tokens: run.tokens,
    tokensSource: run.tokensSource,
    latency: run.totalDurationMs
  };

  if (run.status !== 'completed') {
    result.error = run.error?.message;
    return result;
  }

  const diagText = run.tasks?.B1?.responseRaw || '';
  const summaryText = run.tasks?.B1Summary?.responseRaw || '';
  const scriptText = run.tasks?.B2?.scriptExtracted || '';

  // 1. AST extraction
  const ast = extractActionsAST(scriptText);

  // 2. Python validation
  const pythonVal = validateScriptStructure(scriptText);

  // 3. Phantom columns
  const phantom = detectPhantomColumns(ast, auditReport);

  // 4. Invented rules
  const fullText = diagText + '\n' + summaryText + '\n' + scriptText;
  const actualRules = loadActualRules();
  const rules = detectInventedRulesStructured(fullText, actualRules);

  // 5. Citations
  const eligibleSamples = loadEligibleSamples();
  const citations = evaluateCitationsExact(diagText + '\n' + summaryText, eligibleSamples);

  // 6. Review retention
  const review = evaluateReviewRetention(diagText, ast, groundTruth, auditReport);

  // 7. Automatic actions
  const autoActions = evaluateAutomaticActions(groundTruth, scriptText);

  // 8. Unsafe actions
  const unsafe = countUnsafeActions(groundTruth, scriptText);

  result.ast = {
    valid: ast.valid,
    fallback: ast.fallback,
    columns: ast.columns,
    actionCount: ast.actions.length
  };
  result.pythonValidation = pythonVal;
  result.phantoms = phantom.phantoms;
  result.validColumns = phantom.valid;
  result.inventedRules = rules.invented;
  result.detectedActualRules = rules.actual;
  result.citations = citations;
  result.reviewRetention = review;
  result.autoActions = autoActions;
  result.unsafe = unsafe;

  return result;
}

/**
 * Evaluate all runs and compute aggregate metrics.
 */
export function evaluateAllRuns(fixtures) {
  const runs = [];
  for (let i = 1; i <= 5; i++) {
    const f = path.join(RUNS_DIR, `run-${String(i).padStart(2, '0')}.json`);
    if (fs.existsSync(f)) {
      runs.push(JSON.parse(fs.readFileSync(f, 'utf-8')));
    }
  }

  if (runs.length === 0) {
    return { error: 'no runs found', runs: [], summary: null };
  }

  const evals = runs.map(r => evaluateRun(r, fixtures));
  const summary = computeAggregateSummary(evals, fixtures);

  return { runs: evals, summary };
}

/**
 * Compute aggregate summary from individual run evaluations.
 */
function computeAggregateSummary(evals, fixtures) {
  const completed = evals.filter(e => e.status === 'completed');
  const n = completed.length;

  if (n === 0) {
    return {
      runsEvaluated: evals.length,
      runsCompleted: 0,
      evaluation: { error: 'no completed runs' }
    };
  }

  // Automatic actions
  const autoTP = completed.reduce((a, e) => a + (e.autoActions?.tp || 0), 0);
  const autoFP = completed.reduce((a, e) => a + (e.autoActions?.fp || 0), 0);
  const autoFN = completed.reduce((a, e) => a + (e.autoActions?.fn || 0), 0);

  // Unsafe actions
  const unsafeActionCount = completed.reduce((a, e) => a + (e.unsafe?.unsafeActionCount || 0), 0);
  const totalProposed = completed.reduce((a, e) => a + (e.unsafe?.totalProposed || 0), 0);

  // Citations
  const exactCites = completed.reduce((a, e) => a + (e.citations?.exactCount || 0), 0);
  const alteredCites = completed.reduce((a, e) => a + (e.citations?.alteredCount || 0), 0);
  const totalEligible = completed.reduce((a, e) => a + (e.citations?.eligibleCount || 0), 0);

  // Phantoms
  const phantomTotal = completed.reduce((a, e) => a + (e.phantoms?.length || 0), 0);
  const phantomRuns = completed.filter(e => (e.phantoms?.length || 0) > 0).length;

  // Invented rules
  const inventedTotal = completed.reduce((a, e) => a + (e.inventedRules?.length || 0), 0);
  const inventedRuns = completed.filter(e => (e.inventedRules?.length || 0) > 0).length;

  // Python validation
  const pythonValid = completed.filter(e => e.pythonValidation?.syntaxValid).length;
  const structValid = completed.filter(e => e.pythonValidation?.structurallyValid).length;

  // Latency
  const latencies = completed.map(e => e.latency || 0).filter(l => l > 0);
  const latencyStats = latencies.length > 0 ? {
    mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    stdDev: computeStdDev(latencies)
  } : null;

  // Tokens
  const tokens = completed.filter(e => e.tokens?.total > 0).map(e => e.tokens.total);
  const tokenStats = tokens.length > 0 ? {
    mean: tokens.reduce((a, b) => a + b, 0) / tokens.length,
    min: Math.min(...tokens),
    max: Math.max(...tokens),
    stdDev: computeStdDev(tokens)
  } : null;

  // Review retention
  const reviewRecall = completed.length > 0
    ? completed.reduce((a, e) => a + (e.reviewRetention?.recall || 0), 0) / completed.length
    : 0;

  return {
    runsEvaluated: evals.length,
    runsCompleted: n,
    evaluation: {
      automaticActions: {
        tp: autoTP, fp: autoFP, fn: autoFN,
        precision: (autoTP + autoFP) > 0 ? autoTP / (autoTP + autoFP) : null,
        recall: (autoTP + autoFN) > 0 ? autoTP / (autoTP + autoFN) : null,
        f1: (autoTP + autoFP) > 0 && (autoTP + autoFN) > 0 ? 2 * autoTP / (2 * autoTP + autoFP + autoFN) : null
      },
      unsafeActions: {
        unsafeActionCount,
        totalProposed,
        unsafeActionRate: totalProposed > 0 ? unsafeActionCount / totalProposed : 0
      },
      citations: {
        exactCount: exactCites,
        alteredCount: alteredCites,
        eligibleCount: totalEligible,
        exactRate: totalEligible > 0 ? exactCites / totalEligible : 0,
        alteredRate: totalEligible > 0 ? alteredCites / totalEligible : 0
      },
      phantoms: {
        totalCount: phantomTotal,
        runsWithPhantoms: phantomRuns,
        rate: completed.length > 0 ? phantomRuns / completed.length : 0
      },
      inventedRules: {
        totalCount: inventedTotal,
        runsWithInvented: inventedRuns,
        rate: completed.length > 0 ? inventedRuns / completed.length : 0
      },
      pythonValidation: {
        syntaxValidRuns: pythonValid,
        structurallyValidRuns: structValid,
        syntaxValidRate: completed.length > 0 ? pythonValid / completed.length : 0
      },
      reviewRetention: {
        recall: reviewRecall
      },
      latencyStats,
      tokenStats
    },
    perRun: evals
  };
}

function computeStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}