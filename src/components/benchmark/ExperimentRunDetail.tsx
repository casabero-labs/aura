import React from 'react';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';

interface ExperimentRunDetailProps {
  run: ExperimentRunV1;
  representative: boolean;
}

const metric = (value: number | null | undefined, suffix = ''): string =>
  value === null || value === undefined ? 'n/d' : `${value}${suffix}`;

const ExperimentRunDetail: React.FC<ExperimentRunDetailProps> = ({ run, representative }) => (
  <section className="oe4-panel oe4-run-detail" aria-labelledby="oe4-run-detail-title">
    <div className="oe4-panel-heading">
      <div>
        <p className="oe4-eyebrow">Corrida {run.sequence}</p>
        <h2 id="oe4-run-detail-title">Detalle y evidencia</h2>
      </div>
      <span className={`oe4-status oe4-status--${run.status}`}>{run.status}</span>
    </div>
    <div className="oe4-run-meta">
      <div><span>Modelo</span><strong>{run.modelId}</strong></div>
      <div><span>Entrada</span><strong>{run.inputMode}</strong></div>
      <div><span>Repetición</span><strong>{run.repetition}</strong></div>
      <div><span>Representante</span><strong>{representative ? 'Sí' : 'No'}</strong></div>
    </div>
    <p className="oe4-anchor"><strong>Anclaje:</strong> {run.input.evidenceEnvelopeRef}</p>
    {run.executionReceipt && (
      <p className="oe4-anchor">
        <strong>Recibo verificable:</strong> {run.executionReceipt.receiptHash}
        {' · '}entrada {run.executionReceipt.inputHash}
        {' · '}modelo observado {run.executionReceipt.observedModel}
      </p>
    )}
    <div className="oe4-stage-grid">
      {(['diagnosis', 'script'] as const).map((stage) => {
        const result = run[stage];
        return (
          <article key={stage}>
            <div className="oe4-stage-head">
              <h3>{stage === 'diagnosis' ? 'Diagnóstico' : 'Script'}</h3>
              <span>{result?.status ?? 'pendiente'}</span>
            </div>
            <dl>
              <div><dt>Latencia</dt><dd>{metric(result?.metrics?.totalDurationMs, ' ms')}</dd></div>
              <div><dt>Tokens salida</dt><dd>{metric(result?.metrics?.outputTokens)}</dd></div>
            </dl>
            <pre>{result?.rawOutput || 'Sin salida registrada.'}</pre>
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
