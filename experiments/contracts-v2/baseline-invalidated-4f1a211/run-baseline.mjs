/**
 * Baseline Runner v3 — Fase 0C
 *
 * Reproduce exactamente el flujo real de AURA:
 * 1. PapaParse identico a produccion (preserva trailing spaces)
 * 2. buildAnalysisPrompt / buildDiagnosisSummaryPrompt / buildScriptPrompt productivos
 * 3. validateCleaningScript productivo
 * 4. Timeout real de 120s por llamada Ollama
 * 5. Seeds fijos [101,202,303,404,505]
 * 6. Tokens reales de Ollama (reported, no estimated)
 * 7. Rutas relativas, SHA completo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Papa = require('papaparse');

// ---- Resolve paths ----
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'experiments/contracts-v2/fixtures');
const BASELINE_DIR = path.join(REPO_ROOT, 'experiments/contracts-v2/baseline');
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
const { buildAnalysisPrompt, buildDiagnosisSummaryPrompt, buildScriptPrompt, extractPythonScript } = await import(path.join(REPO_ROOT, 'src/services/providers/prompts.ts'));
const { validateCleaningScript } = await import(path.join(REPO_ROOT, 'src/services/scriptValidationService.ts'));

// ---- Load/parse CSV identico a produccion ----
const csvContent = fs.readFileSync(DATASET_PATH, 'utf-8');
const parseResult = Papa.parse(csvContent, { header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: '' });
const data = parseResult.data;
const fields = parseResult.meta.fields || [];
const delimiter = parseResult.meta.delimiter || ',';
const auditReport = runAudit(data, fields, delimiter);

// ---- Fixtures ----
const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const metadata = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), 'utf-8'));

// ---- Hashes ----
function simpleHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h &= h; } return Math.abs(h).toString(16); }

// ---- Full git SHA ----
let gitSha = '';
try { const cp = await import('node:child_process'); gitSha = cp.execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch(e) { gitSha = 'unknown'; }

// ---- Ollama version ----
let ollamaVersion = '';
try { const vr = await fetch(`${CONFIG.endpoint}/api/version`); if (vr.ok) { const vd = await vr.json(); ollamaVersion = vd.version; } } catch(e) {}

// ---- Call Ollama with 120s timeout ----
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
    const res = await fetch(`${CONFIG.endpoint}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
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
  } catch(e) { clearTimeout(timeoutId); throw e; }
}

// ---- buildDiagnosisScriptBrief replica del producto ----
function buildDiagnosisScriptBrief(diag) {
  const cleaned = (diag || '').replace(/```[\s\S]*?```/g,'').replace(/[#*_`>-]/g,' ').split('\n').map(l=>l.trim()).filter(Boolean);
  const prio = cleaned.filter(l => /accion|automatizable|revision humana|requiere|columna|riesgo|regla|script/i.test(l)).slice(0,10);
  const src = prio.length > 0 ? prio : cleaned.slice(0,8);
  return src.length > 0 ? src.map(l => `- ${l}`).join('\n') : '- No hay diagnostico operativo disponible.';
}

// ---- Run single execution ----
async function runSingle(runNum, seed) {
  console.log(`\n=== Run ${runNum} (seed=${seed}) ===`);
  const result = { runNumber: runNum, seed, status: 'running', startedAt: new Date().toISOString(), tasks: {} };
  const t = { B1: {}, B1S: {}, B2: {}, B3: {} };
  try {
    // B1 - Diagnosis
    console.log('  [B1] Diagnosis...');
    const diagPrompt = buildAnalysisPrompt(auditReport);
    t.B1.promptHash = simpleHash(diagPrompt);
    const s1 = performance.now();
    const diag = await callOllama(diagPrompt, seed);
    t.B1.durationMs = Math.round(performance.now() - s1);
    t.B1.responseRaw = diag.text; t.B1.metrics = diag.metrics; t.B1.status = 'completed';
    result.tasks.B1 = { taskId: 'B1-diagnosis', promptHash: t.B1.promptHash, responseRaw: diag.text, metrics: diag.metrics, durationMs: t.B1.durationMs, status: 'completed' };
    console.log(`  [B1] Done — ${t.B1.durationMs}ms, tokens=${diag.metrics.tokensGenerated}`);

    // B1-Summary (LLM resume)
    console.log('  [B1-Summary] LLM resume...');
    const sumPrompt = buildDiagnosisSummaryPrompt(diag.text);
    const s1s = performance.now();
    const sum = await callOllama(sumPrompt, seed);
    t.B1S.durationMs = Math.round(performance.now() - s1s);
    const brief = buildDiagnosisScriptBrief(diag.text);
    t.B1S.responseRaw = sum.text; t.B1S.summaryBrief = brief; t.B1S.status = 'completed';
    result.tasks.B1Summary = { taskId: 'B1-summary', responseRaw: sum.text, summaryBrief: brief, durationMs: t.B1S.durationMs, status: 'completed' };
    console.log(`  [B1-Summary] Done — ${t.B1S.durationMs}ms`);

    // B2 - Script
    console.log('  [B2] Script...');
    const scPrompt = buildScriptPrompt(auditReport, diag.text, brief);
    t.B2.promptHash = simpleHash(scPrompt);
    const s2 = performance.now();
    const sc = await callOllama(scPrompt, seed);
    t.B2.durationMs = Math.round(performance.now() - s2);
    const extracted = extractPythonScript(sc.text);
    t.B2.responseRaw = sc.text; t.B2.scriptExtracted = extracted; t.B2.metrics = sc.metrics; t.B2.status = 'completed';
    result.tasks.B2 = { taskId: 'B2-script-generation', promptHash: t.B2.promptHash, responseRaw: sc.text, scriptExtracted: extracted, metrics: sc.metrics, durationMs: t.B2.durationMs, status: 'completed' };
    console.log(`  [B2] Done — ${t.B2.durationMs}ms, tokens=${sc.metrics.tokensGenerated}`);

    // B3 - Validation (determinista, same as production)
    console.log('  [B3] Validate...');
    const s3 = performance.now();
    const val = validateCleaningScript(auditReport, extracted);
    t.B3.durationMs = Math.round(performance.now() - s3);
    result.tasks.B3 = { taskId: 'B3-validation', validationResult: val, durationMs: t.B3.durationMs, status: 'completed' };
    console.log(`  [B3] Done — valid=${val.valid}`);

    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    result.totalDurationMs = Object.values(t).reduce((a,v) => a + (v.durationMs||0), 0);
    result.tokens = { diagnosis: diag.metrics.tokensGenerated, summary: sum.metrics.tokensGenerated, script: sc.metrics.tokensGenerated, total: diag.metrics.tokensGenerated + sum.metrics.tokensGenerated + sc.metrics.tokensGenerated };
    result.tokensSource = diag.metrics.tokensSource;
    result.ollamaVersion = ollamaVersion;
  } catch(e) {
    console.error(`  [ERROR] ${e.message}`);
    result.status = 'attempted_failed'; result.completedAt = new Date().toISOString();
    result.error = { message: e.message, type: e.name };
  }
  return result;
}

// ---- Main ----
async function main() {
  console.log('AURA Contracts v2 — Baseline Runner Fase 0C');
  console.log(`Model: ${CONFIG.model}  Seeds: ${CONFIG.seeds.join(',')}  Timeout: ${CONFIG.timeoutPerCall}ms`);
  console.log(`Dataset SHA: ${metadata.datasetSha256?.substring(0,16)}...  Commit: ${gitSha.substring(0,7)}`);

  // Check Ollama
  try {
    const r = await fetch(`${CONFIG.endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) { console.error('Ollama not available'); process.exit(1); }
    console.log('Ollama available.\n');
  } catch(e) { console.error(`Cannot connect: ${CONFIG.endpoint}`); process.exit(1); }

  const results = [];
  for (let i = 0; i < CONFIG.repetitions; i++) {
    const r = await runSingle(i+1, CONFIG.seeds[i]);
    results.push(r);
    fs.writeFileSync(path.join(RUNS_DIR, `run-${String(i+1).padStart(2,'0')}.json`), JSON.stringify(r, null, 2));
    console.log(`Saved: run-${String(i+1).padStart(2,'0')}.json`);
  }

  const ok = results.filter(r=>r.status==='completed').length;
  const fail = results.filter(r=>r.status==='attempted_failed').length;
  console.log(`\n=== DONE ===  Completed: ${ok}  Failed: ${fail}`);

  if (ok > 0) {
    const avgLat = results.filter(r=>r.status==='completed').reduce((a,r)=>a+r.totalDurationMs,0)/ok;
    const avgTok = results.filter(r=>r.status==='completed').reduce((a,r)=>a+(r.tokens?.total||0),0)/ok;
    console.log(`Avg latency: ${Math.round(avgLat)}ms  Avg tokens: ${Math.round(avgTok)}`);
  }

  fs.writeFileSync(path.join(BASELINE_DIR, 'baseline-execution-summary.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    config: CONFIG,
    datasetSha256: metadata.datasetSha256,
    auditReportSha256: metadata.auditReportSha256,
    gitSha,
    ollamaVersion,
    runs: results.map(r=>({ runNumber:r.runNumber, seed:r.seed, status:r.status, durationMs:r.totalDurationMs, tokens:r.tokens, tokensSource:r.tokensSource, error:r.error?.message })),
    completed: ok, failed: fail
  }, null, 2));
}
main().catch(console.error);
