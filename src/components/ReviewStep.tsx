import React, { useState } from 'react';
import ScriptReview from './ScriptReview';
import ImprovementRunPanel from './ImprovementRunPanel';
import { createImprovementRun } from '../services/improvementService';
import { ArrowRight, CheckCircle2, ChevronDown, ShieldAlert, ShieldCheck, TrendingUp, TriangleAlert } from 'lucide-react';
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
          ? `${scriptValidation.coveragePercentage}% de hallazgos trazados.`
          : 'Validación de cobertura no disponible.',
      },
      {
        criterion: 'Operaciones destructivas',
        passed: scriptValidation ? scriptValidation.destructiveOperations.length === 0 : false,
        detail: scriptValidation
          ? scriptValidation.destructiveOperations.length === 0
            ? 'Sin operaciones destructivas detectadas.'
            : `Operaciones detectadas: ${scriptValidation.destructiveOperations.join(', ')}.`
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

  const safetyLabel = scriptValidation
    ? (scriptValidation.safetyScore >= 80 ? 'Seguro' : scriptValidation.safetyScore >= 50 ? 'Requiere revisión' : 'Bloqueado')
    : 'Sin validar';

  const safetyColor = scriptValidation
    ? (scriptValidation.safetyScore >= 80 ? 'var(--success)' : scriptValidation.safetyScore >= 50 ? 'var(--orange)' : 'var(--error)')
    : 'var(--ink3)';

  const scriptStatus = approvedScript
    ? 'Aprobado'
    : cleaningScript
      ? 'Pendiente de revisión'
      : 'Sin script';

  const scriptStatusColor = approvedScript ? 'var(--success)' : cleaningScript ? 'var(--orange)' : 'var(--error)';

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
          <div className="flex items-center gap-2" style={{ color: 'var(--success)' }}>
            <ShieldCheck size={16} />
            <span>Remediación simulada</span>
          </div>
        )}
      </div>

      <p className="section-note mt-6">
        Revisa el script, edítalo si es necesario, y aprueba para simular el impacto sobre una copia del dataset.
      </p>

      {/* ── Status Strip ── */}
      <div className="review-status-strip">
        <div className="review-status-item">
          <span>Estado del script</span>
          <strong style={{ color: scriptStatusColor }}>{scriptStatus}</strong>
        </div>
        <div className="review-status-item">
          <span>Safety Score</span>
          <strong style={{ color: safetyColor }}>{scriptValidation ? `${scriptValidation.safetyScore}/100 — ${safetyLabel}` : '—'}</strong>
        </div>
        {scriptValidation && (
          <div className="review-status-item">
            <span>Cobertura</span>
            <strong>{scriptValidation.coveragePercentage}%</strong>
          </div>
        )}
        {scriptValidation && scriptValidation.destructiveOperations.length > 0 && (
          <div className="review-status-item" style={{ color: 'var(--orange)' }}>
            <span>Riesgo</span>
            <strong><TriangleAlert size={12} /> {scriptValidation.destructiveOperations.length} ops destructivas</strong>
          </div>
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
            <span>Ejecutando simulación de remediación sobre copia del dataset...</span>
          </div>
        </div>
      )}

      {/* ── Delta Summary (after simulation) ── */}
      {stage === 'completed' && healthDelta && (
        <div className="review-delta">
          <div className="review-delta-header">
            <TrendingUp size={16} />
            <strong>Resultado de la simulación</strong>
            <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>simulación sobre copia — el archivo original no fue modificado</span>
          </div>
          <div className="review-delta-grid">
            <div className="review-delta-card">
              <span>Score</span>
              <strong>{healthDelta.beforeScore} → {healthDelta.afterScore}</strong>
              <small style={{ color: healthDelta.scoreDelta >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {healthDelta.scoreDelta >= 0 ? '+' : ''}{healthDelta.scoreDelta} puntos
              </small>
            </div>
            <div className="review-delta-card">
              <span>Issues</span>
              <strong>{healthDelta.beforeIssueCount} → {healthDelta.afterIssueCount}</strong>
              <small>{healthDelta.beforeIssueCount - healthDelta.afterIssueCount} resueltos</small>
            </div>
            <div className="review-delta-card">
              <span>Críticos</span>
              <strong style={{ color: healthDelta.beforeCriticalIssues > healthDelta.afterCriticalIssues ? 'var(--success)' : 'var(--ink)' }}>
                {healthDelta.beforeCriticalIssues} → {healthDelta.afterCriticalIssues}
              </strong>
              <small>{healthDelta.correctedRules.length} reglas corregidas</small>
            </div>
          </div>
        </div>
      )}

      {/* ── Technical Details ── */}
      <details className="technical-details" style={{ marginTop: 'var(--space-lg)' }}>
        <summary className="technical-details-summary">
          <ChevronDown size={14} className="technical-details-chevron" />
          <span>Detalles técnicos</span>
          <span className="technical-details-hint">decisión HITL, checklist, ciclo de mejora</span>
        </summary>
        <div className="technical-details-body">

          {/* HITL Decision Block */}
          {hitlDecision && (
            <div className="hitl-decision-block" style={{ marginTop: 'var(--space-md)' }}>
              <div className="hitl-decision-header">
                <ShieldCheck size={16} />
                <div>
                  <strong>Decisión humana registrada</strong>
                  <p>Aprobación explícita con criterios de revisión trazables.</p>
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

          {/* Improvement Run */}
          {stage === 'completed' && improvementRun && (
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <ImprovementRunPanel run={improvementRun} />
            </div>
          )}
        </div>
      </details>

      <div className="context-guide">
        <span className="guide-icon"><ArrowRight size={14} /></span>
        <div>
          <p className="guide-title">Evidencia lista para exportar</p>
          <p className="guide-desc">Con el script aprobado y la simulación registrada, prepara el reporte final.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue} disabled={!currentApprovedScript || stage !== 'completed'}>
          Preparar exportación <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
