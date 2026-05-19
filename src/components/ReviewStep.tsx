import React, { useState } from 'react';
import ScriptReview from './ScriptReview';
import ImprovementRunPanel from './ImprovementRunPanel';
import { createImprovementRun } from '../services/improvementService';
import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  AuditReport,
  AuditExecutionEvidence,
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

  const handleApprove = (script: string) => {
    setCurrentApprovedScript(script);
    onScriptApproved?.(script);
    runSimulation(script);
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
      value: scriptValidation ? `${scriptValidation.coveredIssueIds.length} hallazgos` : 'sin validar',
      state: scriptValidation && scriptValidation.coveredIssueIds.length > 0 ? 'pass' : 'warn',
    },
    {
      label: 'riesgo',
      value: scriptValidation?.requiresHumanReview ? 'requiere criterio' : 'sin alertas',
      state: scriptValidation?.requiresHumanReview ? 'review' : 'pass',
    },
    {
      label: 'simulación',
      value: stage === 'completed' ? 'registrada' : stage === 'simulating' ? 'en curso' : 'pendiente',
      state: stage === 'completed' ? 'pass' : 'review',
    },
  ];

  const runSimulation = async (script: string) => {
    setStage('simulating');
    onLog?.('review.approve', 'Script aprobado · iniciando simulación de remediación');

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
          <div className="flex items-center gap-2 text-[var(--success)]">
            <ShieldCheck size={16} />
            <span className="text-sm">Remediación simulada</span>
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
        <div className="mt-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
            <span>Ejecutando simulación de remediación...</span>
          </div>
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
