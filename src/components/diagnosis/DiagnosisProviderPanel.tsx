import React from 'react';
import { DEFAULT_OLLAMA_MODEL_ID } from '../../services/modelRegistry';
import { Lock, Globe, Server, Cpu, ChevronRight, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { AIConfig } from '../../types';
import ChromeAiStatusPanel from '../ChromeAiStatusPanel';
import type { OllamaLocalDiagnostic, OllamaLocalStatus } from '../../services/ollamaLocalBridge';

interface DiagnosisProviderPanelProps {
  aiConfig: AIConfig;
  providerAvailable: boolean | null;
  chromeAvailability: any;
  isCheckingChrome: boolean;
  isPreparingChrome: boolean;
  chromeDownloadProgress: number | undefined;
  chromeDownloadMessage: string;
  onProviderTypeChange: (type: 'chrome' | 'ollama' | 'cloud') => void;
  onModelChange: (modelId: string) => void;
  onChromeStatusChange: (status: any) => void;
  onChromeReady: () => void;
  onChromeDownloadProgress: (progress: number, message: string) => void;
  onPrepareChrome: () => Promise<void>;
  availableModels: { id: string; name: string; provider?: string }[];
  ollamaDiagnostic?: OllamaLocalDiagnostic | null;
  onOpenOllamaWizard?: () => void;
}

const PRIVACY_NOTICES: Record<string, { icon: React.ReactNode; title: string; desc: string }> = {
  chrome: {
    icon: <Lock size={12} />,
    title: 'Chrome AI',
    desc: 'Diagnóstico en navegador. Sin envío de datos.',
  },
  ollama: {
    icon: <Server size={12} />,
    title: 'Ollama local',
    desc: 'Inferencia en tu máquina.',
  },
  cloud: {
    icon: <Globe size={12} />,
    title: 'Cloud',
    desc: 'Paquete enviado al proveedor.',
  },
};

export const DiagnosisProviderPanel: React.FC<DiagnosisProviderPanelProps> = ({
  aiConfig,
  providerAvailable,
  chromeAvailability,
  isCheckingChrome,
  isPreparingChrome,
  chromeDownloadProgress,
  chromeDownloadMessage,
  onProviderTypeChange,
  onModelChange,
  onChromeStatusChange,
  onChromeReady,
  onChromeDownloadProgress,
  onPrepareChrome,
  availableModels,
  ollamaDiagnostic,
  onOpenOllamaWizard,
}) => {
  const currentPrivacy = PRIVACY_NOTICES[aiConfig.providerType] || PRIVACY_NOTICES.cloud;

  const ollamaStatusLabel: Record<OllamaLocalStatus, string> = {
    not_configured: 'Falta configurar OLLAMA_ORIGINS',
    permission_required: 'Permiso de red local requerido',
    permission_denied: 'Permiso denegado',
    cors_blocked: 'OLLAMA_ORIGINS no configurado',
    server_unreachable: 'Ollama no está iniciado',
    timeout: 'Ollama no respondió',
    model_missing: 'Modelo no instalado',
    insecure_context: 'HTTPS requerido',
    unsupported_browser: 'Usa Chrome o Edge',
    ready: 'Listo',
    unknown_error: 'Error de conexión',
  };

  return (
    <div className="diagnosis-provider-panel">
      <div className="diagnosis-provider-header">
        <div className="diagnosis-provider-header-icon">
          <Cpu size={14} />
        </div>
        <div className="diagnosis-provider-header-text">
          <h4 className="diagnosis-provider-title">Motor de diagnóstico</h4>
          <p className="diagnosis-provider-desc">Elige dónde se ejecutará la interpretación de los hallazgos.</p>
        </div>
      </div>

      <div className="diagnosis-provider-selector">
        <div className="segmented-control">
          <button
            className={`segmented-control-btn ${aiConfig.providerType === 'chrome' ? 'active' : ''}`}
            onClick={() => onProviderTypeChange('chrome')}
          >
            Chrome AI
          </button>
          <button
            className={`segmented-control-btn ${aiConfig.providerType === 'ollama' ? 'active' : ''}`}
            onClick={() => onProviderTypeChange('ollama')}
          >
            Ollama
          </button>
          <button
            className={`segmented-control-btn ${aiConfig.providerType === 'cloud' ? 'active' : ''}`}
            onClick={() => onProviderTypeChange('cloud')}
          >
            Cloud
          </button>
        </div>

        {aiConfig.providerType === 'ollama' ? (
          <input
            type="text"
            className="settings-input"
            value={aiConfig.model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder={DEFAULT_OLLAMA_MODEL_ID}
            style={{ width: 120 }}
          />
        ) : (
          <select
            className="model-select"
            value={aiConfig.model}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {availableModels.length === 0 && (
              <option disabled>Sin modelos disponibles</option>
            )}
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="diagnosis-provider-notice">
        {currentPrivacy.icon}
        <span>{currentPrivacy.desc}</span>
      </div>

      {aiConfig.providerType === 'chrome' && (
        <ChromeAiStatusPanel
          compact={true}
          onStatusChange={onChromeStatusChange}
          onReady={onChromeReady}
          onDownloadProgress={onChromeDownloadProgress}
          onPrepare={onPrepareChrome}
        />
      )}

      {aiConfig.providerType === 'ollama' && (
        <div className="ollama-status-strip" data-testid="ollama-status-strip">
          {!ollamaDiagnostic ? (
            <div className="ollama-status-strip-checking">
              <Activity size={12} className="spinning" />
              <span>Verificando Ollama local...</span>
            </div>
          ) : ollamaDiagnostic.status === 'ready' ? (
            <div className="ollama-status-strip-ready">
              <CheckCircle size={14} style={{ color: 'var(--success)' }} />
              <div className="ollama-status-strip-ready-text">
                <span className="ollama-status-strip-label">Ollama conectado</span>
                <span className="ollama-status-strip-sub">
                  navegador → {ollamaDiagnostic.details.endpoint} · datos no enviados al backend
                </span>
              </div>
            </div>
          ) : (
            <div className="ollama-status-strip-issue">
              <div className="ollama-status-strip-issue-left">
                <AlertCircle size={14} style={{ color: 'var(--orange)' }} />
                <span>{ollamaStatusLabel[ollamaDiagnostic.status] || ollamaDiagnostic.message}</span>
              </div>
              {onOpenOllamaWizard && (
                <button
                  className="btn-s btn-sm"
                  onClick={onOpenOllamaWizard}
                  data-testid="ollama-open-wizard-btn"
                >
                  Conectar Ollama <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiagnosisProviderPanel;
