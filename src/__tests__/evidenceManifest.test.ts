import { describe, expect, it } from 'vitest';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import { AuditExecutionEvidence, BenchmarkResult, DeterministicValidationReport, HitlDecision, ScriptValidationResult } from '../types';

const stubEvidence: AuditExecutionEvidence = {
  id: 'audit-1',
  fileName: 'test.csv',
  fileSize: 2048,
  datasetFingerprint: 'abc12345',
  startedAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T00:00:01Z',
  parseDurationMs: 500,
  auditDurationMs: 500,
  totalDurationMs: 1000,
  rowsProcessed: 100,
  columnsProcessed: 5,
  delimiter: ',',
  truncated: false,
  ingestionStatus: 'success',
  issueCount: 3,
  score: 80,
  trace: [],
};

const stubValidation: DeterministicValidationReport = {
  datasetName: 'synthetic_ground_truth.csv',
  groundTruthMatched: true,
  perRuleMetrics: [],
  summary: {
    totalTP: 12, totalFP: 1, totalFN: 0,
    macroPrecision: 0.92, macroRecall: 1.0, macroF1: 0.96,
    rulesMatched: 12, rulesPartial: 0, rulesMissed: 0, rulesUnexpectedFP: 0,
  },
};

const stubScriptValidation: ScriptValidationResult = {
  valid: true,
  hasScript: true,
  invalidColumns: [],
  destructiveOperations: [],
  coveredIssueIds: ['a', 'b'],
  uncoveredIssueIds: ['c'],
  coveragePercentage: 66,
  safetyScore: 85,
  scriptOrigin: 'model',
  hasPandasImport: true,
  requiresHumanReview: false,
  warnings: [],
};

const stubHitlDecision: HitlDecision = {
  approved: true,
  timestamp: '2026-01-01T00:05:00Z',
  safetyScoreAtApproval: 85,
  coverageAtApproval: 66,
  checklist: [
    { criterion: 'Columnas', passed: true, detail: 'OK' },
    { criterion: 'Cobertura', passed: true, detail: '66%' },
    { criterion: 'Ops destructivas', passed: true, detail: 'Ninguna' },
    { criterion: 'Pandas', passed: true, detail: 'Importado' },
    { criterion: 'Revisión completa', passed: true, detail: 'OK' },
  ],
};

const stubBenchmark: BenchmarkResult = {
  id: 'bench-1',
  provider: 'Test',
  providerType: 'cloud',
  inputMode: 'smart_sample',
  model: 'test-v1',
  temperature: 0.7,
  status: 'completed',
  latencyMs: 500,
  firstTokenMs: 100,
  tokensGenerated: 200,
  tokensPerSecond: 400,
  formatCompliance: true,
  pythonScriptIncluded: true,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'preliminary_valid',
  compositeScore: 0.85,
  timestamp: new Date().toISOString(),
};

describe('buildEvidenceManifest', () => {
  it('incluye todas las secciones requeridas', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      deterministicValidation: stubValidation,
      benchmarkResults: [stubBenchmark],
      scriptValidation: stubScriptValidation,
      hitlDecision: stubHitlDecision,
      healthDeltaPoints: 15,
    });

    expect(manifest.generatedAt).toBeTruthy();
    expect(manifest.app.name).toContain('AURA');
    expect(manifest.app.version).toBeTruthy();
    expect(manifest.dataset.name).toBe('test.csv');
    expect(manifest.dataset.fingerprint).toBe('abc12345');
    expect(manifest.objectivesCoverage).toHaveLength(5);
    expect(manifest.artifacts.length).toBeGreaterThan(0);
    expect(manifest.allowedClaims).toBeDefined();
    expect(manifest.calibrationSummary).toBeDefined();
    expect(manifest.validationSummary).toBeDefined();
    expect(manifest.limitations.length).toBeGreaterThan(0);
  });

  it('marca OE1 como completed con ingestion exitosa', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [],
    });

    const oe1 = manifest.objectivesCoverage.find(o => o.id === 'OE1');
    expect(oe1!.status).toBe('completed');
  });

  it('marca OE1 como blocked sin ingestion', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: null,
      benchmarkResults: [],
    });

    const oe1 = manifest.objectivesCoverage.find(o => o.id === 'OE1');
    expect(oe1!.status).toBe('blocked');
  });

  it('marca OE2 como completed con ground truth', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      deterministicValidation: stubValidation,
      benchmarkResults: [],
    });

    const oe2 = manifest.objectivesCoverage.find(o => o.id === 'OE2');
    expect(oe2!.status).toBe('completed');
  });

  it('marca OE2 como partial sin ground truth', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      deterministicValidation: null,
      benchmarkResults: [],
    });

    const oe2 = manifest.objectivesCoverage.find(o => o.id === 'OE2');
    expect(oe2!.status).toBe('partial');
  });

  it('marca OE3 como blocked sin corridas', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [],
    });

    const oe3 = manifest.objectivesCoverage.find(o => o.id === 'OE3');
    expect(oe3!.status).toBe('blocked');
  });

  it('marca OE3 como partial con corridas pero sin formal', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [stubBenchmark],
    });

    const oe3 = manifest.objectivesCoverage.find(o => o.id === 'OE3');
    expect(oe3!.status).toBe('partial');
  });

  it('resume calibración como attempted cuando solo hay intentos fallidos o no disponibles', () => {
    const attemptedResult: BenchmarkResult = {
      ...stubBenchmark,
      id: 'attempted-1',
      status: 'unavailable',
      evidenceStatus: 'attempted_failed',
      error: 'Proveedor no disponible.',
    };
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [attemptedResult],
    });

    expect(manifest.calibrationSummary).toEqual(expect.objectContaining({
      totalRuns: 1,
      completedRuns: 0,
      failedOrUnavailableRuns: 1,
      formalRuns: 0,
      status: 'attempted',
    }));
    expect(manifest.objectivesCoverage.find(o => o.id === 'OE3')!.status).toBe('partial');
    expect(manifest.allowedClaims.calibrationEvidence).toBe('none');
    expect(manifest.artifacts).toContain('calibrationResults (JSON)');
  });

  it('resume calibración preliminar sin exponer ranking absoluto', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [stubBenchmark],
    });

    expect(manifest.calibrationSummary).toEqual(expect.objectContaining({
      totalRuns: 1,
      completedRuns: 1,
      failedOrUnavailableRuns: 0,
      formalRuns: 0,
      status: 'preliminary',
    }));
    expect(manifest.calibrationSummary.statement).toContain('preliminar');
    expect(manifest.calibrationSummary.statement).not.toContain('mejor');
    expect(manifest.validationSummary).not.toHaveProperty('bestBenchmarkScore');
  });

  it('limita el estado formal a corridas formal_valid sin convertirlo en veredicto universal', () => {
    const formalResult: BenchmarkResult = {
      ...stubBenchmark,
      id: 'formal-1',
      evidenceStatus: 'formal_valid',
    };
    const failedResult: BenchmarkResult = {
      ...stubBenchmark,
      id: 'failed-1',
      status: 'error',
      evidenceStatus: 'attempted_failed',
    };
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [formalResult, failedResult],
    });

    expect(manifest.calibrationSummary).toEqual(expect.objectContaining({
      totalRuns: 2,
      completedRuns: 1,
      failedOrUnavailableRuns: 1,
      formalRuns: 1,
      status: 'formal',
    }));
    expect(manifest.allowedClaims.calibrationEvidence).toBe('formal');
    expect(manifest.calibrationSummary.limitations.join(' ')).toContain('corridas clasificadas');
  });

  it('no eleva a formal una clasificación inconsistente que terminó en error', () => {
    const inconsistentResult: BenchmarkResult = {
      ...stubBenchmark,
      id: 'formal-error-1',
      status: 'error',
      evidenceStatus: 'formal_valid',
    };
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [inconsistentResult],
    });

    expect(manifest.calibrationSummary.status).toBe('attempted');
    expect(manifest.calibrationSummary.formalRuns).toBe(0);
    expect(manifest.allowedClaims.calibrationEvidence).toBe('none');
  });

  it('marca OE4 como completed con script válido y sin revisión requerida', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [],
      scriptValidation: stubScriptValidation,
    });

    const oe4 = manifest.objectivesCoverage.find(o => o.id === 'OE4');
    expect(oe4!.status).toBe('completed');
  });

  it('marca OE5 como completed con HITL aprobado', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [],
      hitlDecision: stubHitlDecision,
    });

    const oe5 = manifest.objectivesCoverage.find(o => o.id === 'OE5');
    expect(oe5!.status).toBe('completed');
  });

  it('allowedClaims no habilita claims de calibración sin corridas', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [],
    });

    expect(manifest.allowedClaims.calibrationEvidence).toBe('none');
  });

  it('allowedClaims permite determinista formal con ground truth', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      deterministicValidation: stubValidation,
      benchmarkResults: [],
    });

    expect(manifest.allowedClaims.deterministicEngine).toBe('formal');
  });

  it('allowedClaims deja calibración en preliminary con corridas no formales', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [stubBenchmark],
    });

    expect(manifest.allowedClaims.calibrationEvidence).toBe('preliminary');
  });

  it('validationSummary incluye métricas correctas', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      deterministicValidation: stubValidation,
      benchmarkResults: [stubBenchmark],
      scriptValidation: stubScriptValidation,
      hitlDecision: stubHitlDecision,
      healthDeltaPoints: 15,
    });

    expect(manifest.validationSummary.deterministicF1).toBeCloseTo(0.96);
    expect(manifest.calibrationSummary.formalRuns).toBe(0);
    expect(manifest.calibrationSummary.failedOrUnavailableRuns).toBe(0);
    expect(manifest.validationSummary.scriptSafetyScore).toBe(85);
    expect(manifest.validationSummary.hitlApproved).toBe(true);
    expect(manifest.validationSummary.healthDeltaPoints).toBe(15);
  });

  it('incluye limitaciones relevantes sobre simulación y calibración', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [],
    });

    expect(manifest.limitations.some(l => l.includes('Simulación'))).toBe(true);
    expect(manifest.limitations.some(l => l.includes('calibración experimental'))).toBe(true);
    expect(manifest.limitations.some(l => l.includes('Ground truth'))).toBe(true);
  });

  it('con remediationClassification=source_debt_preserved, agrega artifact sourceDebtEvidence y limitaciones de deuda de fuente', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [stubBenchmark],
      scriptValidation: stubScriptValidation,
      hitlDecision: stubHitlDecision,
      healthDeltaPoints: -33,
      remediationClassification: 'source_debt_preserved',
    });

    expect(manifest.artifacts).toContain('sourceDebtEvidence (delta JSON)');
    expect(manifest.limitations.some(l => l.includes('preserva deuda de fuente'))).toBe(true);
    expect(manifest.limitations.some(l => l.includes('CrimeId'))).toBe(true);
    expect(manifest.limitations.some(l => l.includes('crimeid_original'))).toBe(true);
  });

  it('con remediationClassification=improvement, NO agrega artifact sourceDebtEvidence', () => {
    const manifest = buildEvidenceManifest({
      auditEvidence: stubEvidence,
      benchmarkResults: [stubBenchmark],
      scriptValidation: stubScriptValidation,
      hitlDecision: stubHitlDecision,
      healthDeltaPoints: 20,
      remediationClassification: 'improvement',
    });

    expect(manifest.artifacts).not.toContain('sourceDebtEvidence (delta JSON)');
  });
});
