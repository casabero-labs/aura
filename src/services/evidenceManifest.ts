import {
  AuditExecutionEvidence,
  BenchmarkResult,
  DeterministicValidationReport,
  EvidenceManifest,
  HitlDecision,
  ObjectiveCoverage,
  ScriptValidationResult,
} from '../types';

const APP_VERSION = '0.5.0';

export const buildEvidenceManifest = (params: {
  auditEvidence?: AuditExecutionEvidence | null;
  deterministicValidation?: DeterministicValidationReport | null;
  benchmarkResults: BenchmarkResult[];
  scriptValidation?: ScriptValidationResult | null;
  hitlDecision?: HitlDecision | null;
  healthDeltaPoints?: number;
}): EvidenceManifest => {
  const { auditEvidence, deterministicValidation, benchmarkResults, scriptValidation, hitlDecision, healthDeltaPoints } = params;

  const hasGroundTruth = deterministicValidation?.groundTruthMatched ?? false;
  const benchmarkFormalCount = benchmarkResults.filter(r => r.evidenceStatus === 'formal_valid').length;
  const benchmarkFailedCount = benchmarkResults.filter(r => r.evidenceStatus === 'attempted_failed' || r.status === 'error').length;
  const bestBenchmark = benchmarkResults.filter(r => r.status === 'completed').sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))[0];
  const hasSuccessfulBenchmark = benchmarkResults.some(r => r.status === 'completed');

  // ── Objectives Coverage ──
  const objectives: ObjectiveCoverage[] = [
    {
      id: 'OE1',
      label: 'Ingestión y perfilamiento determinista',
      status: auditEvidence?.ingestionStatus === 'success' ? 'completed' : 'blocked',
      evidence: auditEvidence
        ? `CSV cargado: ${auditEvidence.fileName ?? 'desconocido'}, ${auditEvidence.rowsProcessed} filas, ${auditEvidence.columnsProcessed} columnas, fingerprint=${auditEvidence.datasetFingerprint}.`
        : 'Sin evidencia de ingestión.',
      limitations: auditEvidence?.truncated ? ['Dataset truncado a 5000 filas (preview).'] : [],
    },
    {
      id: 'OE2',
      label: 'Validación determinista formal por regla',
      status: hasGroundTruth ? 'completed' : 'partial',
      evidence: hasGroundTruth
        ? `Ground truth ${deterministicValidation!.datasetName}. Macro F1=${(deterministicValidation!.summary.macroF1 * 100).toFixed(1)}%, ${deterministicValidation!.summary.rulesMatched} reglas match, ${deterministicValidation!.summary.rulesUnexpectedFP} FP inesperados.`
        : 'Sin ground truth disponible para este dataset.',
      limitations: hasGroundTruth && deterministicValidation!.summary.rulesUnexpectedFP > 0
        ? [`${deterministicValidation!.summary.rulesUnexpectedFP} falsos positivos inesperados en el motor determinista.`]
        : [],
    },
    {
      id: 'OE3',
      label: 'Diagnóstico LLM y benchmark formal',
      status: hasSuccessfulBenchmark ? (benchmarkFormalCount > 0 ? 'completed' : 'partial') : 'blocked',
      evidence: hasSuccessfulBenchmark
        ? `${benchmarkResults.length} corridas, ${benchmarkFormalCount} con evidencia formal, mejor score compuesto=${bestBenchmark?.compositeScore?.toFixed(2) ?? 'N/A'}.`
        : 'Sin corridas de benchmark completadas.',
      limitations: [
        benchmarkFormalCount === 0 ? 'Ninguna corrida alcanzó evidencia formal.' : '',
        !hasSuccessfulBenchmark ? 'Benchmark bloqueado: sin API keys activas o WebGPU no disponible.' : '',
      ].filter(Boolean),
    },
    {
      id: 'OE4',
      label: 'Script seguro y validación HITL',
      status: scriptValidation?.hasScript
        ? (scriptValidation.valid && !scriptValidation.requiresHumanReview ? 'completed' : 'partial')
        : 'blocked',
      evidence: scriptValidation?.hasScript
        ? `Script generado (origen=${scriptValidation.scriptOrigin}), safetyScore=${scriptValidation.safetyScore}/100, cobertura=${scriptValidation.coveragePercentage}%, columnas fantasma=${scriptValidation.invalidColumns.length}.`
        : 'Sin script generado.',
      limitations: [
        !scriptValidation?.valid ? `Script no válido: ${scriptValidation?.warnings.join('; ') || 'razón desconocida'}.` : '',
        scriptValidation?.requiresHumanReview ? 'Requiere revisión humana explícita.' : '',
        scriptValidation?.scriptOrigin === 'deterministic' ? 'Script generado por respaldo determinista, no por LLM.' : '',
      ].filter(Boolean),
    },
    {
      id: 'OE5',
      label: 'Exportación, gobernanza y resultados',
      status: hitlDecision?.approved ? 'completed' : 'partial',
      evidence: hitlDecision?.approved
        ? `Decisión HITL registrada: safetyScore=${hitlDecision.safetyScoreAtApproval}/100, cobertura=${hitlDecision.coverageAtApproval}%, checklist=${hitlDecision.checklist.filter(c => c.passed).length}/${hitlDecision.checklist.length} criterios OK.`
        : 'Sin decisión HITL registrada.',
      limitations: [
        !hitlDecision ? 'Sin decisión humana registrada.' : '',
        healthDeltaPoints === undefined ? 'Sin delta de salud simulado.' : '',
      ].filter(Boolean),
    },
  ];

  // ── Allowed Claims ──
  const allowedClaims = {
    deterministicEngine: (auditEvidence?.ingestionStatus === 'success' && hasGroundTruth ? 'formal' : 'preliminary') as 'formal' | 'preliminary' | 'none',
    benchmarkLLM: (benchmarkFormalCount > 0 ? 'formal' : hasSuccessfulBenchmark ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
    scriptSafety: (scriptValidation?.valid && !scriptValidation?.requiresHumanReview ? 'formal' : scriptValidation?.hasScript ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
    hitlDecision: (hitlDecision?.approved ? 'formal' : hitlDecision ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
    healthDelta: (healthDeltaPoints !== undefined && hitlDecision?.approved ? 'formal' : healthDeltaPoints !== undefined ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
  };

  // ── Artifacts ──
  const artifacts: string[] = [];
  if (auditEvidence?.ingestionStatus === 'success') artifacts.push('auditEvidence (JSON)');
  if (hasGroundTruth) artifacts.push('deterministicValidation (JSON)');
  if (hasSuccessfulBenchmark) artifacts.push('benchmarkResults (JSON)');
  if (scriptValidation?.hasScript) artifacts.push('scriptValidation (JSON)');
  if (scriptValidation?.hasScript) artifacts.push('cleaningScript (Python)');
  if (hitlDecision?.approved) artifacts.push('hitlDecision (JSON)');
  if (healthDeltaPoints !== undefined) artifacts.push('healthDelta (JSON)');

  const limitations: string[] = [
    'Simulación de remediación sobre copia en memoria; no modifica el archivo original.',
    'Benchmark LLM puede ser preliminar si no hay API keys o WebGPU activos.',
    'Ground truth disponible solo para datasets sintético y Titanic.',
    'Métricas deterministas por regla usan detección binaria (rule fired / not fired), no conteo de filas.',
  ];

  if (auditEvidence?.truncated) {
    limitations.push('Dataset truncado a 5000 filas (modo preview del navegador).');
  }

  return {
    generatedAt: new Date().toISOString(),
    dataset: {
      name: auditEvidence?.fileName,
      fingerprint: auditEvidence?.datasetFingerprint,
      rows: auditEvidence?.rowsProcessed ?? 0,
      columns: auditEvidence?.columnsProcessed ?? 0,
    },
    app: {
      name: 'AURA — Auditoría Unificada de Riesgos Algorítmicos',
      version: APP_VERSION,
    },
    objectivesCoverage: objectives,
    artifacts,
    allowedClaims,
    validationSummary: {
      deterministicF1: hasGroundTruth ? deterministicValidation!.summary.macroF1 : undefined,
      benchmarkFormalCount,
      benchmarkFailedCount,
      bestBenchmarkScore: bestBenchmark?.compositeScore,
      scriptSafetyScore: scriptValidation?.safetyScore,
      hitlApproved: hitlDecision?.approved ?? false,
      healthDeltaPoints,
    },
    limitations,
  };
};
