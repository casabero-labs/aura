/**
 * Baseline Runner v2 - Uses production code with fixed validation
 * 
 * Uses actual production imports:
 * - buildSmartSample, buildAnalysisPrompt, etc. from prompts.ts
 * - validateCleaningScript from scriptValidationService.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Absolute paths
const ROOT_DIR = '/Users/casabero/Documents/GitHub/aura';
const FIXTURES_DIR = path.join(ROOT_DIR, 'experiments/contracts-v2/fixtures');
const BASELINE_DIR = path.join(ROOT_DIR, 'experiments/contracts-v2/baseline');
const RUNS_DIR = path.join(BASELINE_DIR, 'runs');
const DATASET_PATH = path.join(ROOT_DIR, 'experiments/datasets/titanic.csv');

// Configuration
const CONFIG = {
  providerType: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5:3b',
  temperature: 0.1,
  keepAlive: '10m',
  repetitions: 5,
  seeds: [101, 202, 303, 404, 505]
};

const OLLAMA_API_CHAT = `${CONFIG.endpoint}/api/chat`;

// Ensure directories exist
fs.mkdirSync(RUNS_DIR, { recursive: true });

// Import production code using dynamic import with absolute paths
const { runAudit } = await import(path.join(ROOT_DIR, 'src/services/auditEngine.ts'));
const {
  buildSmartSample,
  buildAnalysisPrompt,
  buildDiagnosisSummaryPrompt,
  buildScriptPrompt,
  extractPythonScript
} = await import(path.join(ROOT_DIR, 'src/services/providers/prompts.ts'));
const { validateCleaningScript } = await import(path.join(ROOT_DIR, 'src/services/scriptValidationService.ts'));

// Load fixtures
const auditReport = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), 'utf-8'));
const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const metadata = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), 'utf-8'));

// Simple hash function for prompts
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// SHA-256 hash
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Call Ollama API with real token counting
async function callOllama(prompt, seed = null) {
  const startTime = performance.now();
  let fullText = '';

  const body = {
    model: CONFIG.model,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: CONFIG.temperature },
    keep_alive: CONFIG.keepAlive,
    stream: false
  };

  if (seed !== null) {
    body.options.seed = seed;
  }

  try {
    const response = await fetch(OLLAMA_API_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    fullText = data.message?.content || '';
    const totalTime = performance.now() - startTime;

    // Extract real token counts from Ollama response
    const tokens = {
      promptEvalCount: data.prompt_eval_count || null,
      evalCount: data.eval_count || null,
      promptEvalDuration: data.prompt_eval_duration || null,
      evalDuration: data.eval_duration || null,
      totalDuration: data.total_duration || null,
      loadDuration: data.load_duration || null
    };

    // Determine if we have real token data
    const hasRealTokens = tokens.promptEvalCount !== null && tokens.evalCount !== null;
    const totalTokens = hasRealTokens 
      ? tokens.promptEvalCount + tokens.evalCount 
      : Math.round(fullText.length / 4);

    return {
      text: fullText,
      metrics: {
        provider: 'Ollama',
        model: CONFIG.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(totalTime),
        tokensGenerated: totalTokens,
        isLocal: true,
        timestamp: new Date().toISOString(),
        tokensSource: hasRealTokens ? 'reported' : 'estimated',
        ...tokens
      }
    };
  } catch (error) {
    throw error;
  }
}

// Build diagnosis brief (from prompts.ts)
function buildDiagnosisScriptBrief(diagnosisText) {
  const cleaned = diagnosisText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>-]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const priorityLines = cleaned.filter((line) =>
    /accion|automatizable|revision humana|requiere|columna|riesgo|regla|script/i.test(line)
  ).slice(0, 10);

  const source = priorityLines.length > 0 ? priorityLines : cleaned.slice(0, 8);
  return source.length > 0
    ? source.map((line) => `- ${line}`).join('\n')
    : '- No hay diagnostico operativo disponible.';
}

// Run single execution
async function runSingleExecution(runNumber, seed) {
  console.log(`\n=== Run ${runNumber} (seed=${seed}) ===`);
  const runResult = {
    runNumber,
    seed,
    status: 'running',
    startedAt: new Date().toISOString(),
    tasks: {}
  };

  const timings = { B1: {}, B1Summary: {}, B2: {}, B3: {} };

  try {
    // B1 - Diagnosis using production prompt builder
    console.log(`  [B1] Running diagnosis...`);
    const diagnosisPrompt = buildAnalysisPrompt(auditReport);
    const diagnosisStart = performance.now();
    const diagnosisResponse = await callOllama(diagnosisPrompt, seed);
    const diagnosisEnd = performance.now();

    timings.B1 = {
      prompt: diagnosisPrompt,
      promptHash: simpleHash(diagnosisPrompt),
      responseRaw: diagnosisResponse.text,
      metrics: diagnosisResponse.metrics,
      durationMs: Math.round(diagnosisEnd - diagnosisStart),
      status: 'completed'
    };

    runResult.tasks.B1 = {
      taskId: 'B1-diagnosis',
      promptHash: timings.B1.promptHash,
      responseRaw: diagnosisResponse.text,
      metrics: diagnosisResponse.metrics,
      durationMs: timings.B1.durationMs,
      status: 'completed'
    };

    console.log(`  [B1] Done - ${timings.B1.durationMs}ms, tokens=${diagnosisResponse.metrics.tokensGenerated}`);

    // B1-Summary
    console.log(`  [B1-Summary] Building diagnosis summary...`);
    const summaryPrompt = buildDiagnosisSummaryPrompt(diagnosisResponse.text);
    const summaryStart = performance.now();
    const summaryResponse = await callOllama(summaryPrompt, seed);
    const summaryEnd = performance.now();

    const summaryBrief = buildDiagnosisScriptBrief(diagnosisResponse.text);
    timings.B1Summary = {
      prompt: summaryPrompt,
      responseRaw: summaryResponse.text,
      summaryBrief,
      durationMs: Math.round(summaryEnd - summaryStart),
      status: 'completed'
    };

    runResult.tasks.B1Summary = {
      taskId: 'B1-summary',
      responseRaw: summaryResponse.text,
      summaryBrief,
      durationMs: timings.B1Summary.durationMs,
      status: 'completed'
    };

    console.log(`  [B1-Summary] Done - ${timings.B1Summary.durationMs}ms`);

    // B2 - Script Generation using production prompt builder
    console.log(`  [B2] Generating script...`);
    const scriptPrompt = buildScriptPrompt(auditReport, diagnosisResponse.text, summaryBrief);
    const scriptStart = performance.now();
    const scriptResponse = await callOllama(scriptPrompt, seed);
    const scriptEnd = performance.now();

    timings.B2 = {
      prompt: scriptPrompt,
      promptHash: simpleHash(scriptPrompt),
      responseRaw: scriptResponse.text,
      metrics: scriptResponse.metrics,
      durationMs: Math.round(scriptEnd - scriptStart),
      status: 'completed'
    };

    const extractedScript = extractPythonScript(scriptResponse.text);

    runResult.tasks.B2 = {
      taskId: 'B2-script-generation',
      promptHash: timings.B2.promptHash,
      responseRaw: scriptResponse.text,
      scriptExtracted: extractedScript,
      metrics: scriptResponse.metrics,
      durationMs: timings.B2.durationMs,
      status: 'completed'
    };

    console.log(`  [B2] Done - ${timings.B2.durationMs}ms, tokens=${scriptResponse.metrics.tokensGenerated}`);

    // B3 - Script Validation using production validator
    console.log(`  [B3] Validating script...`);
    const validationStart = performance.now();
    const validationResult = validateCleaningScript(auditReport, extractedScript);
    const validationEnd = performance.now();

    timings.B3 = {
      durationMs: Math.round(validationEnd - validationStart),
      status: 'completed'
    };

    runResult.tasks.B3 = {
      taskId: 'B3-validation',
      validationResult,
      durationMs: timings.B3.durationMs,
      status: 'completed'
    };

    console.log(`  [B3] Done - valid=${validationResult.valid}`);

    // Complete
    runResult.status = 'completed';
    runResult.completedAt = new Date().toISOString();
    runResult.totalDurationMs = Object.values(timings).reduce((sum, t) => sum + (t.durationMs || 0), 0);

    // Calculate total tokens from all tasks
    runResult.tokens = {
      diagnosis: diagnosisResponse.metrics.tokensGenerated,
      summary: summaryResponse.metrics.tokensGenerated,
      script: scriptResponse.metrics.tokensGenerated,
      total: diagnosisResponse.metrics.tokensGenerated + summaryResponse.metrics.tokensGenerated + scriptResponse.metrics.tokensGenerated
    };
    runResult.tokensSource = diagnosisResponse.metrics.tokensSource;

    // Get Ollama version
    try {
      const versionResponse = await fetch(`${CONFIG.endpoint}/api/version`);
      if (versionResponse.ok) {
        const versionData = await versionResponse.json();
        runResult.ollamaVersion = versionData.version;
      }
    } catch {
      // ignore
    }

  } catch (error) {
    console.error(`  [ERROR] ${error.message}`);
    runResult.status = 'attempted_failed';
    runResult.completedAt = new Date().toISOString();
    runResult.error = {
      message: error.message,
      type: error.name
    };
  }

  return runResult;
}

// Main execution
async function main() {
  console.log('AURA Contracts v2 - Baseline Runner v2');
  console.log('===================================');
  console.log(`Provider: ${CONFIG.providerType}`);
  console.log(`Endpoint: ${CONFIG.endpoint}`);
  console.log(`Model: ${CONFIG.model}`);
  console.log(`Temperature: ${CONFIG.temperature}`);
  console.log(`Seeds: ${CONFIG.seeds.join(', ')}`);
  console.log('');

  // Check Ollama availability
  console.log('Checking Ollama availability...');
  try {
    const response = await fetch(`${CONFIG.endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      console.error(`Ollama not available: ${response.status}`);
      process.exit(1);
    }
    console.log('Ollama is available.\n');
  } catch (error) {
    console.error(`Cannot connect to Ollama at ${CONFIG.endpoint}`);
    process.exit(1);
  }

  const results = [];

  // Run repetitions with seeds
  for (let i = 0; i < CONFIG.repetitions; i++) {
    const result = await runSingleExecution(i + 1, CONFIG.seeds[i]);
    results.push(result);

    // Save intermediate result
    const runFile = path.join(RUNS_DIR, `run-${String(i + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(runFile, JSON.stringify(result, null, 2));
    console.log(`Saved: ${runFile}`);
  }

  // Summary
  console.log('\n===================================');
  console.log('BASELINE RUN COMPLETE');
  console.log('===================================');

  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'attempted_failed').length;

  console.log(`Total runs: ${results.length}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);

  if (completed > 0) {
    const avgLatency = results
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + r.totalDurationMs, 0) / completed;
    console.log(`Average total latency: ${Math.round(avgLatency)}ms`);

    const avgTokens = results
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + r.tokens.total, 0) / completed;
    console.log(`Average total tokens: ${Math.round(avgTokens)}`);
  }

  // Save execution summary
  const summary = {
    generatedAt: new Date().toISOString(),
    config: {
      providerType: CONFIG.providerType,
      endpoint: CONFIG.endpoint,
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      seeds: CONFIG.seeds
    },
    datasetSha256: metadata.datasetSha256,
    auditReportSha256: metadata.auditReportSha256,
    groundTruthVersion: groundTruth.version,
    runs: results.map(r => ({
      runNumber: r.runNumber,
      seed: r.seed,
      status: r.status,
      durationMs: r.totalDurationMs,
      tokens: r.tokens,
      tokensSource: r.tokensSource,
      error: r.error?.message
    })),
    completed,
    failed
  };

  fs.writeFileSync(path.join(BASELINE_DIR, 'baseline-execution-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nExecution summary saved to: baseline-execution-summary.json`);

  return { results, summary };
}

main().catch(console.error);
