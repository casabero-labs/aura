import { describe, expect, it } from 'vitest';
import { runAudit } from '../services/auditEngine';
import { detectHallucinations } from '../services/benchmark/hallucinationDetector';
import { deriveEvidenceStatus, createImprovementRun } from '../services/improvementService';
import { simulateRemediation, buildDeterministicRemediationActions } from '../services/remediationSimulator';
import { validateCleaningScript } from '../services/scriptValidationService';
import { buildDeterministicCleaningScript } from '../services/deterministicScriptBuilder';
import { AuditReport, BenchmarkResult, ScriptValidationResult } from '../types';

const makeScriptValidation = (overrides: Partial<ScriptValidationResult> = {}): ScriptValidationResult => ({
  valid: true,
  hasScript: true,
  invalidColumns: [],
  destructiveOperations: [],
  coveredIssueIds: ['a'],
  uncoveredIssueIds: [],
  coveragePercentage: 100,
  safetyScore: 85,
  scriptOrigin: 'model',
  hasPandasImport: true,
  requiresHumanReview: false,
  warnings: [],
  ...overrides,
});

const baseData = [
  { id: 1, name: ' Alice  ', status: 'N/A', amount: '10' },
  { id: 1, name: ' Alice  ', status: 'N/A', amount: '10' },
  { id: 2, name: 'bob', status: 'ok', amount: '20' },
  { id: 3, name: 'BOB', status: 'null', amount: '30' },
  { id: 4, name: 'Carol', status: 'ok', amount: '40' },
  { id: 5, name: ' carol ', status: '?', amount: '50' },
  { id: 6, name: 'Dana', status: 'ok', amount: '60' },
  { id: 7, name: 'Eli', status: 'ok', amount: '70' },
  { id: 8, name: 'Fran', status: 'ok', amount: '80' },
  { id: 9, name: 'Gus', status: 'ok', amount: '90' },
  { id: 10, name: 'Hana', status: 'ok', amount: '100' },
  { id: 11, name: 'Ian', status: 'ok', amount: '110' },
];

const fields = ['id', 'name', 'status', 'amount'];

const makeBenchmarkResult = (report: AuditReport, overrides: Partial<BenchmarkResult> = {}): BenchmarkResult => ({
  id: 'bench-1',
  provider: 'WebLLM',
  providerType: 'local',
  inputMode: 'smart_sample',
  model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  temperature: 0.1,
  status: 'completed',
  latencyMs: 1000,
  firstTokenMs: 300,
  tokensGenerated: 120,
  tokensPerSecond: 120,
  formatCompliance: true,
  pythonScriptIncluded: true,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'preliminary_valid',
  scriptValidation: validateCleaningScript(report, "import pandas as pd\ndf['name'] = df['name'].str.strip()"),
  timestamp: '2026-05-18T00:00:00.000Z',
  ...overrides,
});

describe('Evidence-guided improvement loop', () => {
  it('marks unavailable benchmark runs as attempted_failed evidence', () => {
    const status = deriveEvidenceStatus({
      status: 'unavailable',
      inputMode: 'smart_sample',
      formatCompliance: false,
      hallucinatedColumns: [],
      scriptValidation: undefined,
    });

    expect(status).toBe('attempted_failed');
  });

  it('marks prompt_libre runs as preliminary_valid at best', () => {
    const status = deriveEvidenceStatus({
      status: 'completed',
      inputMode: 'prompt_libre',
      formatCompliance: true,
      hallucinatedColumns: [],
      scriptValidation: undefined,
    });

    expect(status).toBe('preliminary_valid');
  });

  it('marks smart_sample runs with ground truth as formal_valid when all checks pass', () => {
    const status = deriveEvidenceStatus(
      {
        status: 'completed',
        inputMode: 'smart_sample',
        formatCompliance: true,
        hallucinatedColumns: [],
        scriptValidation: makeScriptValidation({ coveredIssueIds: ['a'] }),
      },
      true // hasGroundTruthMatch
    );

    expect(status).toBe('formal_valid');
  });

  it('marks smart_sample runs without ground truth as preliminary_valid when checks pass', () => {
    const status = deriveEvidenceStatus(
      {
        status: 'completed',
        inputMode: 'smart_sample',
        formatCompliance: true,
        hallucinatedColumns: [],
        scriptValidation: makeScriptValidation({ coveredIssueIds: ['a'] }),
      },
      false // no ground truth
    );

    expect(status).toBe('preliminary_valid');
  });

  it('marks smart_sample with hallucinations as attempted_failed even with ground truth', () => {
    const status = deriveEvidenceStatus(
      {
        status: 'completed',
        inputMode: 'smart_sample',
        formatCompliance: true,
        hallucinatedColumns: ['phantom_col'],
        scriptValidation: makeScriptValidation({ coveredIssueIds: ['a'] }),
      },
      true
    );

    expect(status).toBe('attempted_failed');
  });

  it('detects hallucinated columns with the strong detector', () => {
    const report = runAudit(baseData, fields, ',');
    const detection = detectHallucinations(
      report,
      JSON.stringify({
        title: 'x',
        domain_inferred: 'x',
        dataset_technical_description: "La columna 'phantom_score' requiere limpieza.",
        executive_summary: 'x',
        business_impact: 'x',
        key_findings: [],
        recommendations: [],
      })
    );

    expect(detection.hallucinatedColumns).toContain('phantom_score');
  });

  it('invalidates scripts that reference non-existent columns', () => {
    const report = runAudit(baseData, fields, ',');
    const validation = validateCleaningScript(report, "import pandas as pd\ndf['phantom_score'] = 1");

    expect(validation.valid).toBe(false);
    expect(validation.invalidColumns).toContain('phantom_score');
  });

  it('builds a deterministic fallback cleaning script when model output is unusable', () => {
    const report = runAudit(baseData, fields, ',');
    const script = buildDeterministicCleaningScript(report);
    const validation = validateCleaningScript(report, script);

    expect(script).toContain('df_clean = df.copy()');
    expect(script).toContain('df_clean["name"]');
    expect(validation.hasScript).toBe(true);
    expect(validation.coveredIssueIds.length).toBeGreaterThan(0);
    expect(validation.invalidColumns).toEqual([]);
  });

  it('simulates safe actions on a copy without mutating original data', () => {
    const report = runAudit(baseData, fields, ',');
    const actions = buildDeterministicRemediationActions(report);
    const simulation = simulateRemediation(baseData, actions);

    expect(baseData[0].name).toBe(' Alice  ');
    expect(simulation.data[0].name).toBe('Alice');
    expect(simulation.data.length).toBeLessThan(baseData.length);
  });

  it('creates an improvement run with a measurable health delta', () => {
    const report = runAudit(baseData, fields, ',');
    const benchmark = makeBenchmarkResult(report);
    const run = createImprovementRun({
      fileName: 'sample.csv',
      originalData: baseData,
      fields,
      delimiter: ',',
      initialReport: report,
      benchmarkResults: [benchmark],
      generatedScript: "import pandas as pd\ndf['name'] = df['name'].str.strip()",
    });

    expect(run.evidenceStatus).toBe('preliminary_valid');
    expect(run.healthDelta).toBeDefined();
    expect(run.healthDelta!.afterScore).toBeGreaterThanOrEqual(run.healthDelta!.beforeScore);
    expect(run.benchmarkResults[0].recommendedForRemediation).toBe(true);
  });

  it('preserves benchmark execution trace for auditability', () => {
    const report = runAudit(baseData, fields, ',');
    const benchmark = makeBenchmarkResult(report, {
      startedAt: '2026-05-18T00:00:00.000Z',
      completedAt: '2026-05-18T00:00:01.000Z',
      datasetFingerprint: 'abc123',
      executionTrace: [
        { stage: 'benchmark.created', timestamp: '2026-05-18T00:00:00.000Z', elapsedMs: 0 },
        { stage: 'provider.generateExecutiveReport.end', timestamp: '2026-05-18T00:00:01.000Z', elapsedMs: 1000 },
      ],
    });

    const run = createImprovementRun({
      fileName: 'sample.csv',
      originalData: baseData,
      fields,
      delimiter: ',',
      initialReport: report,
      benchmarkResults: [benchmark],
      generatedScript: "import pandas as pd\ndf['name'] = df['name'].str.strip()",
    });

    expect(run.benchmarkResults[0].executionTrace?.map((event) => event.stage)).toContain('provider.generateExecutiveReport.end');
    expect(run.benchmarkResults[0].datasetFingerprint).toBe('abc123');
  });

  it('does not false-positive match short column names like id with unrelated words like void', () => {
    const report = runAudit(baseData, fields, ',');
    // Supongamos que hay un issue en la columna 'id'
    const reportWithIdIssue = {
      ...report,
      issues: [
        {
          id: 'issue-id-test',
          severity: 'warning',
          category: 'Integridad y Estructura',
          ruleName: 'Valores Nulos',
          column: 'id',
          description: 'Valores nulos en columna id',
          count: 5,
          affectedPercentage: 5,
          sampleValues: []
        }
      ]
    } as any;
    
    // Script sin referencias reales a 'id' pero conteniendo palabras como 'void', 'valid' o 'import'
    const scriptWithVoid = "import pandas as pd\n# This function returns void\ndef clean(df):\n    df['name'] = df['name'].str.strip()";
    
    const validation = validateCleaningScript(reportWithIdIssue, scriptWithVoid);
    // No debería trazarse ya que no se refiere a la columna 'id' como variable o string
    expect(validation.coveredIssueIds).not.toContain('issue-id-test');
    
    // Script con referencia real a la columna 'id'
    const scriptWithRealId = "import pandas as pd\ndf['id'] = df['id'].fillna(0)";
    const validationReal = validateCleaningScript(reportWithIdIssue, scriptWithRealId);
    expect(validationReal.coveredIssueIds).toContain('issue-id-test');
  });

  it('filters out conversational numbers from unsupported hallucination claims while detecting actual inventory anomalies', () => {
    const report = runAudit(baseData, fields, ',');
    // Supongamos que el reporte tiene score 90, 11 filas
    
    // Texto con números conversacionales y un número de inventado fuera de contexto
    const responseText = JSON.stringify({
      title: 'Auditoría',
      domain_inferred: 'Ventas',
      dataset_technical_description: "Este es el paso 1 de la versión 2.0 que toma 3 segundos en cargarse.",
      executive_summary: "El dataset tiene un score de 90 y cuenta con 11 filas.",
      business_impact: "Se detectó una cifra inventada de 20 nulos en la columna status.",
      key_findings: ["Se encontraron anomalías en el dataset."],
      recommendations: []
    });
    
    const detection = detectHallucinations(report, responseText);
    
    // Los números conversacionales (1, 2.0, 3) y el score real (90), filas (11) no deben reportarse como claims no soportados
    const unsupportedClaimsTexts = detection.unsupportedClaims.map(c => c.claim);
    expect(unsupportedClaimsTexts).not.toContain('1');
    expect(unsupportedClaimsTexts).not.toContain('2');
    expect(unsupportedClaimsTexts).not.toContain('3');
    
    // La cifra inventada de '20' nulos (en contexto de 'nulos') sí debe detectarse
    expect(unsupportedClaimsTexts).toContain('20');
  });
});
