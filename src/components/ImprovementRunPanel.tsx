import { Download, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { ImprovementRun } from '../types';

interface ImprovementRunPanelProps {
  run: ImprovementRun;
}

const downloadJson = (run: ImprovementRun) => {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aura_improvement_run_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const ImprovementRunPanel = ({ run }: ImprovementRunPanelProps) => {
  const delta = run.healthDelta;
  const recommended = run.benchmarkResults.find((result) => result.recommendedForRemediation);
  const simulatedActions = run.remediationActions.filter((action) => action.safeToSimulate);
  const reviewActions = run.remediationActions.filter((action) => !action.safeToSimulate);

  return (
    <section className="section improvement-panel" id="mejora">
      <div className="section-header">
        <div>
          <p className="sec-eye">ciclo de mejora</p>
          <h2 className="sec-title">Mejora guiada por evidencia.</h2>
        </div>
        <button className="btn-s" onClick={() => downloadJson(run)}>
          <Download size={14} /> Exportar evidencia
        </button>
      </div>

      <div className="improvement-grid">
        <div className="improvement-card improvement-card-strong">
          <span className="benchmark-icon"><TrendingUp size={18} /></span>
          <p>Delta de salud</p>
          <strong>{delta ? `${delta.beforeScore} → ${delta.afterScore}` : '-'}</strong>
          <small>{delta ? `${delta.scoreDelta >= 0 ? '+' : ''}${delta.scoreDelta} puntos` : 'sin simulación'}</small>
        </div>
        <div className="improvement-card">
          <span className="benchmark-icon"><ShieldCheck size={18} /></span>
          <p>Modelo recomendado</p>
          <strong>{recommended ? recommended.model : 'Pendiente'}</strong>
          <small>{recommended ? `${recommended.providerType} · ${recommended.evidenceStatus}` : 'requiere benchmark válido'}</small>
        </div>
        <div className="improvement-card">
          <span className="benchmark-icon"><AlertTriangle size={18} /></span>
          <p>Revisión humana</p>
          <strong>{reviewActions.length}</strong>
          <small>{run.scriptValidation?.requiresHumanReview ? 'script requiere revisión' : 'script sin alertas estructurales'}</small>
        </div>
      </div>

      <div className="improvement-details">
        <div>
          <h3>Acciones simuladas</h3>
          <ul>
            {simulatedActions.length === 0 && <li>No hay acciones seguras para simular.</li>}
            {simulatedActions.slice(0, 6).map((action) => (
              <li key={action.id}>{action.description}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Evidencia posterior</h3>
          <ul>
            <li>Issues: {delta ? `${delta.beforeIssueCount} → ${delta.afterIssueCount}` : '-'}</li>
            <li>Críticos: {delta ? `${delta.beforeCriticalIssues} → ${delta.afterCriticalIssues}` : '-'}</li>
            <li>Reglas corregidas: {delta?.correctedRules.length ?? 0}</li>
            <li>Estado: {run.evidenceStatus}</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default ImprovementRunPanel;
