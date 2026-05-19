import { ArrowRight, Check, ClipboardCheck, Download, FileCode2, Gauge, GitCompare, RotateCcw } from 'lucide-react';
import { AuditExecutionEvidence, AuditReport, BenchmarkResult, ImprovementRun } from '../types';

interface EvidenceCyclePanelProps {
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  benchmarkResults: BenchmarkResult[];
  improvementRun?: ImprovementRun | null;
  hasApprovedScript: boolean;
  hasGeneratedScript: boolean;
  hasExported: boolean;
  onGoBenchmark: () => void;
  onGoScript: () => void;
  onGoExport: () => void;
}

const statusClass = (done: boolean, active: boolean) =>
  done ? 'done' : active ? 'active' : 'pending';

const statusText = (done: boolean, active: boolean) =>
  done ? 'cerrado' : active ? 'actual' : 'pendiente';

const EvidenceCyclePanel = ({
  report,
  auditEvidence,
  benchmarkResults,
  improvementRun,
  hasApprovedScript,
  hasGeneratedScript,
  hasExported,
  onGoBenchmark,
  onGoScript,
  onGoExport,
}: EvidenceCyclePanelProps) => {
  const validRuns = benchmarkResults.filter((result) => result.evidenceStatus !== 'attempted_failed');
  const failedRuns = benchmarkResults.filter((result) => result.evidenceStatus === 'attempted_failed');
  const recommended = improvementRun?.recommendedResult;
  const hasDelta = Boolean(improvementRun?.healthDelta);

  const stages = [
    {
      id: 'audit',
      icon: <ClipboardCheck size={15} />,
      title: 'Diagnostico determinista',
      body: `${report.issues.length} hallazgos, score ${report.score}/100, fingerprint ${auditEvidence?.datasetFingerprint || 'pendiente'}.`,
      done: true,
      active: false,
    },
    {
      id: 'benchmark',
      icon: <GitCompare size={15} />,
      title: 'Benchmark local/cloud',
      body: benchmarkResults.length
        ? `${validRuns.length} corridas utiles, ${failedRuns.length} intentos invalidos.`
        : 'Compara proveedores con la misma evidencia determinista.',
      done: benchmarkResults.length > 0,
      active: benchmarkResults.length === 0,
    },
    {
      id: 'strategy',
      icon: <Gauge size={15} />,
      title: 'Seleccion de estrategia',
      body: recommended
        ? `${recommended.providerType} · ${recommended.model} · ${recommended.inputMode}.`
        : 'La recomendacion solo aparece si hay salida valida y script revisable.',
      done: Boolean(recommended),
      active: benchmarkResults.length > 0 && !recommended,
    },
    {
      id: 'script',
      icon: <FileCode2 size={15} />,
      title: 'Script HITL',
      body: hasApprovedScript
        ? 'Script aprobado por revision humana.'
        : hasGeneratedScript
          ? 'Script generado; falta aprobacion humana.'
          : 'Genera o revisa el tratamiento antes de exportarlo.',
      done: hasApprovedScript,
      active: hasGeneratedScript && !hasApprovedScript,
    },
    {
      id: 'reaudit',
      icon: <RotateCcw size={15} />,
      title: 'Simulacion y re-auditoria',
      body: hasDelta
        ? `${improvementRun!.healthDelta!.beforeScore} -> ${improvementRun!.healthDelta!.afterScore} (${improvementRun!.healthDelta!.scoreDelta >= 0 ? '+' : ''}${improvementRun!.healthDelta!.scoreDelta}).`
        : 'AURA simula acciones seguras y vuelve a pasar el motor.',
      done: hasDelta,
      active: benchmarkResults.length > 0 && !hasDelta,
    },
    {
      id: 'export',
      icon: <Download size={15} />,
      title: 'Evidencia exportable',
      body: hasExported
        ? 'El ciclo ya produjo artefactos descargables.'
        : 'Exporta JSON, PDF, issues y script aprobado cuando aplique.',
      done: hasExported,
      active: hasDelta && !hasExported,
    },
  ];

  return (
    <section className="section evidence-cycle" id="ciclo">
      <div className="section-header">
        <div>
          <p className="sec-eye">flujo posterior al motor</p>
          <h2 className="sec-title">Ciclo unico de evidencia.</h2>
        </div>
        <div className="cycle-actions">
          <button className="btn-p" onClick={onGoBenchmark}>
            Benchmark <ArrowRight size={12} />
          </button>
          <button className="btn-s" onClick={onGoScript}>
            Script <ArrowRight size={12} />
          </button>
          <button className="btn-s" onClick={onGoExport}>
            Exportar <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <div className="cycle-map">
        {stages.map((stage, index) => (
          <div className={`cycle-step cycle-step-${statusClass(stage.done, stage.active)}`} key={stage.id}>
            <div className="cycle-step-top">
              <span className="cycle-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="cycle-icon">{stage.done ? <Check size={15} /> : stage.icon}</span>
              <span className="cycle-state">{statusText(stage.done, stage.active)}</span>
            </div>
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EvidenceCyclePanel;
