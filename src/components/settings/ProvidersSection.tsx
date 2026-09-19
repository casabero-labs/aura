import React from 'react';
import { AlertTriangle, CheckCircle, Cloud, Globe, RefreshCw, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AIConfig, CloudProvider } from '../../types';
import { AVAILABLE_MODELS } from '../../services/aiProvider';
import type { ChromeAiDiagnostic } from '../../services/aiProvider';
import type { OllamaModel } from '../../services/providers/ollamaProvider';
import { ollamaModelDisplayName, ollamaModelId } from '../../services/ollamaModelCatalog';

const CLOUD_PROVIDERS: { value: CloudProvider; label: string }[] = [
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'nvidia', label: 'Nvidia' },
];

const PROVIDER_TABS = [
  { id: 'chrome' as const, label: 'Chrome AI', icon: Globe, desc: 'Gemini Nano en navegador. Sin envío de datos a terceros.', route: 'LOCAL' },
  { id: 'ollama' as const, label: 'Ollama local', icon: Server, desc: 'Modelos locales vía Ollama. Requiere servidor abierto.', route: 'LOCAL' },
  { id: 'cloud' as const, label: 'Cloud', icon: Cloud, desc: 'Mayor capacidad. API key requerida. Paquete estructurado.', route: 'EXTERNO' },
];

export type ProviderChoice = (typeof PROVIDER_TABS)[number]['id'];

export const PROVIDER_SUMMARY: Record<ProviderChoice, { label: string; Icon: LucideIcon; decision: string; dataRoute: string }> = {
  chrome: { label: 'Chrome AI', Icon: Server, decision: 'Inferencia local dentro del navegador. Ideal si Gemini Nano ya está disponible.', dataRoute: 'local / navegador' },
  ollama: { label: 'Ollama local', Icon: Server, decision: 'Inferencia local vía servidor Ollama. Mantiene el dataset en este equipo.', dataRoute: 'local / localhost' },
  cloud: { label: 'Cloud', Icon: Cloud, decision: 'Mayor capacidad para diagnósticos extensos. Usa solo el paquete estructurado.', dataRoute: 'externo / paquete' },
};

export const isProviderChoice = (providerType: AIConfig['providerType']): providerType is ProviderChoice => (
  providerType === 'chrome' || providerType === 'ollama' || providerType === 'cloud'
);

const providerStatusLabel = (
  type: ProviderChoice,
  chromeDiagnostic: ChromeAiDiagnostic | null,
  ollamaConnected: boolean | null,
  apiKey: string | undefined,
) => {
  if (type === 'chrome') {
    if (chromeDiagnostic?.status === 'available') return 'Listo';
    if (chromeDiagnostic?.status === 'downloading') return 'Descargando modelo';
    return 'Requiere verificación';
  }
  if (type === 'ollama') {
    if (ollamaConnected === true) return 'Conectado local';
    if (ollamaConnected === false) return 'Sin conexión';
    return 'Verificando';
  }
  return apiKey ? 'Configurado' : 'API key pendiente';
};

interface ProvidersSectionProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
  setProviderType: (type: ProviderChoice) => void;
  chromeDiagnostic: ChromeAiDiagnostic | null;
  isPreparingChrome: boolean;
  onCheckChrome: () => void;
  ollamaConnected: boolean | null;
  ollamaModels: OllamaModel[];
  ollamaLoading: boolean;
  onTestOllama: () => void;
  onUseOllamaModel: (modelName: string) => void;
}

const cloudsForProvider = (provider: CloudProvider) => AVAILABLE_MODELS.cloud.filter(m => {
  if (provider === 'google') return m.provider === 'Google';
  if (provider === 'deepseek') return m.provider === 'DeepSeek';
  if (provider === 'groq') return m.provider === 'Groq';
  if (provider === 'openrouter') return m.provider === 'OpenRouter';
  if (provider === 'minimax') return m.provider === 'MiniMax';
  if (provider === 'nvidia') return m.provider === 'Nvidia';
  return true;
});

const ProvidersSection: React.FC<ProvidersSectionProps> = ({
  config, onChange, setProviderType,
  chromeDiagnostic, isPreparingChrome, onCheckChrome,
  ollamaConnected, ollamaModels, ollamaLoading, onTestOllama, onUseOllamaModel,
}) => {
  const activeProviderType: ProviderChoice = isProviderChoice(config.providerType) ? config.providerType : 'cloud';
  const activeProvider = PROVIDER_SUMMARY[activeProviderType];
  const ActiveProviderIcon = activeProvider.Icon;
  const ollamaBaseUrl = config.ollamaBaseUrl || 'http://localhost:11434';
  const activeModelLabel = activeProviderType === 'chrome'
    ? 'gemini-nano'
    : activeProviderType === 'ollama'
      ? config.ollamaModel || config.model || 'sin modelo'
      : `${config.cloudProvider || 'google'} / ${config.model || 'sin modelo'}`;

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / IA y proveedores</p>
        <h1 className="settings-section-h1">IA y proveedores</h1>
        <p className="settings-section-lead">Define dónde y cómo AURA ejecuta sus modelos.</p>
      </header>

      <section className="settings-workspace-section">
        <h2 className="settings-section-title">Proveedor activo</h2>
        <div className="settings-active-provider-card">
          <div>
            <div className="settings-active-provider-title">
              <span className="settings-active-provider-icon"><ActiveProviderIcon size={18} /></span>
              <div>
                <strong>{activeProvider.label}</strong>
                <span className="settings-active-provider-status">
                  {providerStatusLabel(activeProviderType, chromeDiagnostic, ollamaConnected, config.apiKey)}
                </span>
              </div>
            </div>
            <p>{activeProvider.decision}</p>
          </div>
          <div className="settings-active-provider-side">
            <span className="settings-active-provider-meta">{activeProvider.dataRoute}</span>
            <span className="settings-active-provider-meta">modelo: {activeModelLabel}</span>
          </div>
        </div>
      </section>

      <section className="settings-workspace-section">
        <h2 className="settings-section-title">Proveedor de diagnóstico</h2>
        <p className="settings-section-desc">
          Chrome AI y Ollama son locales. Cloud envía el paquete estructurado al proveedor externo.
        </p>

        <div className="settings-provider-cards">
          {PROVIDER_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = config.providerType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setProviderType(tab.id)}
                className={`settings-provider-card ${isActive ? 'settings-provider-card--active' : ''}`}
                data-testid={`provider-mode-${tab.id}`}
              >
                <div className="settings-provider-card-icon"><Icon size={18} /></div>
                <div className="settings-provider-card-body">
                  <strong>{tab.label}</strong>
                  <small>{tab.route} · {tab.desc}</small>
                </div>
                {isActive && <CheckCircle size={14} className="settings-provider-card-check" />}
              </button>
            );
          })}
        </div>

        {config.providerType === 'chrome' && (
          <div className="settings-provider-details">
            <div className="settings-field">
              <label className="settings-label">Estado</label>
              <p className="settings-inline-status">
                {chromeDiagnostic?.message || 'Verificando disponibilidad de Chrome AI…'}
              </p>
              <button className="btn-s btn-sm" onClick={onCheckChrome} disabled={isPreparingChrome}>
                <RefreshCw size={10} /> Verificar estado
              </button>
            </div>
          </div>
        )}

        {config.providerType === 'ollama' && (
          <div className="settings-provider-details">
            <div className="settings-field">
              <label className="settings-label">Endpoint de Ollama</label>
              <div className="settings-field-row">
                <input
                  type="text"
                  value={ollamaBaseUrl}
                  onChange={(e) => onChange({ ...config, ollamaBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="settings-input"
                  data-testid="ollama-endpoint-input"
                />
                <button className="btn-s btn-sm" onClick={onTestOllama} disabled={ollamaLoading} data-testid="ollama-test-connection">
                  <RefreshCw size={10} className={ollamaLoading ? 'animate-spin' : ''} /> Probar y refrescar
                </button>
              </div>
              <p className="settings-inline-status">
                {ollamaConnected === null ? 'Verificando conexión…' : ollamaConnected ? `Conectado. ${ollamaModels.length} modelos encontrados.` : 'Sin conexión — revisa el estado en Diagnóstico avanzado.'}
              </p>
            </div>

            {ollamaConnected && ollamaModels.length > 0 && (
              <div className="settings-field">
                <label className="settings-label">Modelo Ollama</label>
                <select
                  value={config.model}
                  onChange={(e) => onUseOllamaModel(e.target.value)}
                  className="settings-select"
                  data-testid="ollama-model-select"
                >
                  {ollamaModels.map(m => (
                    <option key={ollamaModelId(m)} value={ollamaModelId(m)}>
                      {ollamaModelDisplayName(m)} · {(m.size / 1e9).toFixed(1)} GB
                    </option>
                  ))}
                </select>
              </div>
            )}

            {ollamaConnected && ollamaModels.length > 0 && (
              <div className="settings-field">
                <label className="settings-label">Modelos instalados ({ollamaModels.length})</label>
                {!ollamaModels.some(m => ollamaModelId(m) === config.model) && (
                  <div className="settings-status-card settings-status-card--warn" data-testid="ollama-model-missing-warning">
                    <AlertTriangle size={14} className="settings-status-icon" />
                    <p>El modelo configurado ya no está instalado en Ollama. Selecciona uno de los modelos detectados.</p>
                  </div>
                )}
                <div className="settings-model-cards">
                  {ollamaModels.slice(0, 10).map(m => (
                    <div key={ollamaModelId(m)} className="settings-model-card settings-model-card--compact">
                      <div>
                        <strong>{ollamaModelDisplayName(m)}</strong>
                        {ollamaModelId(m) === config.model && (
                          <span className="settings-model-card-active" data-testid={`ollama-model-active-${ollamaModelId(m).replace(/[^a-zA-Z0-9]/g, '_')}`}>
                            <CheckCircle size={10} /> activo
                          </span>
                        )}
                        <span className="settings-model-card-meta">{(m.size / 1e9).toFixed(1)} GB</span>
                      </div>
                      <button
                        className="btn-s btn-sm"
                        onClick={() => onUseOllamaModel(ollamaModelId(m))}
                        data-testid={`ollama-use-model-${ollamaModelId(m).replace(/[^a-zA-Z0-9]/g, '_')}`}
                      >
                        Usar este modelo
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {config.providerType === 'cloud' && (
          <div className="settings-provider-details">
            <div className="settings-field">
              <label className="settings-label">Proveedor Cloud</label>
              <select
                value={config.cloudProvider || 'google'}
                onChange={(e) => {
                  const cloudProvider = e.target.value as CloudProvider;
                  const models = cloudsForProvider(cloudProvider);
                  onChange({ ...config, cloudProvider, model: models[0]?.id || config.model });
                }}
                className="settings-select"
              >
                {CLOUD_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="aura-cloud-api-key">API Key (solo durante esta sesión)</label>
              <input
                id="aura-cloud-api-key"
                type="password"
                value={config.apiKey || ''}
                onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
                placeholder="Introduce la API key del proveedor"
                className="settings-input"
                autoComplete="off"
              />
            </div>

            <div className="settings-field">
              <label className="settings-label">Modelo Cloud</label>
              <select
                value={config.model}
                onChange={(e) => onChange({ ...config, model: e.target.value })}
                className="settings-select"
              >
                {(config.cloudProvider ? cloudsForProvider(config.cloudProvider) : AVAILABLE_MODELS.cloud).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {activeProviderType !== 'chrome' && (
        <section className="settings-workspace-section">
          <h2 className="settings-section-title">Temperatura del modelo</h2>
          <p className="settings-section-desc">Controla la estabilidad de las respuestas. Para auditoría se recomienda 0.1.</p>
          <div className="settings-field">
            <label className="settings-label">Temperatura: {(config.temperature ?? 0.1).toFixed(1)}</label>
            <div className="settings-slider-row">
              <span className="settings-slider-label">0.0 — Estable</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature ?? 0.1}
                onChange={(e) => onChange({ ...config, temperature: parseFloat(e.target.value) })}
                className="settings-slider"
              />
              <span className="settings-slider-label">Creativo — 1.0</span>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default ProvidersSection;
