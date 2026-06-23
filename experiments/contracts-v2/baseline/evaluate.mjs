/**
 * CLI entry point for the evaluator.
 * Loads runs from disk, evaluates them, and saves summary.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAllRuns, loadFixtures } from './evaluator/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_V2_DIR = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(CONTRACTS_V2_DIR, 'baseline', 'baseline-summary.json');

const fixtures = loadFixtures();
const { runs, summary } = evaluateAllRuns(fixtures);

if (!summary) {
  console.error('No runs found to evaluate.');
  process.exit(1);
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2));

console.log(`Evaluated ${summary.runsEvaluated} runs (${summary.runsCompleted} completed).`);
console.log(`Summary saved to: ${OUTPUT_PATH}`);
console.log('');
console.log('=== KEY METRICS ===');

const ev = summary.evaluation;
console.log(`Automatic TP: ${ev.automaticActions.tp}  FP: ${ev.automaticActions.fp}  FN: ${ev.automaticActions.fn}`);
console.log(`Automatic Precision: ${ev.automaticActions.precision ?? 'N/A'}  Recall: ${ev.automaticActions.recall ?? 'N/A'}  F1: ${ev.automaticActions.f1 ?? 'N/A'}`);
console.log(`Unsafe Action Count: ${ev.unsafeActions.unsafeActionCount} / Total Proposed: ${ev.unsafeActions.totalProposed}`);
console.log(`Unsafe Action Rate: ${ev.unsafeActions.unsafeActionRate.toFixed(4)}`);
console.log(`Exact Citations: ${ev.citations.exactCount}/${ev.citations.eligibleCount} (${(ev.citations.exactRate * 100).toFixed(1)}%)`);
console.log(`Altered Citations: ${ev.citations.alteredCount}/${ev.citations.eligibleCount} (${(ev.citations.alteredRate * 100).toFixed(1)}%)`);
console.log(`Phantom Columns: ${ev.phantoms.totalCount} total (${ev.phantoms.runsWithPhantoms} runs)`);
console.log(`Invented Rules: ${ev.inventedRules.totalCount} total (${ev.inventedRules.runsWithInvented} runs)`);
console.log(`Python Syntax Valid: ${ev.pythonValidation.syntaxValidRuns}/${summary.runsCompleted}`);
console.log(`Structurally Valid: ${ev.pythonValidation.structurallyValidRuns}/${summary.runsCompleted}`);
console.log(`Review Retention Recall: ${(ev.reviewRetention.recall * 100).toFixed(1)}%`);
if (ev.latencyStats) {
  console.log(`Latency: ${ev.latencyStats.mean.toFixed(0)}ms +/- ${ev.latencyStats.stdDev.toFixed(0)}ms`);
}
if (ev.tokenStats) {
  console.log(`Tokens: ${ev.tokenStats.mean.toFixed(0)} +/- ${ev.tokenStats.stdDev.toFixed(0)}`);
}