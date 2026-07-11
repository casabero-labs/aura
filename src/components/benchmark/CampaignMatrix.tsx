import React from 'react';
import { FINAL_EVALUATION_PROTOCOL } from '../../services/benchmark/finalEvaluationProtocol';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';

interface CampaignMatrixProps {
  runs: readonly ExperimentRunV1[];
  selectedRunId: string | null;
  representativeIds: ReadonlySet<string>;
  onSelectRun: (runId: string) => void;
}

const modelName = (modelId: string): string => {
  if (modelId.includes('Qwen3-8B-GGUF')) return 'Qwen3 8B';
  if (modelId.includes('gemma-3-4b')) return 'Gemma 3 4B';
  return 'DeepSeek R1 8B';
};

const statusLabel: Record<ExperimentRunV1['status'], string> = {
  planned: 'planeada',
  running: 'ejecutando',
  completed: 'sin evaluar',
  failed: 'falló',
  awaiting_human: 'revisión',
  reviewed: 'revisada',
  awaiting_hitl: 'decisión HITL',
  approved: 'aprobada',
  rejected: 'rechazada',
  blocked: 'bloqueada',
  awaiting_external_output: 'esperando CSV',
  reaudited: 'reauditada',
};

const CampaignMatrix: React.FC<CampaignMatrixProps> = ({
  runs,
  selectedRunId,
  representativeIds,
  onSelectRun,
}) => (
  <section className="oe4-panel" aria-labelledby="oe4-matrix-title">
    <div className="oe4-panel-heading">
      <div>
        <p className="oe4-eyebrow">Matriz 3 × 3</p>
        <h2 id="oe4-matrix-title">Modelos y entradas</h2>
      </div>
      <span>{runs.length} unidades conservadas</span>
    </div>
    <div className="oe4-matrix">
      {FINAL_EVALUATION_PROTOCOL.models.flatMap((modelId) =>
        FINAL_EVALUATION_PROTOCOL.inputModes.map((inputMode) => {
          const cellRuns = runs.filter((run) => run.modelId === modelId && run.inputMode === inputMode);
          return (
            <article className="oe4-matrix-cell" data-testid="oe4-matrix-cell" key={`${modelId}:${inputMode}`}>
              <div className="oe4-matrix-cell-head">
                <div>
                  <strong>{modelName(modelId)}</strong>
                  <span>{inputMode}</span>
                </div>
                <small>{cellRuns.filter((run) => run.status !== 'planned').length}/5</small>
              </div>
              <div className="oe4-run-dots">
                {cellRuns.map((run) => (
                  <button
                    type="button"
                    key={run.runId}
                    className={`oe4-run-dot oe4-run-dot--${run.status} ${selectedRunId === run.runId ? 'is-selected' : ''}`}
                    onClick={() => onSelectRun(run.runId)}
                    aria-label={`Abrir ${run.runId}`}
                    title={`Repetición ${run.repetition}: ${statusLabel[run.status]}`}
                  >
                    {run.repetition}
                    {representativeIds.has(run.runId) && <span aria-hidden="true">R</span>}
                  </button>
                ))}
              </div>
            </article>
          );
        }),
      )}
    </div>
  </section>
);

export default CampaignMatrix;
