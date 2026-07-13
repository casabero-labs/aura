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
  diagnosisEvidence?: {
    status: 'valid' | 'invalid' | 'not_run';
    receiptHash?: string | null;
    model?: string | null;
    inputMode?: string | null;
  } | null;
  remediationReview?: {
    totalActions: number;
    approvedActions: number;
    rejectedActions: number;
    pendingActions: number;
    scriptApproved: boolean;
  } | null;
  scriptContractEvidence?: {
    exists: boolean;
    verified: boolean;
    scriptHash?: string | null;
  } | null;
  scriptValidation?: ScriptValidationResult | null;
  hitlDecision?: HitlDecision | null;
  healthDeltaPoints?: number;
  remediationClassification?: 'source_debt_preserved' | 'improvement';
}): EvidenceManifest => {
  const {
    auditEvidence,
    deterministicValidation,
    benchmarkResults,
    diagnosisEvidence,
    remediationReview,
    scriptContractEvidence,
    scriptValidation,
    hitlDecision,
    healthDeltaPoints,
    remediationClassification,
  } = params;

  const hasGroundTruth = deterministicValidation?.groundTruthMatched ?? false;
  const calibrationSummary = buildCalibrationSummary(benchmarkResults);

  // ── Objectives Coverage ──
  const objectives: ObjectiveCoverage[] = [
    {
      id: 'OE1',
      label: 'Arquitectura local-first',
      status: auditEvidence?.ingestionStatus === 'success' ? 'completed' : 'blocked',
      evidence: auditEvidence
        ? `CSV cargado: ${auditEvidence.fileName ?? 'desconocido'}, ${auditEvidence.rowsProcessed} filas, ${auditEvidence.columnsProcessed} columnas, fingerprint=${auditEvidence.datasetFingerprint}.`
        : 'Sin evidencia de ingestión.',
      limitations: auditEvidence?.truncated ? ['Dataset truncado durante el parseo; las filas procesadas pueden no cubrir el archivo completo.'] : [],
    },
    {
      id: 'OE2',
      label: 'Motor determinista evaluable',
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
      label: 'Diagnóstico asistido restringido',
      status: diagnosisEvidence?.status === 'valid'
        ? 'completed'
        : diagnosisEvidence?.status === 'invalid'
          ? 'partial'
          : 'blocked',
      evidence: diagnosisEvidence?.status === 'valid'
        ? `Diagnóstico V2 válido${diagnosisEvidence.model ? ` con ${diagnosisEvidence.model}` : ''}${diagnosisEvidence.inputMode ? ` mediante ${diagnosisEvidence.inputMode}` : ''}; recibo=${diagnosisEvidence.receiptHash ?? 'no disponible'}.`
        : diagnosisEvidence?.status === 'invalid'
          ? `Se intentó el diagnóstico asistido, pero su recibo quedó inválido (${diagnosisEvidence.receiptHash ?? 'sin recibo'}).`
          : 'No se ejecutó diagnóstico asistido en esta sesión.',
      limitations: diagnosisEvidence?.status === 'valid'
        ? []
        : ['Sin un recibo V2 válido no se afirma diagnóstico asistido completado.'],
    },
    {
      id: 'OE4',
      label: 'Laboratorio de comparación de modelos',
      status: calibrationSummary.status === 'formal'
        ? 'completed'
        : calibrationSummary.status === 'none'
          ? 'blocked'
          : 'partial',
      evidence: calibrationSummary.statement,
      limitations: calibrationSummary.limitations,
    },
    {
      id: 'OE5',
      label: 'Gobernanza human-in-the-loop',
      status: hitlDecision?.approved || remediationReview?.scriptApproved
        ? 'completed'
        : remediationReview
          ? 'partial'
          : 'blocked',
      evidence: hitlDecision?.approved
        ? `Decisión HITL registrada: safetyScore=${hitlDecision.safetyScoreAtApproval}/100, cobertura=${hitlDecision.coverageAtApproval}%, checklist=${hitlDecision.checklist.filter(c => c.passed).length}/${hitlDecision.checklist.length} criterios OK.`
        : remediationReview
          ? `Plan revisado: ${remediationReview.approvedActions} aprobadas, ${remediationReview.rejectedActions} rechazadas y ${remediationReview.pendingActions} pendientes de ${remediationReview.totalActions} acciones.`
          : 'Sin plan de remediación revisado en esta sesión.',
      limitations: [
        !hitlDecision && !remediationReview?.scriptApproved ? 'La revisión del plan no equivale todavía a la aprobación final de un script.' : '',
        healthDeltaPoints === undefined ? 'Sin delta de salud simulado.' : '',
      ].filter(Boolean),
    },
    {
      id: 'OE6',
      label: 'Scripts Python/Pandas revisables y trazables',
      status: scriptContractEvidence?.exists
        ? (scriptContractEvidence.verified ? 'completed' : 'partial')
        : scriptValidation?.hasScript
          ? (scriptValidation.valid ? 'completed' : 'partial')
          : 'blocked',
      evidence: scriptContractEvidence?.exists
        ? `Contrato de script V2 ${scriptContractEvidence.verified ? 'verificado' : 'no verificado'}; hash=${scriptContractEvidence.scriptHash ?? 'no disponible'}.`
        : scriptValidation?.hasScript
          ? `Script generado (origen=${scriptValidation.scriptOrigin}), safetyScore=${scriptValidation.safetyScore}/100, cobertura=${scriptValidation.coveragePercentage}%, columnas fantasma=${scriptValidation.invalidColumns.length}.`
          : 'Sin script generado.',
      limitations: [
        scriptContractEvidence?.exists && !scriptContractEvidence.verified ? 'El contrato V2 no superó la verificación fresca.' : '',
        !scriptContractEvidence?.exists && scriptValidation?.hasScript && !scriptValidation.valid
          ? `Script no válido: ${scriptValidation.warnings.join('; ') || 'razón desconocida'}.`
          : '',
        scriptValidation?.requiresHumanReview ? 'Requiere revisión humana explícita.' : '',
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
    scriptSafety: (scriptContractEvidence?.verified || (scriptValidation?.valid && !scriptValidation?.requiresHumanReview)
      ? 'formal'
      : scriptContractEvidence?.exists || scriptValidation?.hasScript
        ? 'preliminary'
        : 'none') as 'formal' | 'preliminary' | 'none',
    hitlDecision: (hitlDecision?.approved || remediationReview?.scriptApproved
      ? 'formal'
      : hitlDecision || remediationReview
        ? 'preliminary'
        : 'none') as 'formal' | 'preliminary' | 'none',
    healthDelta: (healthDeltaPoints !== undefined && (hitlDecision?.approved || remediationReview?.scriptApproved)
      ? 'formal'
      : healthDeltaPoints !== undefined
        ? 'preliminary'
        : 'none') as 'formal' | 'preliminary' | 'none',
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
  if (diagnosisEvidence?.receiptHash) artifacts.push('diagnosisReceipt (JSON)');
  if (calibrationSummary.totalRuns > 0) artifacts.push('calibrationResults (JSON)');
  if (remediationReview) artifacts.push('remediationReview (JSON)');
  if (scriptContractEvidence?.exists) artifacts.push('scriptContractV2 (JSON)');
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
      hitlApproved: Boolean(hitlDecision?.approved || remediationReview?.scriptApproved),
      healthDeltaPoints,
    },
    limitations,
  };
};
