import React from 'react';
import { Brain, Play } from 'lucide-react';

interface DiagnosisHeroPanelProps {
  findings: number;
  critical: number;
  warning: number;
  affectedColumns: number;
  hasDiagnosis: boolean;
  isLoading: boolean;
  onGenerateDiagnosis: () => void;
  onContinue: () => void;
}

export const DiagnosisHeroPanel: React.FC<DiagnosisHeroPanelProps> = ({
  findings,
  critical,
  warning,
  affectedColumns,
  hasDiagnosis,
  isLoading,
  onGenerateDiagnosis,
  onContinue,
}) => {
  return (
    <div className="diagnosis-hero-panel">
      <div className="diagnosis-hero-eyebrow">DIAGNÓSTICO ASISTIDO</div>
      <h2 className="diagnosis-hero-title">AURA interpreta los hallazgos</h2>
      <p className="diagnosis-hero-desc">
        AURA no limpia a ciegas. Primero interpreta los hallazgos del perfil y te propone una lectura accionable.
      </p>

      <div className="diagnosis-summary-strip">
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value">{findings}</span>
          <span className="diagnosis-summary-label">hallazgos</span>
        </div>
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value diagnosis-summary-value--critical">{critical}</span>
          <span className="diagnosis-summary-label">críticos</span>
        </div>
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value diagnosis-summary-value--warning">{warning}</span>
          <span className="diagnosis-summary-label">advertencias</span>
        </div>
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value">{affectedColumns}</span>
          <span className="diagnosis-summary-label">columnas</span>
        </div>
      </div>

      <div className="diagnosis-hero-actions">
        <button
          className="btn-p"
          onClick={onGenerateDiagnosis}
          disabled={isLoading}
          style={{ width: 'fit-content' }}
        >
          <Brain size={14} />
          {isLoading ? 'Diagnosticando...' : hasDiagnosis ? 'Regenerar diagnóstico' : 'Generar diagnóstico'}
        </button>
        <button
          className="btn-s"
          onClick={onContinue}
          style={{ width: 'fit-content' }}
        >
          <Play size={14} />
          Continuar con script
        </button>
      </div>
    </div>
  );
};

export default DiagnosisHeroPanel;
