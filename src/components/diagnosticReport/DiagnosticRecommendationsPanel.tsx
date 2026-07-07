import type { DiagnosticRecommendation } from '../../services/diagnosticReport';

interface DiagnosticRecommendationsPanelProps {
  recommendations: DiagnosticRecommendation[];
}

const priorityLabels: Record<DiagnosticRecommendation['priority'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const actionLabels: Record<DiagnosticRecommendation['actionType'], string> = {
  inspect: 'Inspeccionar',
  document: 'Documentar',
  transform_optional: 'Transformación opcional',
  generate_script_optional: 'Generar script opcional',
  do_not_auto_fix: 'No corregir automáticamente',
};

const boolLabel = (value: boolean) => (value ? 'Sí' : 'No');

const DiagnosticRecommendationsPanel = ({ recommendations }: DiagnosticRecommendationsPanelProps) => (
  <section className="diagnostic-report-section" data-testid="diagnostic-report-recommendations">
    <div className="diagnostic-report-section-head">
      <div>
        <p className="sec-eye">recomendaciones</p>
        <h3>Recomendaciones</h3>
      </div>
      <span className="diagnostic-report-badge">{recommendations.length}</span>
    </div>

    {recommendations.length === 0 ? (
      <p className="diagnostic-report-empty">No hay recomendaciones adicionales.</p>
    ) : (
      <div className="diagnostic-recommendation-list">
        {recommendations.map((recommendation) => (
          <article className="diagnostic-recommendation-card" key={recommendation.id}>
            <div className="diagnostic-recommendation-head">
              <div>
                <span className="diagnostic-report-kicker">Prioridad {priorityLabels[recommendation.priority]}</span>
                <h4>{recommendation.title}</h4>
              </div>
              <span className="diagnostic-report-badge">{actionLabels[recommendation.actionType]}</span>
            </div>
            <p>{recommendation.rationale}</p>
            <div className="diagnostic-report-tag-row">
              <span>Requiere script: {boolLabel(recommendation.requiresScript)}</span>
              <span>Requiere HITL: {boolLabel(recommendation.requiresHITL)}</span>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);

export default DiagnosticRecommendationsPanel;
