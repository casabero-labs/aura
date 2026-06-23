/**
 * Baseline Runner - Executes 5 repetitions of the AURA contract evaluation
 * 
 * This script runs the full pipeline (B1-B4) using the current production prompts
 * and captures all responses for baseline comparison with future Contratos v2.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  providerType: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5:3b',
  temperature: 0.1,
  keepAlive: '10m',
  repetitions: 5,
  timeout: 120000
};

const OLLAMA_API_CHAT = `${CONFIG.endpoint}/api/chat`;
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const BASELINE_DIR = path.join(__dirname, '../baseline');
const RUNS_DIR = path.join(BASELINE_DIR, 'runs');
const PROMPTS_DIR = path.join(BASELINE_DIR, 'prompts');

// Ensure directories exist
fs.mkdirSync(RUNS_DIR, { recursive: true });

// Load fixtures
const auditReport = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), 'utf-8'));
const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Build smart sample (same as prompts.ts)
function buildSmartSample(report) {
  return {
    context: {
      total_rows: report.rowCount,
      total_columns: report.colCount,
      detected_delimiter: report.delimiterDetected,
      quality_score: report.score
    },
    columns: Object.values(report.columnStats).map(c => ({
      name: c.name,
      type: c.inferredType,
      nulls: c.nullCount,
      unique: c.uniqueCount,
      top_values: c.topFreq?.map(t => t.value),
      sample_values: c.sampleValues
    })),
    detected_issues: report.issues.map(i => ({
      rule: i.ruleName,
      category: i.category,
      column: i.column,
      details: i.description,
      bad_samples: i.sampleValues.slice(0, 3)
    }))
  };
}

// Build diagnosis prompt (same as prompts.ts)
function buildDiagnosisPrompt(report) {
  const jsonSummary = buildSmartSample(report);
  const json_data = JSON.stringify(jsonSummary, null, 2);
  return `Actua como revisor tecnico de calidad de datos. Explica la evidencia disponible de forma reproducible.

Objetivo: Diagnosticar causas probables y producir una salida lista para generar un script Python/Pandas de limpieza asistida.

Recibiras un resumen JSON del motor determinista de AURA con columnas observadas, tipos inferidos y reglas activadas. No tienes acceso al CSV completo.

JSON observado:
${json_data}

Reglas de honestidad:
- No inventes columnas, valores, relaciones ni causas.
- Cita la regla determinista, la columna y la evidencia disponible.
- Si haces una inferencia de dominio, etiquetala como "Hipotesis no validada".
- No generes script Python en esta respuesta.

Formato:
## Estado de ejecucion
## Hallazgos respaldados por evidencia
## Hipotesis no validadas
## Acciones recomendadas
## Limites de la respuesta

Responde en espanol, tono sobrio y verificable.`;
}

// Build diagnosis summary prompt (same as prompts.ts)
function buildDiagnosisSummaryPrompt(diagnosisText) {
  return `Resume el siguiente diagnostico de calidad de datos para alimentar un generador de script Python/Pandas.

No agregues problemas nuevos. No inventes columnas. Extrae solo decisiones operativas utiles para script.

Formato obligatorio:
## Resumen operativo para script
- Problemas priorizados:
- Acciones automatizables:
- Acciones que requieren HITL:
- Columnas que NO deben modificarse automaticamente:
- Riesgos del script:

Diagnostico:
${diagnosisText}`;
}

// Build diagnosis brief (same as prompts.ts)
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

// Build script prompt (same as prompts.ts)
function buildScriptPrompt(report, diagnosisText, diagnosisBrief) {
  const jsonSummary = buildSmartSample(report);
  return `
Actua como ingeniero de datos senior. Debes generar un script Python/Pandas de limpieza asistida para AURA usando SOLO:
1. El paquete estructurado del motor determinista.
2. El diagnostico previo del LLM.

No hagas un nuevo diagnostico. No inventes columnas. No agregues librerias innecesarias. No elimines columnas automaticamente. Todo cambio ambiguo debe quedar comentado como HITL.

Contrato cognitivo:
- Capa 2 con anclaje semantico: el script debe estar anclado a reglas, columnas y muestras observadas.
- M4 Copy-Paste: copia nombres de columnas exactamente como aparecen en el paquete.
- Paradigma copy-paste: cada bloque del script debe incluir comentario con regla fuente y columna fuente.
- Privacidad local-first: el script trabaja sobre un dataframe df ya cargado; no lee rutas externas ni envia datos a red.
- Objetivo del diagnostico usado: Diagnosticar causas probables y producir una salida lista para generar un script Python/Pandas de limpieza asistida.

Paquete estructurado:
${JSON.stringify(jsonSummary, null, 2)}

Resumen operativo del diagnostico para script:
${diagnosisBrief || buildDiagnosisScriptBrief(diagnosisText)}

Diagnostico previo:
${diagnosisText || 'No hay diagnostico previo disponible.'}

Formato obligatorio de salida:
Devuelve solo un bloque de codigo Python. El script debe:
- importar pandas y numpy;
- definir una funcion clean_dataset(df: pd.DataFrame) -> pd.DataFrame;
- crear df_clean = df.copy();
- aplicar solo operaciones trazables a columnas existentes;
- conservar comentarios # AURA: regla=... columna=...;
- no ejecutar archivos, no leer CSV, no escribir disco;
- terminar con return df_clean.
`;
}

// Extract Python script from response
function extractPythonScript(text) {
  const fenced = text.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('import ');
  return (start >= 0 ? candidate.slice(start) : candidate).trim();
}

// Validate cleaning script (simplified from scriptValidationService.ts)
function validateCleaningScript(script, report) {
  const DESTRUCTIVE_PATTERNS = [
    { pattern: /\.drop\s*\(/i, label: 'drop' },
    { pattern: /dropna\s*\(/i, label: 'dropna' },
    { pattern: /drop_duplicates\s*\(/i, label: 'drop_duplicates' },
    { pattern: /del\s+df\[/i, label: 'delete_column' },
    { pattern: /inplace\s*=\s*True/i, label: 'inplace_mutation' },
  ];

  const hasScript = Boolean(script?.trim());
  if (!hasScript) {
    return {
      valid: false,
      hasScript: false,
      invalidColumns: [],
      destructiveOperations: [],
      coveredIssueIds: [],
      uncoveredIssueIds: report.issues.map(i => i.id),
      coveragePercentage: 0,
      safetyScore: 0,
      scriptOrigin: 'model',
      hasPandasImport: false,
      requiresHumanReview: true,
      warnings: ['No se genero script Python/Pandas.']
    };
  }

  const scriptText = script || '';
  const validColumns = Object.keys(report.columnStats);
  const invalidColumns = validColumns.filter(col => {
    const regex = new RegExp(`['"\`]${col}['"\`]`, 'i');
    return !regex.test(scriptText) && !scriptText.includes(col);
  });

  const destructiveOperations = DESTRUCTIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(scriptText))
    .map(({ label }) => label);

  const hasPandasImport = scriptText.includes('import pandas') || scriptText.includes('pd.');

  const coveredIssueIds = report.issues
    .filter(issue => {
      if (!issue.column) return false;
      const colRegex = new RegExp(`['"\`]${issue.column}['"\`]`, 'i');
      const ruleRegex = new RegExp(issue.ruleName, 'i');
      return colRegex.test(scriptText) || ruleRegex.test(scriptText);
    })
    .map(issue => issue.id);

  const coveragePercentage = report.issues.length > 0
    ? Math.round((coveredIssueIds.length / report.issues.length) * 100)
    : 100;

  const columnScore = invalidColumns.length === 0 ? 30 : Math.max(0, 30 - invalidColumns.length * 10);
  const coverageScore = report.issues.length > 0
    ? Math.round((coveredIssueIds.length / report.issues.length) * 30)
    : 30;
  const destructiveScore = destructiveOperations.length === 0 ? 25 : Math.max(0, 25 - destructiveOperations.length * 10);
  const pandasScore = hasPandasImport ? 15 : 0;
  const safetyScore = Math.max(0, Math.min(100, columnScore + coverageScore + destructiveScore + pandasScore));

  return {
    valid: invalidColumns.length === 0 && coveredIssueIds.length > 0 && destructiveOperations.length === 0,
    hasScript: true,
    invalidColumns,
    destructiveOperations,
    coveredIssueIds,
    uncoveredIssueIds: report.issues.filter(i => !coveredIssueIds.includes(i.id)).map(i => i.id),
    coveragePercentage,
    safetyScore,
    scriptOrigin: 'model',
    hasPandasImport,
    requiresHumanReview: destructiveOperations.length > 0 || safetyScore < 60,
    warnings: [
      ...(!hasPandasImport ? ['El script no evidencia uso de Pandas.'] : []),
      ...(destructiveOperations.length > 0 ? ['El script contiene operaciones destructivas o mutaciones directas.'] : []),
      ...(invalidColumns.length > 0 ? ['El script referencia columnas que no existen en el AuditReport.'] : []),
    ]
  };
}

// Call Ollama API
async function callOllama(prompt, timeout = CONFIG.timeout) {
  const startTime = performance.now();
  let fullText = '';
  let firstTokenTime = 0;

  try {
    const response = await fetch(OLLAMA_API_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature: CONFIG.temperature },
        keep_alive: CONFIG.keepAlive,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    fullText = data.message?.content || '';
    const totalTime = performance.now() - startTime;

    return {
      text: fullText,
      metrics: {
        provider: 'Ollama',
        model: CONFIG.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(totalTime),
        tokensGenerated: Math.round(fullText.length / 4),
        isLocal: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    throw error;
  }
}

// Run single execution
async function runSingleExecution(runNumber) {
  console.log(`\n=== Run ${runNumber} ===`);
  const runResult = {
    runNumber,
    status: 'running',
    startedAt: new Date().toISOString(),
    tasks: {}
  };

  const timings = {
    B1: {},
    B2: {},
    B3: {}
  };

  try {
    // B1 - Diagnosis
    console.log(`  [B1] Running diagnosis...`);
    const diagnosisPrompt = buildDiagnosisPrompt(auditReport);
    const diagnosisStart = performance.now();
    const diagnosisResponse = await callOllama(diagnosisPrompt);
    const diagnosisEnd = performance.now();
    
    timings.B1.prompt = diagnosisPrompt;
    timings.B1.promptHash = simpleHash(diagnosisPrompt);
    timings.B1.responseRaw = diagnosisResponse.text;
    timings.B1.metrics = diagnosisResponse.metrics;
    timings.B1.durationMs = Math.round(diagnosisEnd - diagnosisStart);
    timings.B1.status = 'completed';

    runResult.tasks.B1 = {
      taskId: 'B1-diagnosis',
      promptHash: timings.B1.promptHash,
      responseRaw: diagnosisResponse.text,
      metrics: diagnosisResponse.metrics,
      durationMs: timings.B1.durationMs,
      status: 'completed'
    };

    console.log(`  [B1] Done - ${timings.B1.durationMs}ms`);

    // B1-Summary - Diagnosis summary
    console.log(`  [B1-Summary] Building diagnosis summary...`);
    const summaryPrompt = buildDiagnosisSummaryPrompt(diagnosisResponse.text);
    const summaryStart = performance.now();
    const summaryResponse = await callOllama(summaryPrompt);
    const summaryEnd = performance.now();

    const summaryBrief = buildDiagnosisScriptBrief(diagnosisResponse.text);
    timings.B1.summaryPrompt = summaryPrompt;
    timings.B1.summaryResponseRaw = summaryResponse.text;
    timings.B1.summaryDurationMs = Math.round(summaryEnd - summaryStart);

    runResult.tasks['B1-Summary'] = {
      taskId: 'B1-summary',
      responseRaw: summaryResponse.text,
      summaryBrief,
      durationMs: timings.B1.summaryDurationMs,
      status: 'completed'
    };

    console.log(`  [B1-Summary] Done - ${timings.B1.summaryDurationMs}ms`);

    // B2 - Script Generation
    console.log(`  [B2] Generating script...`);
    const scriptPrompt = buildScriptPrompt(auditReport, diagnosisResponse.text, summaryBrief);
    const scriptStart = performance.now();
    const scriptResponse = await callOllama(scriptPrompt);
    const scriptEnd = performance.now();

    timings.B2.prompt = scriptPrompt;
    timings.B2.promptHash = simpleHash(scriptPrompt);
    timings.B2.responseRaw = scriptResponse.text;
    timings.B2.metrics = scriptResponse.metrics;
    timings.B2.durationMs = Math.round(scriptEnd - scriptStart);
    timings.B2.status = 'completed';

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

    console.log(`  [B2] Done - ${timings.B2.durationMs}ms`);

    // B3 - Script Validation
    console.log(`  [B3] Validating script...`);
    const validationStart = performance.now();
    const validationResult = validateCleaningScript(extractedScript, auditReport);
    const validationEnd = performance.now();

    timings.B3.durationMs = Math.round(validationEnd - validationStart);
    timings.B3.status = 'completed';

    runResult.tasks.B3 = {
      taskId: 'B3-validation',
      validationResult,
      durationMs: timings.B3.durationMs,
      status: 'completed'
    };

    console.log(`  [B3] Done - validation result: valid=${validationResult.valid}`);

    // Complete
    runResult.status = 'completed';
    runResult.completedAt = new Date().toISOString();
    runResult.totalDurationMs = Object.values(timings).reduce((sum, t) => sum + (t.durationMs || 0), 0);

    // Add Ollama version if available (don't fail if not)
    try {
      const versionResponse = await fetch(`${CONFIG.endpoint}/api/version`);
      if (versionResponse.ok) {
        const versionData = await versionResponse.json();
        runResult.ollamaVersion = versionData.version;
      }
    } catch {
      // Ollama version endpoint may not be available
    }

    runResult.tokens = {
      diagnosis: diagnosisResponse.metrics.tokensGenerated,
      summary: summaryResponse.metrics.tokensGenerated,
      script: scriptResponse.metrics.tokensGenerated,
      total: diagnosisResponse.metrics.tokensGenerated + summaryResponse.metrics.tokensGenerated + scriptResponse.metrics.tokensGenerated
    };
    runResult.tokensSource = 'estimated';

  } catch (error) {
    console.error(`  [ERROR] ${error.message}`);
    runResult.status = 'attempted_failed';
    runResult.completedAt = new Date().toISOString();
    runResult.error = {
      message: error.message,
      type: error.name,
      stack: error.stack
    };
  }

  return runResult;
}

// Main execution
async function main() {
  console.log('AURA Contracts v2 - Baseline Runner');
  console.log('===================================');
  console.log(`Provider: ${CONFIG.providerType}`);
  console.log(`Endpoint: ${CONFIG.endpoint}`);
  console.log(`Model: ${CONFIG.model}`);
  console.log(`Temperature: ${CONFIG.temperature}`);
  console.log(`Repetitions: ${CONFIG.repetitions}`);
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
    console.error('Make sure Ollama is running with: ollama serve');
    process.exit(1);
  }

  const results = [];

  // Run repetitions
  for (let i = 1; i <= CONFIG.repetitions; i++) {
    const result = await runSingleExecution(i);
    results.push(result);

    // Save intermediate result
    const runFile = path.join(RUNS_DIR, `run-${String(i).padStart(2, '0')}.json`);
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

  // Save summary
  const summary = {
    generatedAt: new Date().toISOString(),
    config: CONFIG,
    runs: results.map(r => ({
      runNumber: r.runNumber,
      status: r.status,
      durationMs: r.totalDurationMs,
      tokens: r.tokens,
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
