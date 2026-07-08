import React from 'react';
import { Brain, Settings, ChevronDown } from 'lucide-react';

interface DiagnosisHeroPanelProps {
  fileName: string;
  rowCount: number;
  colCount: number;
  findings: number;
  hasDiagnosis: boolean;
  isLoading: boolean;
  onGenerateDiagnosis: () => void;
  providerName: string;
  providerAvailable: boolean | null;
  showConfig: boolean;
  onToggleConfig: () => void;
}

export const DiagnosisHeroPanel: React.FC<DiagnosisHeroPanelProps> = ({
  fileName,
  rowCount,
  colCount,
  findings,
  hasDiagnosis,
  isLoading,
  onGenerateDiagnosis,
  providerName,
  providerAvailable,
  showConfig,
  onToggleConfig,
}) => {
  return (
    <div className="diagnosis-hero-panel" data-testid="diagnosis-hero-panel">
      <div className="diagnosis-hero-eyebrow">DIAGNÓSTICO ASISTIDO</div>
      <h2 className="diagnosis-hero-title">Diagnóstico asistido</h2>
      <p className="diagnosis-hero-desc">
        AURA interpretará los hallazgos del perfil base y generará una lectura contextual del estado del dataset.
      </p>

      {/* Tira/resumen compacto del dataset */}
      <div className="diagnosis-summary-strip">
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value" style={{ fontSize: '15px', wordBreak: 'break-all' }}>{fileName || 'Archivo sin nombre'}</span>
          <span className="diagnosis-summary-label">archivo</span>
        </div>
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value">{rowCount.toLocaleString('es-CO')}</span>
          <span className="diagnosis-summary-label">filas</span>
        </div>
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value">{colCount}</span>
          <span className="diagnosis-summary-label">columnas</span>
        </div>
        <div className="diagnosis-summary-item">
          <span className="diagnosis-summary-value diagnosis-summary-value--critical">{findings}</span>
          <span className="diagnosis-summary-label">hallazgos</span>
        </div>
      </div>

      {/* Bloque pequeño de proveedor activo */}
      <div className="diagnosis-active-mode" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="diagnosis-active-mode-left">
          <span className="diagnosis-active-mode-provider" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Settings size={12} />
            <span>Proveedor: {providerName}</span>
          </span>
          <span className="diagnosis-active-mode-sep" />
          <span className="diagnosis-active-mode-status" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {providerAvailable === true && (
              <>
                <span className="status-dot status-dot--ready" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                <span style={{ color: 'var(--success)', fontWeight: 500 }}>(Disponible)</span>
              </>
            )}
            {providerAvailable === false && (
              <>
                <span className="status-dot status-dot--error" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--error)' }} />
                <span style={{ color: 'var(--error)', fontWeight: 500 }}>(No disponible)</span>
              </>
            )}
            {providerAvailable === null && (
              <>
                <span className="status-dot status-dot--checking" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ink3)' }} />
                <span style={{ color: 'var(--ink3)' }}>(Verificando...)</span>
              </>
            )}
          </span>
        </div>
        <button
          className="diagnosis-active-mode-config-btn btn-s btn-sm"
          onClick={onToggleConfig}
          data-testid="diagnosis-config-toggle"
          type="button"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Settings size={11} />
          <span>{showConfig ? 'Ocultar configuración' : 'Cambiar configuración'}</span>
          <ChevronDown size={11} className={`activity-console-chevron ${showConfig ? 'activity-console-chevron--open' : ''}`} />
        </button>
      </div>

      {/* Único CTA primario prominente */}
      <div className="diagnosis-hero-actions">
        <button
          className="btn-p"
          onClick={onGenerateDiagnosis}
          disabled={isLoading || providerAvailable === false}
          style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}
          type="button"
        >
          <Brain size={14} />
          {isLoading ? 'Diagnosticando...' : hasDiagnosis ? 'Regenerar diagnóstico asistido' : 'Generar diagnóstico asistido'}
        </button>
      </div>
    </div>
  );
};

export default DiagnosisHeroPanel;

