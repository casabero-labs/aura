/**
 * Baseline Runner v4 — Fase 0D
 *
 * Equivalente exacto al flujo real de AURA:
 * 1. buildDiagnosisScriptBrief (fallback determinista)
 * 2. buildDiagnosisSummaryPrompt → summary.text.trim() si es truthy
 * 3. buildScriptPrompt con operativeBrief
 * 4. validateCleaningScript (productivo)
 *
 * Sin rutas absolutas. SHA completo. Seeds fijos. Timeout real 120s.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Papa = require('papaparse');

// ---- Resolve paths ----
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = SCRIPT_DIR;
const CONTRACTS_V2_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(CONTRACTS_V2_DIR, '..', '..');
const FIXTURES_DIR = path.join(CONTRACTS_V2_DIR, 'fixtures');
const RUNS_DIR = path.join(BASELINE_DIR, 'runs');
const DATASET_PATH = path.join(REPO_ROOT, 'experiments/datasets/titanic.csv');

// ---- Config ----
const CONFIG = {
  providerType: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5:3b',
  temperature: 0.1,
  keepAlive: '10m',
  repetitions: 5,
  seeds: [101, 202, 303, 404, 505],
  timeoutPerCall: 120000
};

fs.mkdirSync(RUNS_DIR, { recursive: true });

// ---- Production imports ----
const { runAudit } = await import(path.join(REPO_ROOT, 'src/services/auditEngine.ts'));
const {
  buildAnalysisPrompt,
  buildDiagnosisSummaryPrompt,
  buildScriptPrompt,
  buildDiagnosisScriptBrief,
  extractPythonScript
} = await import(path.join(REPO_ROOT, 'src/services/providers/prompts.ts'));
const { validateCleaningScript } = await import(path.join(REPO_ROOT, 'src/services/scriptValidationService.ts'));

// ---- Load fixtures ----
const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const metadata = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), 'utf-8'));

// ---- Parse CSV identically to production ----
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
const auditReport = runAudit(data, fields, delimiter);

// ---- Helpers ----
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h &= h;
  }
  return Math.abs(h).toString(16);
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ---- Full git SHA ----
let gitSha = '';
try {
  const cp = await import('node:child_process');
  gitSha = cp.execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch {
  gitSha = 'unknown';
}

// ---- Ollama version ----
let ollamaVersion = '';
try {
  const r = await fetch(`${CONFIG.endpoint}/api/version`);
  if (r.ok) {
    const d = await r.json();
    ollamaVersion = d.version;
  }
} catch {}

// ---- Call Ollama with real 120s timeout ----
async function callOllama(prompt, seed) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeoutPerCall);
  const startTime = performance.now();
  const body = {
    model: CONFIG.model,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: CONFIG.temperature },
    keep_alive: CONFIG.keepAlive,
    stream: false
  };
  if (seed != null) body.options.seed = seed;

  try {
    const res = await fetch(`${CONFIG.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const d = await res.json();
    const text = d.message?.content || '';
    const totalTime = performance.now() - startTime;
    const realTokens = d.prompt_eval_count !== undefined && d.eval_count !== undefined;
    return {
      text,
      metrics: {
        provider: 'Ollama', model: CONFIG.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(totalTime),
        tokensGenerated: realTokens ? d.prompt_eval_count + d.eval_count : Math.round(text.length / 4),
        isLocal: true, timestamp: new Date().toISOString(),
        tokensSource: realTokens ? 'reported' : 'estimated',
        promptEvalCount: d.prompt_eval_count, evalCount: d.eval_count,
        promptEvalDuration: d.prompt_eval_duration, evalDuration: d.eval_duration,
        totalDuration: d.total_duration, loadDuration: d.load_duration
      }
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// ---- Run single execution — equivalent to ScriptGenerationStep.generateScript ----
async function runSingle(runNum, seed) {
  console.log(`\n=== Run ${runNum} (seed=${seed}) ===`);
  const result = {
    runNumber: runNum,
    seed,
    status: 'running',
    startedAt: new Date().toISOString(),
    tasks: {}
  };
  const t = { B1: {}, B1S: {}, B2: {}, B3: {} };

  try {
    // ── B1: Diagnosis ──
    console.log('  [B1] Diagnosis...');
    const diagPrompt = buildAnalysisPrompt(auditReport);
    t.B1.promptHash = simpleHash(diagPrompt);
    const s1 = performance.now();
    const diag = await callOllama(diagPrompt, seed);
    t.B1.durationMs = Math.round(performance.now() - s1);
    t.B1.responseRaw = diag.text;
    t.B1.metrics = diag.metrics;
    result.tasks.B1 = {
      taskId: 'B1-diagnosis',
      promptHash: t.B1.promptHash,
      responseRaw: diag.text,
      metrics: diag.metrics,
      durationMs: t.B1.durationMs,
      status: 'completed'
    };
    console.log(`  [B1] Done — ${t.B1.durationMs}ms, tokens=${diag.metrics.tokensGenerated}`);

    // ── Summary: buildDiagnosisSummaryPrompt → operativeBrief ──
    // Equivalent to ScriptGenerationStep.generateScript lines 71-81:
    //   let operativeBrief = buildDiagnosisScriptBrief(diagnosisText);
    //   try { summary = await generateText(buildDiagnosisSummaryPrompt(diag));
    //         if (summary.text.trim()) operativeBrief = summary.text.trim(); }
    //   catch { keep fallback }
    console.log('  [B1Summary] LLM summary → operativeBrief...');
    let operativeBrief = buildDiagnosisScriptBrief(diag.text);
    let summaryText = '';
    let summaryUsed = false;
    let summaryError = null;
    try {
      const sumPrompt = buildDiagnosisSummaryPrompt(diag.text);
      const s1s = performance.now();
      const sum = await callOllama(sumPrompt, seed);
      t.B1S.durationMs = Math.round(performance.now() - s1s);
      summaryText = sum.text;
      t.B1S.metrics = sum.metrics;
      const trimmed = sum.text.trim();
      if (trimmed) {
        operativeBrief = trimmed;
        summaryUsed = true;
      }
    } catch (e) {
      summaryError = e.message;
    }

    t.B1S.responseRaw = summaryText;
    t.B1S.operativeBriefUsed = summaryUsed;
    t.B1S.operativeBrief = operativeBrief;
    t.B1S.operativeBriefHash = simpleHash(operativeBrief);
    t.B1S.error = summaryError;
    result.tasks.B1Summary = {
      taskId: 'B1-summary',
      responseRaw: summaryText,
      operativeBrief,
      operativeBriefUsed: summaryUsed,
      operativeBriefHash: simpleHash(operativeBrief),
      durationMs: t.B1S.durationMs || 0,
      metrics: t.B1S.metrics,
      error: summaryError,
      status: summaryError ? 'fallback' : 'completed'
    };
    console.log(`  [B1Summary] ${summaryUsed ? 'LLM summary used' : 'fallback brief used'} — ${t.B1S.durationMs || 0}ms`);

    // ── B2: Script ──
    console.log('  [B2] Script...');
    const scPrompt = buildScriptPrompt(auditReport, diag.text, operativeBrief);
    t.B2.promptHash = simpleHash(scPrompt);
    const s2 = performance.now();
    const sc = await callOllama(scPrompt, seed);
    t.B2.durationMs = Math.round(performance.now() - s2);
    const extracted = extractPythonScript(sc.text);
    t.B2.responseRaw = sc.text;
    t.B2.scriptExtracted = extracted;
    t.B2.metrics = sc.metrics;
    result.tasks.B2 = {
      taskId: 'B2-script-generation',
      promptHash: t.B2.promptHash,
      responseRaw: sc.text,
      scriptExtracted: extracted,
      metrics: sc.metrics,
      durationMs: t.B2.durationMs,
      status: 'completed'
    };
    console.log(`  [B2] Done — ${t.B2.durationMs}ms, tokens=${sc.metrics.tokensGenerated}`);

    // ── B3: Validation (deterministic, production) ──
    console.log('  [B3] Validate...');
    const s3 = performance.now();
    const val = validateCleaningScript(auditReport, extracted);
    t.B3.durationMs = Math.round(performance.now() - s3);
    result.tasks.B3 = {
      taskId: 'B3-validation',
      validationResult: val,
      durationMs: t.B3.durationMs,
      status: 'completed'
    };
    console.log(`  [B3] valid=${val.valid}`);

    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    result.totalDurationMs = Object.values(t).reduce((a, v) => a + (v.durationMs || 0), 0);
    result.tokens = {
      diagnosis: diag.metrics.tokensGenerated,
      summary: t.B1S.metrics?.tokensGenerated || 0,
      script: sc.metrics.tokensGenerated,
      total: (diag.metrics.tokensGenerated || 0) + (t.B1S.metrics?.tokensGenerated || 0) + (sc.metrics.tokensGenerated || 0)
    };
    result.tokensSource = diag.metrics.tokensSource;
    result.ollamaVersion = ollamaVersion;
  } catch (e) {
    console.error(`  [ERROR] ${e.message}`);
    result.status = 'attempted_failed';
    result.completedAt = new Date().toISOString();
    result.error = { message: e.message, type: e.name };
  }
  return result;
}

// ---- Main ----
async function main() {
  console.log('AURA Contracts v2 — Baseline Runner Fase 0D');
  console.log(`Model: ${CONFIG.model}  Seeds: ${CONFIG.seeds.join(',')}  Timeout: ${CONFIG.timeoutPerCall}ms`);
  console.log(`Dataset SHA: ${metadata.datasetSha256?.substring(0, 16)}...`);
  console.log(`Commit: ${gitSha.substring(0, 7)}`);

  // Check Ollama
  try {
    const r = await fetch(`${CONFIG.endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      console.error('Ollama not available');
      process.exit(1);
    }
    console.log('Ollama available.\n');
  } catch (e) {
    console.error(`Cannot connect to Ollama at ${CONFIG.endpoint}`);
    process.exit(1);
  }

  const results = [];
  for (let i = 0; i < CONFIG.repetitions; i++) {
    const r = await runSingle(i + 1, CONFIG.seeds[i]);
    results.push(r);
    const runFile = path.join(RUNS_DIR, `run-${String(i + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(runFile, JSON.stringify(r, null, 2));
    console.log(`Saved: ${path.basename(runFile)}`);
  }

  const ok = results.filter(r => r.status === 'completed').length;
  const fail = results.filter(r => r.status === 'attempted_failed').length;
  console.log(`\n=== DONE ===  Completed: ${ok}  Failed: ${fail}`);

  if (ok > 0) {
    const avgLat = results.filter(r => r.status === 'completed').reduce((a, r) => a + r.totalDurationMs, 0) / ok;
    const avgTok = results.filter(r => r.status === 'completed').reduce((a, r) => a + (r.tokens?.total || 0), 0) / ok;
    console.log(`Avg latency: ${Math.round(avgLat)}ms  Avg tokens: ${Math.round(avgTok)}`);
  }

  // Execution summary with SHA
  const summaryText = JSON.stringify({ config: CONFIG, results });
  const executionSha = sha256(summaryText);
  const executionSummary = {
    generatedAt: new Date().toISOString(),
    config: CONFIG,
    datasetSha256: metadata.datasetSha256,
    auditReportSha256: metadata.auditReportSha256,
    gitSha,
    ollamaVersion,
    executionSha256: executionSha,
    datasetPath: 'experiments/datasets/titanic.csv',
    runs: results.map(r => ({
      runNumber: r.runNumber,
      seed: r.seed,
      status: r.status,
      durationMs: r.totalDurationMs,
      tokens: r.tokens,
      tokensSource: r.tokensSource,
      summaryUsed: r.tasks?.B1Summary?.operativeBriefUsed,
      error: r.error?.message
    })),
    completed: ok,
    failed: fail
  };

  fs.writeFileSync(
    path.join(BASELINE_DIR, 'baseline-execution-summary.json'),
    JSON.stringify(executionSummary, null, 2)
  );

  // Protocol with full SHA
  const protocol = {
    protocolVersion: '2.0.0',
    gitSha,
    dataset: {
      path: 'experiments/datasets/titanic.csv',
      sha256: metadata.datasetSha256
    },
    auditReport: {
      path: 'experiments/contracts-v2/fixtures/titanic-audit-report.json',
      sha256: metadata.auditReportSha256
    },
    seeds: CONFIG.seeds,
    repetitions: CONFIG.repetitions,
    timeoutMs: CONFIG.timeoutPerCall,
    model: CONFIG.model,
    temperature: CONFIG.temperature
  };
  fs.writeFileSync(
    path.join(BASELINE_DIR, 'protocol.json'),
    JSON.stringify(protocol, null, 2)
  );

  console.log(`\nExecution summary saved. Execution SHA: ${executionSha.substring(0, 16)}...`);
}

main().catch(console.error);