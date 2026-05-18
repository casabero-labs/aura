import { describe, expect, it } from 'vitest';
import { runAudit } from '../services/auditEngine';
import { detectHallucinations } from '../services/benchmark/hallucinationDetector';
import { deriveEvidenceStatus, createImprovementRun } from '../services/improvementService';
import { simulateRemediation, buildDeterministicRemediationActions } from '../services/remediationSimulator';
import { validateCleaningScript } from '../services/scriptValidationService';
import { AuditReport, BenchmarkResult } from '../types';

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
});
