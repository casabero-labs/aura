import React, { useRef, useState } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import type { InputMode } from '../../types';
import {
  DiagnosisQuickConfigModal,
  diagnosisInputModeLabel,
  type DiagnosisQuickConfigModel,
} from './DiagnosisQuickConfigModal';

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
  model: string;
  modelName: string;
  inputMode: InputMode;
  models: readonly DiagnosisQuickConfigModel[];
  onQuickConfigSave: (selection: { model: string; inputMode: InputMode }) => void;
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
  model,
  modelName,
  inputMode,
  models,
  onQuickConfigSave,
}) => {
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const configButtonRef = useRef<HTMLButtonElement>(null);
  const closeQuickConfig = () => {
    setShowQuickConfig(false);
    window.setTimeout(() => configButtonRef.current?.focus(), 0);
  };

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
          <span className="diagnosis-active-mode-status">
            {providerAvailable === true && <span>(Disponible)</span>}
            {providerAvailable === false && <span>(No disponible)</span>}
            {providerAvailable === null && <span>(Verificando…)</span>}
          </span>
          <span className="diagnosis-active-mode-sep" />
          <span className="diagnosis-active-mode-entry" title={model} data-testid="diagnosis-active-model">
            <strong>Modelo:</strong> {modelName}
          </span>
          <span className="diagnosis-active-mode-sep" />
          <span className="diagnosis-active-mode-entry" data-testid="diagnosis-active-input-mode">
            <strong>Entrada:</strong> {diagnosisInputModeLabel(inputMode)}
          </span>
        </div>
        <button
          ref={configButtonRef}
          className="diagnosis-active-mode-config-btn btn-s btn-sm"
          onClick={() => setShowQuickConfig(true)}
          data-testid="diagnosis-config-toggle"
          type="button"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Settings size={11} />
          <span>Configurar</span>
        </button>
      </div>

      {showQuickConfig && (
        <DiagnosisQuickConfigModal
          model={model}
          inputMode={inputMode}
          models={models}
          onClose={closeQuickConfig}
          onSave={(selection) => {
            onQuickConfigSave(selection);
            closeQuickConfig();
          }}
        />
      )}

      {/* CTA del hero:
          - Antes del diagnóstico: btn-p "Generar diagnóstico asistido"
          - Durante ejecución: btn-p deshabilitado "Diagnosticando..."
          - Después del diagnóstico: btn-s "Regenerar diagnóstico asistido"
            (el CTA primario "Continuar al reporte diagnóstico →" se renderiza
            fuera del hero en DiagnosisStep; el hero nunca compite con él) */}
      <div className="diagnosis-hero-actions">
        {hasDiagnosis ? (
          <button
            className="btn-s btn-sm"
            onClick={onGenerateDiagnosis}
            disabled={isLoading || providerAvailable === false}
            style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}
            type="button"
            data-testid="diagnosis-regenerate"
          >
            <RefreshCw size={12} />
            {isLoading ? 'Diagnosticando...' : 'Regenerar diagnóstico asistido'}
          </button>
        ) : (
          <button
            className="btn-p btn-hold"
            onClick={onGenerateDiagnosis}
            disabled={isLoading || providerAvailable === false}
            aria-busy={isLoading}
            type="button"
            data-testid="diagnosis-generate"
          >
            <span data-state="idle">Generar diagnóstico asistido</span>
            <span data-state="busy">Diagnosticando…</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DiagnosisHeroPanel;
