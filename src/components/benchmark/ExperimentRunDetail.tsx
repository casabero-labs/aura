import React from 'react';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';
import { OE4_INPUT_MODE_LABELS } from '../../services/benchmark/finalEvaluationProtocol';
import SyntaxDisplay from '../SyntaxDisplay';

interface ExperimentRunDetailProps {
  run: ExperimentRunV1;
  onDownloadFailurePackage?: () => void;
}

const metric = (value: number | null | undefined, suffix = ''): string =>
  value === null || value === undefined ? 'n/d' : `${value}${suffix}`;

const modelName = (modelId: string): string => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return 'Qwen3.5 4B';
  if (modelId.includes('gemma-4-E4B')) return 'Gemma 4 E4B';
  if (modelId.includes('SmolLM3-3B')) return 'SmolLM3 3B';
  return modelId;
};

const statusLabel: Record<ExperimentRunV1['status'], string> = {
  planned: 'planeada', running: 'en curso', completed: 'completada', failed: 'fallida',
  awaiting_human: 'válida', reviewed: 'válida', awaiting_hitl: 'válida',
  approved: 'aprobada', rejected: 'rechazada', blocked: 'bloqueada',
  awaiting_external_output: 'esperando resultado', reaudited: 'reauditada',
};

const effectiveStatusLabel = (run: ExperimentRunV1): string => {
  if (run.status === 'failed' || run.status === 'blocked') return 'fallida';
  if (run.diagnosis?.status === 'completed' && run.automaticEvaluation !== null) return 'válida';
  return statusLabel[run.status];
};

const stageStatusLabel = (status: string | undefined): string => ({
  completed: 'completado', failed: 'fallido', pending: 'pendiente',
}[status ?? 'pending'] ?? status ?? 'pendiente');

const failurePresentation = (run: ExperimentRunV1): { title: string; message: string } => {
  const code = run.diagnosis?.error?.code;
  if (code === 'DIAGNOSIS_RESPONSE_TRUNCATED') {
    return {
      title: 'Respuesta incompleta',
      message: 'El modelo alcanzó el límite de salida antes de cerrar el JSON. La corrida se conserva como fallida.',
    };
  }
  return {
    title: 'Diagnóstico no válido',
    message: 'La respuesta no superó la validación y quedó registrada para su revisión.',
  };
};

const ExperimentRunDetail: React.FC<ExperimentRunDetailProps> = ({
  run,
  onDownloadFailurePackage,
}) => (
  <section className="oe4-panel oe4-run-detail" aria-labelledby="oe4-run-detail-title">
    <div className="oe4-panel-heading">
      <div>
        <p className="oe4-eyebrow">Corrida {run.sequence}</p>
        <h2 id="oe4-run-detail-title">Detalle y evidencia</h2>
      </div>
      <span className={`oe4-status ${run.status === 'failed' || run.status === 'blocked'
        ? 'oe4-status--failed'
        : run.diagnosis?.status === 'completed' && run.automaticEvaluation !== null
          ? 'oe4-status--completed'
          : `oe4-status--${run.status}`}`}>{effectiveStatusLabel(run)}</span>
    </div>
    <div className="oe4-run-meta">
      <div><span>Modelo</span><strong>{modelName(run.modelId)}</strong></div>
      <div><span>Entrada</span><strong>{OE4_INPUT_MODE_LABELS[run.inputMode]}</strong></div>
      <div><span>Repetición</span><strong>{run.repetition}</strong></div>
      <div><span>Resultado</span><strong>{run.automaticEvaluation ? 'Score automático' : run.status === 'failed' ? 'Fallo conservado' : 'Pendiente'}</strong></div>
    </div>
    {run.diagnosis?.status === 'failed' && (
      <div className="oe4-run-error" role="alert">
        <strong>{failurePresentation(run).title}</strong>
        <span>{failurePresentation(run).message}</span>
        {onDownloadFailurePackage && (
          <button type="button" className="btn-s btn-sm" onClick={onDownloadFailurePackage}>
            Descargar expediente del fallo (.zip)
          </button>
        )}
      </div>
    )}
    <details className="oe4-run-technical">
      <summary>Trazabilidad técnica</summary>
      <dl>
        <div><dt>Modelo solicitado</dt><dd>{run.modelId}</dd></div>
        <div><dt>Anclaje</dt><dd>{run.input.evidenceEnvelopeRef}</dd></div>
        {run.executionReceipt && (
          <>
            <div><dt>Recibo</dt><dd>{run.executionReceipt.receiptHash}</dd></div>
            <div><dt>Entrada</dt><dd>{run.executionReceipt.inputHash}</dd></div>
            <div><dt>Modelo observado</dt><dd>{run.executionReceipt.observedModel}</dd></div>
          </>
        )}
        {run.diagnosis?.status === 'failed' && (
          <>
            <div><dt>Código</dt><dd>{run.diagnosis.error?.code ?? 'DIAGNOSIS_FAILED'}</dd></div>
            <div><dt>Detalle</dt><dd>{run.diagnosis.error?.message ?? 'El diagnóstico no pudo validarse.'}</dd></div>
          </>
        )}
      </dl>
      {run.diagnosis?.status === 'failed' && run.diagnosis.validationErrors.length > 0 && (
        <ul>
          {run.diagnosis.validationErrors.map((entry, index) => (
            <li key={`${entry.code}:${entry.path}:${index}`}>{entry.code}: {entry.message}</li>
          ))}
        </ul>
      )}
    </details>
    <div className="oe4-stage-grid oe4-stage-grid--diagnosis-only">
      {(() => {
        const result = run.diagnosis;
        return (
          <article>
            <div className="oe4-stage-head">
              <h3>Diagnóstico LLM</h3>
              <span>{stageStatusLabel(result?.status)}</span>
            </div>
            <dl>
              <div><dt>Latencia</dt><dd>{metric(result?.metrics?.totalDurationMs, ' ms')}</dd></div>
              <div><dt>Tokens salida</dt><dd>{metric(result?.metrics?.outputTokens)}</dd></div>
            </dl>
            <SyntaxDisplay
              filename="diagnosis-output.json"
              content={result?.rawOutput || 'Sin salida registrada.'}
              maxHeight={230}
            />
          </article>
        );
      })()}
    </div>
    {run.automaticEvaluation && (
      <div className="oe4-evaluation-strip">
        <div><span>Precisión</span><strong>{run.automaticEvaluation.diagnosis.primary.precision.toFixed(3)}</strong></div>
        <div><span>Recall</span><strong>{run.automaticEvaluation.diagnosis.primary.recall.toFixed(3)}</strong></div>
        <div><span>F1</span><strong>{run.automaticEvaluation.diagnosis.primary.f1.toFixed(3)}</strong></div>
        <div><span>Contrato</span><strong>{run.automaticEvaluation.diagnosis.contractCompliant ? 'cumple' : 'no cumple'}</strong></div>
        <div><span>Evidencia</span><strong>{run.automaticEvaluation.diagnosis.evidenceFidelity === null ? 'n/a' : run.automaticEvaluation.diagnosis.evidenceFidelity.toFixed(3)}</strong></div>
        <div><span>Anclaje</span><strong>{run.automaticEvaluation.diagnosis.anchoringScore.toFixed(3)}</strong></div>
        <div><span>Alucinaciones</span><strong>{run.automaticEvaluation.diagnosis.inventedColumns.length + run.automaticEvaluation.diagnosis.unsupportedClaims.length}</strong></div>
      </div>
    )}
  </section>
);

export default ExperimentRunDetail;
