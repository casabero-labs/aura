import { ArrowRight, CheckCircle2, CircleDashed, ClipboardCheck, FlaskConical, LockKeyhole, PlayCircle, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { buildDevelopmentLoopProgram, DevelopmentLoop, LoopStatus } from '../services/developmentLoops';
import type { PipelineData } from './MainPipeline';
import PipelineDevelopmentMatrix from './PipelineDevelopmentMatrix';

interface DevelopmentLoopsPanelProps {
  pipelineData: PipelineData;
}

const statusLabels: Record<LoopStatus, string> = {
  done: 'cerrado',
  active: 'en curso',
  blocked: 'bloqueado',
  planned: 'pendiente',
};

const statusIcons: Record<LoopStatus, ReactNode> = {
  done: <CheckCircle2 size={14} />,
  active: <PlayCircle size={14} />,
  blocked: <LockKeyhole size={14} />,
  planned: <CircleDashed size={14} />,
};

const loopIcon = (loop: DevelopmentLoop) => {
  if (loop.id === 'loop-03') return <FlaskConical size={16} />;
  if (loop.id === 'loop-04') return <ShieldCheck size={16} />;
  if (loop.id === 'loop-05') return <ClipboardCheck size={16} />;
  return <ArrowRight size={16} />;
};

const DevelopmentLoopsPanel = ({ pipelineData }: DevelopmentLoopsPanelProps) => {
  const program = buildDevelopmentLoopProgram({
    hasReport: Boolean(pipelineData.report),
    hasBenchmarkResults: pipelineData.benchmarkResults.length > 0,
    hasApprovedScript: Boolean(pipelineData.approvedScript),
    hasImprovementRun: Boolean(pipelineData.improvementRun),
    isExportStep: pipelineData.state === 'export',
  });

  return (
    <section className="dev-loops" id="development-loops" aria-labelledby="development-loops-title">
      <div className="section-header">
        <div>
          <p className="sec-eye">loop engineering</p>
          <h2 className="sec-title" id="development-loops-title">Fases visibles para terminar AURA.</h2>
          <p className="sec-desc">
            Cada fase debe cerrar con evidencia exportable y una prueba E2E del flujo humano.
          </p>
        </div>
        <div className={`dev-loop-next dev-loop-next--${program.nextLoop.status}`}>
          <span>proximo loop</span>
          <strong>{program.nextLoop.title}</strong>
        </div>
      </div>

      <div className="dev-loop-intent" aria-label="Direccion de producto AURA">
        <div>
          <p className="dev-loop-kicker">Tenemos</p>
          {program.has.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div>
          <p className="dev-loop-kicker">Queremos</p>
          {program.wants.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div>
          <p className="dev-loop-kicker">Debemos hacer</p>
          {program.mustDo.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>

      <div className="dev-loop-grid">
        {program.loops.map((loop) => (
          <article className={`dev-loop-card dev-loop-card--${loop.status}`} key={loop.id}>
            <div className="dev-loop-card-top">
              <span className="dev-loop-icon">{loopIcon(loop)}</span>
              <span className={`dev-loop-status dev-loop-status--${loop.status}`}>
                {statusIcons[loop.status]} {statusLabels[loop.status]}
              </span>
            </div>
            <p className="dev-loop-phase">{loop.phase}</p>
            <h3>{loop.title}</h3>
            <p>{loop.objective}</p>
            <dl>
              <div>
                <dt>Resultado visible</dt>
                <dd>{loop.visibleResult}</dd>
              </div>
              <div>
                <dt>E2E gate</dt>
                <dd>{loop.e2eGate}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <PipelineDevelopmentMatrix />
    </section>
  );
};

export default DevelopmentLoopsPanel;
