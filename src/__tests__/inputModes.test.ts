import { describe, expect, it } from 'vitest';
import { buildAnalysisPrompt } from '../services/providers/prompts';
import { diagnosisReliabilityScore } from '../services/benchmark/evaluationService';
import { AuditReport, BenchmarkResult, IssueCategory, IssueSeverity } from '../types';

const report: AuditReport = {
  score: 65,
  rowCount: 100,
  colCount: 4,
  duplicateRows: 2,
  delimiterDetected: ',',
  columnStats: {
    nombre: { name: 'nombre', inferredType: 'string', nullCount: 0, uniqueCount: 100, sampleValues: ['Juan', 'Maria'] },
    edad: { name: 'edad', inferredType: 'number', nullCount: 5, uniqueCount: 95, iqr: 15, q1: 20, q3: 35 },
    email: { name: 'email', inferredType: 'string', semanticType: 'email', nullCount: 3, uniqueCount: 97 },
    salario: { name: 'salario', inferredType: 'number', nullCount: 0, uniqueCount: 100, zeros: 1 },
  },
  issues: [
    {
      id: 'logic-email-email',
      column: 'email',
      ruleName: 'Formato Email Invalido',
      category: IssueCategory.LOGIC,
      description: 'Cadenas sin estructura de correo.',
      severity: IssueSeverity.CRITICAL,
      count: 2,
      affectedPercentage: 2,
      sampleValues: ['bad@email', 'no-at-sign', 'incomplete'],
      ruleId: 'rule:test',
    },
    {
      id: 'types-age-age',
      column: 'edad',
      ruleName: 'Negativos Imposibles',
      category: IssueCategory.INTEGRITY,
      description: 'Edad negativa.',
      severity: IssueSeverity.WARNING,
      count: 1,
      affectedPercentage: 1,
      sampleValues: ['-5'],
      ruleId: 'rule:test',
    },
  ],
  scoreBreakdown: [],
};

const baseBenchmark: BenchmarkResult = {
  id: 'test-1',
  provider: 'Test',
  providerType: 'local',
  inputMode: 'smart_sample',
  model: 'test-model',
  temperature: 0.7,
  status: 'completed',
  latencyMs: 3000,
  firstTokenMs: 500,
  tokensGenerated: 200,
  tokensPerSecond: 66,
  formatCompliance: true,
  contractCompliance: true,
  pythonScriptIncluded: true,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'preliminary_valid',
  startedAt: new Date().toISOString(),
  timestamp: new Date().toISOString(),
};

const withObservedEvidence = (result: BenchmarkResult): BenchmarkResult => ({
  ...result,
  hallucinationReport: {
    hallucinatedColumns: result.hallucinatedColumns,
    unsupportedClaimsCount: result.unsupportedClaims,
    jsonCompliance: false,
    contractCompliance: result.contractCompliance ?? result.formatCompliance,
    formatErrorCount: 1,
    invalidScriptColumns: [],
    knownColumnCount: report.colCount,
    mentionedKnownColumns: ['email', 'edad'],
    mentionedRuleNames: ['Formato Email Invalido'],
    citedBadSamples: ['bad@email', '-5'],
    evidenceAnchoringScore: 0.5,
    badSampleCitationScore: 0.67,
  },
});

// ── Input Mode Tests ──

describe('Input Mode Prompt Builders', () => {
  it('prompt_libre: genera prompt minimalista sin reglas ni bad samples', () => {
    const prompt = buildAnalysisPrompt(report, undefined, 'prompt_libre');
    expect(prompt).toContain('Columnas disponibles');
    expect(prompt).toContain('nombre, edad, email, salario');
    expect(prompt).not.toContain('Formato Email Invalido');
    expect(prompt).not.toContain('bad@email');
  });

  it('smart_sample: incluye smartSample JSON con contexto y reglas', () => {
    const prompt = buildAnalysisPrompt(report, undefined, 'smart_sample');
    expect(prompt).toContain('total_rows');
    expect(prompt).toContain('Formato Email Invalido');
    expect(prompt).toContain('bad@email');
    expect(prompt).toContain('quality_score');
  });

  it('enhanced_registry: incluye registro tecnico con tipos, IQR, cardinalidad', () => {
    const prompt = buildAnalysisPrompt(report, undefined, 'enhanced_registry');
    expect(prompt).toContain('physical_context');
    expect(prompt).toContain('column_registry');
    expect(prompt).toContain('rule_activations');
    expect(prompt).toContain('inferred_type');
    expect(prompt).toContain('iqr');
    expect(prompt).toContain('cardinality_pct');
    expect(prompt).toContain('semantic_type');
  });

  it('copy_paste_bad_samples: cita valores textuales reales de bad samples', () => {
    const prompt = buildAnalysisPrompt(report, undefined, 'copy_paste_bad_samples');
    expect(prompt).toContain('bad@email');
    expect(prompt).toContain('no-at-sign');
    expect(prompt).toContain('-5');
    expect(prompt).toContain('M4 Copy-Paste');
    expect(prompt).toContain('CITA TEXTUALMENTE');
  });

  it('recommended: combina registry completo con bad samples textuales', () => {
    const prompt = buildAnalysisPrompt(report, undefined, 'recommended');
    expect(prompt).toContain('column_registry');
    expect(prompt).toContain('rule_activations');
    expect(prompt).toContain('bad@email');
    expect(prompt).toContain('Anclaje semantico');
    expect(prompt).toContain('Copy-Paste');
  });

  it('cada inputMode produce un prompt distinto', () => {
    const modes = ['prompt_libre', 'smart_sample', 'enhanced_registry', 'copy_paste_bad_samples', 'recommended'] as const;
    const prompts = modes.map(mode => buildAnalysisPrompt(report, undefined, mode));
    const unique = new Set(prompts);
    expect(unique.size).toBe(modes.length);
  });
});

// ── Diagnosis Reliability Score Tests ──

describe('Diagnosis Reliability Score', () => {
  it('penaliza alucinaciones severamente', () => {
    const clean = diagnosisReliabilityScore(withObservedEvidence(baseBenchmark));
    const hallucinated: BenchmarkResult = withObservedEvidence({ ...baseBenchmark, hallucinatedColumns: ['col_falsa_1', 'col_falsa_2', 'col_falsa_3'] });
    const withH = diagnosisReliabilityScore(hallucinated);
    expect(clean).toBeGreaterThan(withH);
    expect(withH).toBeLessThan(0.8);
  });

  it('no otorga credito de citas por modo si no hay evidencia observada', () => {
    const libre: BenchmarkResult = { ...baseBenchmark, inputMode: 'prompt_libre', formatCompliance: true, contractCompliance: true };
    const recommended: BenchmarkResult = { ...baseBenchmark, inputMode: 'recommended', formatCompliance: true, contractCompliance: true };
    expect(diagnosisReliabilityScore(recommended)).toBe(diagnosisReliabilityScore(libre));
  });

  it('mejora el score cuando hay anclaje y bad samples observados', () => {
    const withoutEvidence = diagnosisReliabilityScore(baseBenchmark);
    const withEvidence = diagnosisReliabilityScore(withObservedEvidence(baseBenchmark));
    expect(withEvidence).toBeGreaterThan(withoutEvidence);
  });

  it('contractCompliance true mejora el score', () => {
    const withFmt = diagnosisReliabilityScore({ ...baseBenchmark, formatCompliance: true, contractCompliance: true });
    const withoutFmt = diagnosisReliabilityScore({ ...baseBenchmark, formatCompliance: false, contractCompliance: false });
    expect(withFmt).toBeGreaterThan(withoutFmt);
  });

  it('script incluido mejora el score', () => {
    const withScript = diagnosisReliabilityScore({ ...baseBenchmark, pythonScriptIncluded: true });
    const withoutScript = diagnosisReliabilityScore({ ...baseBenchmark, pythonScriptIncluded: false });
    expect(withScript).toBeGreaterThan(withoutScript);
  });

  it('score esta entre 0 y 1', () => {
    const score = diagnosisReliabilityScore(baseBenchmark);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('latencia alta penaliza pero no domina el score', () => {
    const fast: BenchmarkResult = { ...baseBenchmark, latencyMs: 100 };
    const slow: BenchmarkResult = { ...baseBenchmark, latencyMs: 30000, tokensGenerated: 500, tokensPerSecond: 16 };
    const fastScore = diagnosisReliabilityScore(fast);
    const slowScore = diagnosisReliabilityScore(slow);
    // Ambos deben estar en rango razonable (latencia es solo 10%)
    expect(fastScore).toBeGreaterThan(slowScore);
    expect(fastScore - slowScore).toBeLessThan(0.3); // la diferencia no debe ser enorme
  });
});
