import { Brain, ClipboardCheck, FileCode2, FileText, Search, Terminal, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PipelineState } from './MainPipeline';
import { PIPELINE_DEVELOPMENT_MATRIX, PipelineDevelopmentMatrixRow } from '../services/pipelineDevelopmentMatrix';

const stageIcons: Record<PipelineState, LucideIcon> = {
  upload: Upload,
  profile: Search,
  diagnosis: Brain,
  diagnostic_report: ClipboardCheck,
  script: FileCode2,
  review: ClipboardCheck,
  execution: Terminal,
  export: FileText,
};

const MatrixList = ({ items }: { items: string[] }) => (
  <ul className="pipeline-matrix-list">
    {items.map((item) => <li key={item}>{item}</li>)}
  </ul>
);

const StageCell = ({ row }: { row: PipelineDevelopmentMatrixRow }) => {
  const StageIcon = stageIcons[row.state];

  return (
    <span className="pipeline-matrix-stage">
      <span className="pipeline-matrix-stage-icon"><StageIcon size={15} /></span>
      <span>
        <strong>{row.stageLabel}</strong>
        <small>{row.loop.id}</small>
      </span>
    </span>
  );
};

const PipelineDevelopmentMatrix = () => (
  <section className="pipeline-matrix" id="pipeline-development-matrix" aria-labelledby="pipeline-development-matrix-title">
    <div className="pipeline-matrix-head">
      <div>
        <p className="sec-eye">matriz de consolidacion</p>
        <h3 className="pipeline-matrix-title" id="pipeline-development-matrix-title">
          Relacion entre flujo actual, revision academica y loops de desarrollo.
        </h3>
      </div>
      <span className="pipeline-matrix-count">{PIPELINE_DEVELOPMENT_MATRIX.length} etapas</span>
    </div>

    <div
      className="pipeline-matrix-scroll"
      role="region"
      aria-label="Matriz de desarrollo por etapa AURA"
      tabIndex={0}
    >
      <table className="pipeline-matrix-table">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Lo que tenemos actualmente</th>
            <th>Requerido por la revision</th>
            <th>Fortalezas</th>
            <th>Debilidades</th>
            <th>Objetivos de desarrollo</th>
            <th>Loop y puerta E2E</th>
          </tr>
        </thead>
        <tbody>
          {PIPELINE_DEVELOPMENT_MATRIX.map((row) => (
            <tr key={row.state} data-testid={`pipeline-matrix-row-${row.state}`}>
              <th scope="row"><StageCell row={row} /></th>
              <td><MatrixList items={row.currentState} /></td>
              <td><MatrixList items={row.reviewRequirement} /></td>
              <td><MatrixList items={row.strengths} /></td>
              <td><MatrixList items={row.weaknesses} /></td>
              <td><MatrixList items={row.developmentObjectives} /></td>
              <td>
                <div className="pipeline-matrix-loop">
                  <span>{row.loop.id}</span>
                  <strong>{row.loop.title}</strong>
                  <p>{row.loop.visibleResult}</p>
                  <small>{row.loop.e2eGate}</small>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default PipelineDevelopmentMatrix;
