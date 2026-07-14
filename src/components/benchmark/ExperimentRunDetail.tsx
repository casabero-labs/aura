import React from 'react';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';
import { OE4_INPUT_MODE_LABELS } from '../../services/benchmark/finalEvaluationProtocol';
import SyntaxDisplay from '../SyntaxDisplay';

interface ExperimentRunDetailProps {
  run: ExperimentRunV1;
  representative: boolean;
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
  awaiting_human: 'en revisión', reviewed: 'revisada', awaiting_hitl: 'decisión pendiente',
  approved: 'aprobada', rejected: 'rechazada', blocked: 'bloqueada',
  awaiting_external_output: 'esperando resultado', reaudited: 'reauditada',
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

const ExperimentRunDetail: React.FC<ExperimentRunDetailProps> = ({ run, representative }) => (
  <section className="oe4-panel oe4-run-detail" aria-labelledby="oe4-run-detail-title">
    <div className="oe4-panel-heading">
      <div>
        <p className="oe4-eyebrow">Corrida {run.sequence}</p>
        <h2 id="oe4-run-detail-title">Detalle y evidencia</h2>
      </div>
      <span className={`oe4-status oe4-status--${run.status}`}>{statusLabel[run.status]}</span>
    </div>
    <div className="oe4-run-meta">
      <div><span>Modelo</span><strong>{modelName(run.modelId)}</strong></div>
      <div><span>Entrada</span><strong>{OE4_INPUT_MODE_LABELS[run.inputMode]}</strong></div>
      <div><span>Repetición</span><strong>{run.repetition}</strong></div>
      <div><span>Representante</span><strong>{representative ? 'Sí' : 'No'}</strong></div>
    </div>
    {run.diagnosis?.status === 'failed' && (
      <div className="oe4-run-error" role="alert">
        <strong>{failurePresentation(run).title}</strong>
        <span>{failurePresentation(run).message}</span>
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
    <div className="oe4-stage-grid">
      {(['diagnosis', 'script'] as const).map((stage) => {
        const result = run[stage];
        return (
          <article key={stage}>
            <div className="oe4-stage-head">
              <h3>{stage === 'diagnosis' ? 'Diagnóstico' : 'Script'}</h3>
              <span>{stageStatusLabel(result?.status)}</span>
            </div>
            <dl>
              <div><dt>Latencia</dt><dd>{metric(result?.metrics?.totalDurationMs, ' ms')}</dd></div>
              <div><dt>Tokens salida</dt><dd>{metric(result?.metrics?.outputTokens)}</dd></div>
            </dl>
            <SyntaxDisplay
              filename={stage === 'diagnosis' ? 'diagnosis-output.json' : 'script-output.py'}
              content={result?.rawOutput || 'Sin salida registrada.'}
              maxHeight={230}
            />
          </article>
        );
      })}
    </div>
    {run.automaticEvaluation && (
      <div className="oe4-evaluation-strip">
        <div><span>F1</span><strong>{run.automaticEvaluation.diagnosis.primary.f1.toFixed(3)}</strong></div>
        <div><span>Contrato</span><strong>{run.automaticEvaluation.diagnosis.contractCompliant ? 'cumple' : 'no cumple'}</strong></div>
        <div><span>Script seguro</span><strong>{run.script ? (run.automaticEvaluation.script.safe ? 'sí' : 'no') : 'pendiente'}</strong></div>
        <div><span>Alucinaciones</span><strong>{run.automaticEvaluation.diagnosis.inventedColumns.length + run.automaticEvaluation.diagnosis.unsupportedClaims.length}</strong></div>
      </div>
    )}
  </section>
);

export default ExperimentRunDetail;
