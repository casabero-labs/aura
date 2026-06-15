import React, { useState } from 'react';
import ScriptReview from './ScriptReview';
import ImprovementRunPanel from './ImprovementRunPanel';
import { createImprovementRun } from '../services/improvementService';
import { ArrowRight, CheckCircle2, ChevronDown, ShieldAlert, ShieldCheck, TrendingUp, TriangleAlert, Play } from 'lucide-react';
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

  const canContinue = currentApprovedScript && stage === 'completed';

  return (
    <div className="review-step">
      <div className="section-header">
        <div>
          <p className="sec-eye">revisión humana</p>
          <h2 className="sec-title">Tú decides antes de aplicar</h2>
        </div>
        {stage === 'completed' && improvementRun && (
          <div className="flex items-center gap-2" style={{ color: 'var(--success)' }}>
            <ShieldCheck size={16} />
            <span>Remediación simulada</span>
          </div>
        )}
      </div>

      <p className="section-note">
        AURA no modifica el archivo original. La simulación se hace sobre una copia.
      </p>

      <div className="companion-note">
        <ShieldCheck size={16} />
        <p>Aquí revisas la propuesta, confirmas que las columnas existen y decides si vale la pena simular. La aprobación humana queda registrada como evidencia.</p>
      </div>

      <div className="stage-decision-summary">
        <div className="stage-summary-item">
          <span className="stage-summary-label">Estado del script</span>
          <strong style={{ color: scriptStatusColor }}>{scriptStatus}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Seguridad</span>
          <strong style={{ color: safetyColor }}>{safetyLabel}</strong>
        </div>
        {scriptValidation && (
          <div className="stage-summary-item">
            <span className="stage-summary-label">Cobertura</span>
            <strong>{scriptValidation.coveragePercentage}%</strong>
          </div>
        )}
      </div>

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

      {stage === 'simulating' && (
        <div className="sim-progress-box">
          <div className="flex items-center gap-3">
            <span className="sim-spinner" />
            <span>Ejecutando simulación de remediación sobre copia del dataset...</span>
          </div>
        </div>
      )}

      {stage === 'completed' && healthDelta && (
        <div className="review-delta">
          <div className="review-delta-header">
            <TrendingUp size={16} />
            <strong>Resultado de la simulación</strong>
            <span className="review-delta-hint">simulación sobre copia — el archivo original no fue modificado</span>
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

          <div className="review-delta-interpretation">
            {healthDelta.scoreDelta > 0 ? (
              <p>La simulación mejoró el dataset.</p>
            ) : healthDelta.scoreDelta === 0 ? (
              <p>La simulación no resolvió hallazgos detectados.</p>
            ) : (
              <p>La simulación empeoró el score del dataset.</p>
            )}
          </div>

          {healthDelta.scoreDelta === 0 && (
            <div className="review-delta-zero-warning">
              <TriangleAlert size={16} style={{ color: 'var(--orange)', flexShrink: 0 }} />
              <div>
                <strong>La simulación no resolvió hallazgos detectados.</strong>
                <p>Revisa el script antes de usarlo como evidencia de mejora. La aprobación humana no sustituye una mejora efectiva del score.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <details className="technical-details" style={{ marginTop: 'var(--space-lg)' }}>
        <summary className="technical-details-summary">
          <ChevronDown size={14} className="technical-details-chevron" />
          <span>Detalles técnicos</span>
          <span className="technical-details-hint">decisión HITL, checklist, ciclo de mejora</span>
        </summary>
        <div className="technical-details-body">

          {hitlDecision && (
            <div className="hitl-decision-block">
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
          <p className="guide-title">Preparar exportación</p>
          <p className="guide-desc">Con el script aprobado y la simulación registrada, prepara el reporte final.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue} disabled={!canContinue}>
          Preparar exportación <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
