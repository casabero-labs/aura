import {
  AuditExecutionEvidence,
  BenchmarkResult,
  CalibrationSummary,
  DeterministicValidationReport,
  EvidenceManifest,
  HitlDecision,
  ObjectiveCoverage,
  ScriptValidationResult,
} from '../types';

const APP_VERSION = '0.5.0';

const buildCalibrationSummary = (results: BenchmarkResult[]): CalibrationSummary => {
  const totalRuns = results.length;
  const completedRuns = results.filter(result => result.status === 'completed').length;
  const failedOrUnavailableRuns = results.filter(result =>
    result.evidenceStatus === 'attempted_failed'
    || result.status === 'error'
    || result.status === 'unavailable'
  ).length;
  const formalRuns = results.filter(result =>
    result.status === 'completed' && result.evidenceStatus === 'formal_valid'
  ).length;
  const hasPreliminaryEvidence = results.some(result =>
    result.status === 'completed' && result.evidenceStatus === 'preliminary_valid'
  );

  if (totalRuns === 0) {
    return {
      totalRuns,
      completedRuns,
      failedOrUnavailableRuns,
      formalRuns,
      status: 'none',
      statement: 'No se ejecutaron corridas de calibración experimental.',
      limitations: ['La calibración es opcional y su ausencia no bloquea el diagnóstico normal.'],
    };
  }

  if (formalRuns > 0) {
    return {
      totalRuns,
      completedRuns,
      failedOrUnavailableRuns,
      formalRuns,
      status: 'formal',
      statement: `${totalRuns} corridas registradas; ${completedRuns} completadas; ${failedOrUnavailableRuns} fallidas o no disponibles; ${formalRuns} con evidencia formal.`,
      limitations: [
        'El lenguaje formal se limita a las corridas clasificadas como formal_valid.',
        'La calibración compara configuraciones observadas y no establece superioridad universal.',
      ],
    };
  }

  if (hasPreliminaryEvidence) {
    return {
      totalRuns,
      completedRuns,
      failedOrUnavailableRuns,
      formalRuns,
      status: 'preliminary',
      statement: `${totalRuns} corridas registradas; ${completedRuns} completadas; ${failedOrUnavailableRuns} fallidas o no disponibles. La evidencia disponible es preliminar.`,
      limitations: [
        'Las corridas completadas no tienen clasificación formal_valid.',
        'La calibración compara configuraciones observadas y no establece superioridad universal.',
      ],
    };
  }

  return {
    totalRuns,
    completedRuns,
    failedOrUnavailableRuns,
    formalRuns,
    status: 'attempted',
    statement: `${totalRuns} intentos registrados; ninguno produjo una corrida completada; ${failedOrUnavailableRuns} fallidos o no disponibles.`,
    limitations: [
      'Los intentos fallidos o no disponibles no invalidan el flujo principal.',
      'No existe evidencia completada para comparar configuraciones.',
    ],
  };
};

export const buildEvidenceManifest = (params: {
  auditEvidence?: AuditExecutionEvidence | null;
  deterministicValidation?: DeterministicValidationReport | null;
  benchmarkResults: BenchmarkResult[];
  scriptValidation?: ScriptValidationResult | null;
  hitlDecision?: HitlDecision | null;
  healthDeltaPoints?: number;
  remediationClassification?: 'source_debt_preserved' | 'improvement';
}): EvidenceManifest => {
  const { auditEvidence, deterministicValidation, benchmarkResults, scriptValidation, hitlDecision, healthDeltaPoints, remediationClassification } = params;

  const hasGroundTruth = deterministicValidation?.groundTruthMatched ?? false;
  const calibrationSummary = buildCalibrationSummary(benchmarkResults);

  // ── Objectives Coverage ──
  const objectives: ObjectiveCoverage[] = [
    {
      id: 'OE1',
      label: 'Ingestión y perfilamiento determinista',
      status: auditEvidence?.ingestionStatus === 'success' ? 'completed' : 'blocked',
      evidence: auditEvidence
        ? `CSV cargado: ${auditEvidence.fileName ?? 'desconocido'}, ${auditEvidence.rowsProcessed} filas, ${auditEvidence.columnsProcessed} columnas, fingerprint=${auditEvidence.datasetFingerprint}.`
        : 'Sin evidencia de ingestión.',
      limitations: auditEvidence?.truncated ? ['Dataset truncado durante el parseo; las filas procesadas pueden no cubrir el archivo completo.'] : [],
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
      label: 'Diagnóstico LLM y calibración experimental',
      status: calibrationSummary.status === 'formal'
        ? 'completed'
        : calibrationSummary.status === 'none'
          ? 'blocked'
          : 'partial',
      evidence: calibrationSummary.statement,
      limitations: calibrationSummary.limitations,
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
    calibrationEvidence: (
      calibrationSummary.status === 'formal'
        ? 'formal'
        : calibrationSummary.status === 'preliminary'
          ? 'preliminary'
          : 'none'
    ) as 'formal' | 'preliminary' | 'none',
    scriptSafety: (scriptValidation?.valid && !scriptValidation?.requiresHumanReview ? 'formal' : scriptValidation?.hasScript ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
    hitlDecision: (hitlDecision?.approved ? 'formal' : hitlDecision ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
    healthDelta: (healthDeltaPoints !== undefined && hitlDecision?.approved ? 'formal' : healthDeltaPoints !== undefined ? 'preliminary' : 'none') as 'formal' | 'preliminary' | 'none',
  };

  const limitations: string[] = [
    'Simulación de remediación sobre copia en memoria; no modifica el archivo original.',
    'La calibración experimental no establece un ranking absoluto entre modelos o configuraciones.',
    'La disponibilidad de proveedores puede producir intentos fallidos sin afectar el diagnóstico normal.',
    'Ground truth disponible solo para datasets sintético y Titanic.',
    'Métricas deterministas por regla usan detección binaria (rule fired / not fired), no conteo de filas.',
  ];

  if (remediationClassification === 'source_debt_preserved') {
    limitations.push(
      'La remediación preserva deuda de fuente: el score no mejora bajo runAudit porque la deuda de CrimeId es de origen (columna contaminada en el sistema fuente). Se requieren columnas auxiliares de trazabilidad.',
      'La remediación no corrige el dato primario: CrimeId contaminado permanece como evidencia en crimeid_original. El placeholder usado en CrimeId no constituye una corrección, sino una marcación.',
    );
  }

  if (auditEvidence?.truncated) {
    limitations.push('Dataset truncado durante el parseo; las filas procesadas pueden no cubrir el archivo completo.');
  }

  const artifacts: string[] = [];
  if (auditEvidence?.ingestionStatus === 'success') artifacts.push('auditEvidence (JSON)');
  if (hasGroundTruth) artifacts.push('deterministicValidation (JSON)');
  if (calibrationSummary.totalRuns > 0) artifacts.push('calibrationResults (JSON)');
  if (scriptValidation?.hasScript) artifacts.push('scriptValidation (JSON)');
  if (scriptValidation?.hasScript) artifacts.push('cleaningScript (Python)');
  if (hitlDecision?.approved) artifacts.push('hitlDecision (JSON)');
  if (healthDeltaPoints !== undefined) artifacts.push('healthDelta (JSON)');
  if (remediationClassification === 'source_debt_preserved') {
    artifacts.push('sourceDebtEvidence (delta JSON)');
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
    calibrationSummary,
    validationSummary: {
      deterministicF1: hasGroundTruth ? deterministicValidation!.summary.macroF1 : undefined,
      scriptSafetyScore: scriptValidation?.safetyScore,
      hitlApproved: hitlDecision?.approved ?? false,
      healthDeltaPoints,
    },
    limitations,
  };
};
