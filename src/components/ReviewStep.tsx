import React, { useState } from 'react';
import ScriptReview from './ScriptReview';
import ImprovementRunPanel from './ImprovementRunPanel';
import { createImprovementRun } from '../services/improvementService';
import { ShieldCheck } from 'lucide-react';
import {
  AuditReport,
  AuditExecutionEvidence,
  ImprovementRun,
  HealthDelta,
  BenchmarkResult,
} from '../types';

interface ReviewStepProps {
  report: AuditReport;
  rawData: Record<string, any>[];
  csvFields: string[];
  csvDelimiter: string;
  cleaningScript: string;
  approvedScript: string;
  auditEvidence?: AuditExecutionEvidence;
  onScriptApproved?: (script: string) => void;
  onImprovementRun?: (run: ImprovementRun) => void;
  onHealthDelta?: (delta: HealthDelta) => void;
  onLog?: (stage: string, msg: string) => void;
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
  onScriptApproved,
  onImprovementRun,
  onHealthDelta,
  onLog,
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

  const runSimulation = async (script: string) => {
    setStage('simulating');
    onLog?.('review.approve', 'Script aprobado · iniciando simulación de remediación');

    try {
      // Build a minimal benchmark results array to satisfy createImprovementRun
      // In real usage, benchmarkResults would come from the previous benchmark step
      const benchmarkResults: BenchmarkResult[] = [];

      const run = createImprovementRun({
        originalData: rawData,
        fields: csvFields,
        delimiter: csvDelimiter,
        initialReport: report,
        auditEvidence,
        benchmarkResults,
        generatedScript: script,
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
          <p className="sec-eye">fase 4</p>
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
        El script de limpieza fue generado automáticamente. Revísalo completo, edítalo si hace falta, y
        apruébalo para ejecutar una simulación segura de remediación.
      </p>

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
    </div>
  );
};

export default ReviewStep;