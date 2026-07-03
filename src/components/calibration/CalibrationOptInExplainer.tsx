import React from 'react';

export interface CalibrationOptInExplainerProps {
  disabledReason?: string;
  benchmarkCount?: number;
  onContinueStandardFlow: () => void;
  onStartCalibration: () => void;
}

const CalibrationOptInExplainer: React.FC<CalibrationOptInExplainerProps> = ({
  disabledReason,
  benchmarkCount = 0,
  onContinueStandardFlow,
  onStartCalibration,
}) => {
  const isDisabled = Boolean(disabledReason);

  return (
    <section className="section" data-testid="calibration-opt-in-explainer">
      <div className="section-header">
        <div>
          <p className="sec-eye">opcional</p>
          <h2 className="sec-title">Comparar modelos antes del diagnóstico</h2>
        </div>
      </div>

      <p className="section-note">
        AURA no necesita esta comparación para funcionar. El flujo principal sigue siendo: perfilar el dataset,
        generar diagnóstico, proponer script, revisar humanamente y preparar evidencia.
      </p>

      <div className="companion-note" data-testid="calibration-main-flow-reminder">
        <p>
          La calibración experimental solo compara configuraciones sobre el mismo perfil determinista. Puede ayudar a
          escoger un candidato observado, pero no convierte la corrida en benchmark formal ni prueba que un modelo sea
          el mejor de manera universal.
        </p>
      </div>

      <div className="stage-decision-summary" data-testid="calibration-boundaries">
        <div className="stage-summary-item">
          <span className="stage-summary-label">Qué hace</span>
          <strong>Compara candidatos</strong>
          <p>Proveedor, modelo, temperatura y modo de entrada sobre la misma evidencia.</p>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Qué no hace</span>
          <strong>No corrige el dataset</strong>
          <p>La limpieza requiere script revisado y reauditoría posterior.</p>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Evidencia</span>
          <strong>{benchmarkCount > 0 ? `${benchmarkCount} corrida(s)` : 'Sin corridas'}</strong>
          <p>Los resultados se clasifican como planned, attempted_failed, preliminary_valid o formal_valid.</p>
        </div>
      </div>

      {isDisabled && (
        <div className="provider-unavailable-notice" data-testid="calibration-disabled-reason">
          <div className="provider-unavailable-header">
            <strong>Calibración no disponible en este momento</strong>
          </div>
          <ul className="provider-unavailable-reasons">
            <li>{disabledReason}</li>
          </ul>
        </div>
      )}

      <div className="stage-actions" data-testid="calibration-opt-in-actions">
        <button className="btn-p btn-sm" onClick={onContinueStandardFlow}>
          Continuar diagnóstico normal
        </button>
        <button className="btn-s btn-sm" onClick={onStartCalibration} disabled={isDisabled}>
          Activar comparación experimental
        </button>
      </div>
    </section>
  );
};

export default CalibrationOptInExplainer;
