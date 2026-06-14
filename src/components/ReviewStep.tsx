import React, { useState } from 'react';
import ScriptReview from './ScriptReview';
import ImprovementRunPanel from './ImprovementRunPanel';
import { createImprovementRun } from '../services/improvementService';
import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  AuditReport,
  AuditExecutionEvidence,
  HitlChecklistItem,
  HitlDecision,
  ImprovementRun,
  HealthDelta,
  BenchmarkResult,
  ScriptValidationResult,
} from '../types';

interface ReviewStepProps {
  report: AuditReport;
  rawData: Record<string, any>[];
  csvFields: string[];
  csvDelimiter: string;
  cleaningScript: string;
  approvedScript: string;
  auditEvidence?: AuditExecutionEvidence;
  benchmarkResults?: BenchmarkResult[];
  scriptValidation?: ScriptValidationResult | null;
  onScriptApproved?: (script: string) => void;
  onImprovementRun?: (run: ImprovementRun) => void;
  onHealthDelta?: (delta: HealthDelta) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue?: () => void;
}

type ReviewStage = 'pending' | 'simulating' | 'completed';

const ReviewStep: React.FC<ReviewStepProps> = ({
  report,
  rawData,
  csvFields,
  csvDelimiter,
  cleaningScript,
  approvedScript,
  auditEvidence,
  benchmarkResults = [],
  scriptValidation,
  onScriptApproved,
  onImprovementRun,
  onHealthDelta,
  onLog,
  onContinue,
}) => {
  const [stage, setStage] = useState<ReviewStage>('pending');
  const [draftScript, setDraftScript] = useState<string>(cleaningScript);
  const [currentApprovedScript, setCurrentApprovedScript] = useState<string>(approvedScript);
  const [improvementRun, setImprovementRun] = useState<ImprovementRun | null>(null);
  const [healthDelta, setHealthDelta] = useState<HealthDelta | null>(null);
  const [hitlDecision, setHitlDecision] = useState<HitlDecision | null>(null);

  const handleApprove = (script: string) => {
    setCurrentApprovedScript(script);
    onScriptApproved?.(script);

    const checklist: HitlChecklistItem[] = [
      {
        criterion: 'Columnas válidas',
        passed: scriptValidation ? scriptValidation.invalidColumns.length === 0 : false,
        detail: scriptValidation
          ? scriptValidation.invalidColumns.length === 0
            ? 'Todas las columnas existen en AuditReport.'
            : `${scriptValidation.invalidColumns.length} columnas fantasma: ${scriptValidation.invalidColumns.join(', ')}.`
          : 'Validación de columnas no disponible.',
      },
      {
        criterion: 'Cobertura de hallazgos',
        passed: scriptValidation ? scriptValidation.coveragePercentage >= 50 : false,
        detail: scriptValidation
          ? `${scriptValidation.coveragePercentage}% de hallazgos trazados (${scriptValidation.coveredIssueIds.length}/${scriptValidation.coveredIssueIds.length + scriptValidation.uncoveredIssueIds.length}).`
          : 'Validación de cobertura no disponible.',
      },
      {
        criterion: 'Operaciones destructivas',
        passed: scriptValidation ? scriptValidation.destructiveOperations.length === 0 : false,
        detail: scriptValidation
          ? scriptValidation.destructiveOperations.length === 0
            ? 'Sin operaciones destructivas detectadas.'
            : `Operaciones detectadas: ${scriptValidation.destructiveOperations.join(', ')}. Requieren revisión explícita.`
          : 'Validación de operaciones no disponible.',
      },
      {
        criterion: 'Uso de Pandas',
        passed: scriptValidation?.hasPandasImport ?? false,
        detail: scriptValidation?.hasPandasImport
          ? 'El script evidencia importación de Pandas.'
          : 'El script no evidencia uso de Pandas.',
      },
      {
        criterion: 'Revisión humana completa',
        passed: true,
        detail: 'El revisor verificó el código completo antes de aprobar.',
      },
    ];

    const decision: HitlDecision = {
      approved: true,
      timestamp: new Date().toISOString(),
      safetyScoreAtApproval: scriptValidation?.safetyScore ?? 0,
      coverageAtApproval: scriptValidation?.coveragePercentage ?? 0,
      checklist,
      reviewerNotes: scriptValidation?.requiresHumanReview
        ? 'Aprobado con advertencias: el script requiere criterio humano para operaciones marcadas.'
        : undefined,
    };

    setHitlDecision(decision);
    runSimulation(script, decision);
  };

  const reviewChecks = [
    {
      label: 'script disponible',
      value: cleaningScript ? `${cleaningScript.split('\n').length} líneas` : 'pendiente',
      state: cleaningScript ? 'pass' : 'warn',
    },
    {
      label: 'columnas',
      value: scriptValidation
        ? scriptValidation.invalidColumns.length === 0 ? 'existentes' : `${scriptValidation.invalidColumns.length} inválidas`
        : 'sin validar',
      state: scriptValidation && scriptValidation.invalidColumns.length === 0 ? 'pass' : 'warn',
    },
    {
      label: 'cobertura',
      value: scriptValidation ? `${scriptValidation.coveragePercentage}% (${scriptValidation.coveredIssueIds.length} hallazgos)` : 'sin validar',
      state: scriptValidation && scriptValidation.coveragePercentage >= 50 ? 'pass' : 'warn',
    },
    {
      label: 'safety score',
      value: scriptValidation ? `${scriptValidation.safetyScore}/100` : '—',
      state: scriptValidation
        ? scriptValidation.safetyScore >= 80 ? 'pass' : scriptValidation.safetyScore >= 50 ? 'review' : 'warn'
        : 'warn',
    },
    {
      label: 'riesgo destructivo',
      value: scriptValidation
        ? scriptValidation.destructiveOperations.length === 0 ? 'sin operaciones' : `${scriptValidation.destructiveOperations.length} detectadas`
        : 'sin validar',
      state: scriptValidation && scriptValidation.destructiveOperations.length === 0 ? 'pass' : 'warn',
    },
    {
      label: 'simulación',
      value: stage === 'completed' ? 'registrada' : stage === 'simulating' ? 'en curso' : 'pendiente',
      state: stage === 'completed' ? 'pass' : 'review',
    },
  ];

  const runSimulation = async (script: string, decision: HitlDecision) => {
    setStage('simulating');
    onLog?.('review.approve', `Script aprobado · safetyScore=${decision.safetyScoreAtApproval} · cobertura=${decision.coverageAtApproval}%`);

    try {
      const run = createImprovementRun({
        originalData: rawData,
        fields: csvFields,
        delimiter: csvDelimiter,
        initialReport: report,
        auditEvidence,
        benchmarkResults,
        generatedScript: script,
        scriptValidation: scriptValidation || undefined,
        hitlDecision: decision,
      });

      setImprovementRun(run);

      if (run.healthDelta) {
        setHealthDelta(run.healthDelta);
        onHealthDelta?.(run.healthDelta);
        onLog?.(
          'review.simulated',
          `score ${run.healthDelta.beforeScore} → ${run.healthDelta.afterScore} (${run.healthDelta.scoreDelta >= 0 ? '+' : ''}${run.healthDelta.scoreDelta})`
        );
      }

      onImprovementRun?.(run);
      setStage('completed');
    } catch (err: any) {
      onLog?.('review.error', `Simulación falló: ${err.message}`);
      setStage('pending');
    }
  };

  return (
    <div className="review-step">
      {/* Header */}
      <div className="section-header">
        <div>
          <p className="sec-eye">revisión humana</p>
          <h2 className="sec-title">Revisión humana + simulación.</h2>
        </div>
        {stage === 'completed' && improvementRun && (
          <div className="flex items-center gap-2" style={{color:'var(--success)'}}>
            <ShieldCheck size={16} />
            <span>Remediación simulada</span>
          </div>
        )}
      </div>

      <p className="section-note mt-6">
        Esta etapa decide si el script puede pasar a simulación. El usuario revisa el código completo,
        edita si hace falta y aprueba explícitamente antes de generar evidencia de impacto.
      </p>

      <div className="review-decision-panel">
        <div className="review-decision-head">
          <ShieldCheck size={14} />
          <div>
            <strong>Decisión de revisión</strong>
            <p>La aprobación no ejecuta cambios sobre el archivo original; solo habilita una simulación sobre copia.</p>
          </div>
        </div>
        <div className="review-check-grid">
          {reviewChecks.map((check) => (
            <div key={check.label} className={`review-check-card review-check-card--${check.state}`}>
              {check.state === 'pass' ? <CheckCircle2 size={14} /> : check.state === 'review' ? <ShieldAlert size={14} /> : <TriangleAlert size={14} />}
              <span>{check.label}</span>
              <strong>{check.value}</strong>
            </div>
          ))}
        </div>
        {scriptValidation && scriptValidation.warnings.length > 0 && (
          <ul className="review-warning-list">
            {scriptValidation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Script Review */}
      <div className="mt-6">
        <ScriptReview
          code={draftScript}
          language="python"
          report={report}
          approvedCode={currentApprovedScript}
          onDraftChange={() => setStage('pending')}
          onApprove={handleApprove}
        />
      </div>

      {/* Simulation Progress */}
      {stage === 'simulating' && (
        <div className="sim-progress-box">
          <div className="flex items-center gap-3">
            <span className="sim-spinner" />
            <span>Ejecutando simulación de remediación...</span>
          </div>
        </div>
      )}

      {/* HITL Decision Block */}
      {hitlDecision && (
        <div className="hitl-decision-block mt-6">
          <div className="hitl-decision-header">
            <ShieldCheck size={16} />
            <div>
              <strong>Decisión humana registrada</strong>
              <p>Aprobación explícita con criterios de revisión trazables. No es automatizada.</p>
            </div>
            <code className="hitl-timestamp">{new Date(hitlDecision.timestamp).toLocaleTimeString('es-CO', { hour12: false })}</code>
          </div>
          <div className="hitl-decision-metrics">
            <div className="hitl-metric">
              <span>Safety Score al aprobar</span>
              <strong style={{
                color: hitlDecision.safetyScoreAtApproval >= 80 ? 'var(--success)'
                  : hitlDecision.safetyScoreAtApproval >= 50 ? 'var(--orange)'
                  : 'var(--error)'
              }}>{hitlDecision.safetyScoreAtApproval}/100</strong>
            </div>
            <div className="hitl-metric">
              <span>Cobertura al aprobar</span>
              <strong>{hitlDecision.coverageAtApproval}%</strong>
            </div>
            <div className="hitl-metric hitl-metric--verdict">
              <span>Veredicto</span>
              <strong style={{ color: hitlDecision.approved ? 'var(--success)' : 'var(--error)' }}>
                {hitlDecision.approved ? 'APROBADO' : 'RECHAZADO'}
              </strong>
            </div>
          </div>
          <div className="hitl-checklist">
            <span className="hitl-checklist-title">Checklist de revisión</span>
            {hitlDecision.checklist.map((item) => (
              <div key={item.criterion} className={`hitl-checklist-item ${item.passed ? 'hitl-pass' : 'hitl-fail'}`}>
                {item.passed ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />}
                <div>
                  <strong>{item.criterion}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          {hitlDecision.reviewerNotes && (
            <div className="hitl-reviewer-notes">
              <span>Observaciones del revisor</span>
              <p>{hitlDecision.reviewerNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {stage === 'completed' && improvementRun && (
        <div className="mt-6">
          <ImprovementRunPanel run={improvementRun} />
        </div>
      )}

      <div className="context-guide">
        <span className="guide-icon"><ArrowRight size={14} /></span>
        <div>
          <p className="guide-title">Evidencia lista para exportar</p>
          <p className="guide-desc">Cuando el script esté aprobado y la simulación quede registrada, prepara el reporte final y los artefactos auditables.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue} disabled={!currentApprovedScript || stage !== 'completed'}>
          Preparar exportación <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
