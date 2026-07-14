import React from 'react';
import {
  FINAL_EVALUATION_PROTOCOL,
  OE4_INPUT_MODE_LABELS,
} from '../../services/benchmark/finalEvaluationProtocol';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';

interface CampaignMatrixProps {
  runs: readonly ExperimentRunV1[];
  selectedRunId: string | null;
  activeRunId?: string | null;
  onSelectRun: (runId: string) => void;
}

const modelName = (modelId: string): string => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return 'Qwen3.5 4B';
  if (modelId.includes('gemma-4-E4B')) return 'Gemma 4 E4B';
  return 'SmolLM3 3B';
};

const CampaignMatrix: React.FC<CampaignMatrixProps> = ({
  runs,
  selectedRunId,
  activeRunId = null,
  onSelectRun,
}) => {
  const visualState = (run: ExperimentRunV1): 'planned' | 'running' | 'success' | 'failed' => {
    if (activeRunId === run.runId || run.status === 'running') return 'running';
    if (run.status === 'failed' || run.status === 'blocked') return 'failed';
    if (run.diagnosis?.status === 'completed' && run.automaticEvaluation !== null) return 'success';
    return 'planned';
  };
  return (
  <section className="oe4-panel" aria-labelledby="oe4-matrix-title">
    <div className="oe4-panel-heading">
      <div>
        <p className="oe4-eyebrow">Matriz 3 × 3</p>
        <h2 id="oe4-matrix-title">Modelos y entradas</h2>
      </div>
      <span>{runs.length} unidades conservadas</span>
    </div>
    <div className="oe4-matrix-legend" aria-label="Leyenda de estados">
      <span><i className="is-success" />Válida</span>
      <span><i className="is-failed" />Fallida</span>
      <span><i className="is-planned" />Pendiente</span>
      <span><i className="is-selected" />Seleccionada</span>
    </div>
    <div className="oe4-matrix">
      {FINAL_EVALUATION_PROTOCOL.models.flatMap((modelId) =>
        FINAL_EVALUATION_PROTOCOL.inputModes.map((inputMode) => {
          const cellRuns = runs.filter((run) => run.modelId === modelId && run.inputMode === inputMode);
          const attemptedRuns = cellRuns.filter((run) => run.status !== 'planned').length;
          const validRuns = cellRuns.filter((run) => visualState(run) === 'success').length;
          const failedRuns = cellRuns.filter((run) => visualState(run) === 'failed').length;
          const cellState = attemptedRuns === FINAL_EVALUATION_PROTOCOL.repetitions
            ? failedRuns === 0 ? 'success' : validRuns === 0 ? 'failed' : 'mixed'
            : 'pending';
          return (
            <article className={`oe4-matrix-cell oe4-matrix-cell--${cellState}`} data-testid="oe4-matrix-cell" key={`${modelId}:${inputMode}`}>
              <div className="oe4-matrix-cell-head">
                <div>
                  <strong>{modelName(modelId)}</strong>
                  <span>{OE4_INPUT_MODE_LABELS[inputMode]}</span>
                </div>
                <small>{attemptedRuns}/{FINAL_EVALUATION_PROTOCOL.repetitions} intentadas · {validRuns} válidas{failedRuns > 0 ? ` · ${failedRuns} fallidas` : ''}</small>
              </div>
              <div className="oe4-run-dots">
                {cellRuns.map((run) => (
                  <button
                    type="button"
                    key={run.runId}
                    className={`oe4-run-dot oe4-run-dot--${visualState(run)} ${selectedRunId === run.runId ? 'is-selected' : ''} ${activeRunId === run.runId ? 'is-running' : ''}`}
                    onClick={() => onSelectRun(run.runId)}
                    aria-label={`Abrir ${run.runId}`}
                    title={`Repetición ${run.repetition}: ${activeRunId === run.runId
                      ? 'ejecutándose'
                      : visualState(run) === 'success'
                        ? 'válida y evaluada automáticamente'
                        : visualState(run) === 'failed' ? 'fallida' : 'pendiente'}`}
                  >
                    {run.repetition}
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
};

export default CampaignMatrix;
