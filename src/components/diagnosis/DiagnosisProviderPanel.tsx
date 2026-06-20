import React from 'react';
import { Lock, Globe, Server, ChevronDown } from 'lucide-react';
import { AIConfig, InputMode } from '../../types';
import ChromeAiStatusPanel from '../ChromeAiStatusPanel';

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
}

const PRIVACY_NOTICES: Record<string, { icon: React.ReactNode; title: string; desc: string }> = {
  chrome: {
    icon: <Lock size={14} />,
    title: 'Chrome AI',
    desc: 'Diagnóstico en el navegador. Sin envío de datos.',
  },
  ollama: {
    icon: <Server size={14} />,
    title: 'Ollama local',
    desc: 'Inferencia en tu máquina. Sin envío externo de datos.',
  },
  cloud: {
    icon: <Globe size={14} />,
    title: 'Cloud',
    desc: 'Paquete estructurado enviado al proveedor.',
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
}) => {
  const currentPrivacy = PRIVACY_NOTICES[aiConfig.providerType] || PRIVACY_NOTICES.cloud;

  return (
    <div className="diagnosis-provider-panel">
      <div className="diagnosis-provider-privacy">
        {currentPrivacy.icon}
        <div>
          <strong>{currentPrivacy.title}</strong>
          <p>{currentPrivacy.desc}</p>
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
            placeholder="qwen2.5:3b"
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

      {aiConfig.providerType === 'chrome' && (
        <ChromeAiStatusPanel
          compact={true}
          onStatusChange={onChromeStatusChange}
          onReady={onChromeReady}
          onDownloadProgress={onChromeDownloadProgress}
          onPrepare={onPrepareChrome}
        />
      )}
    </div>
  );
};

export default DiagnosisProviderPanel;
