import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Cloud,
  Download,
  ExternalLink,
  Globe,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Save,
  Server,
  Shield,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AIConfig, CloudProvider, InputMode, ProviderProgressEvent } from '../types';
import { AVAILABLE_MODELS, OLLAMA_MODELS, getChromeAiDiagnostic } from '../services/aiProvider';
import type { ChromeAiDiagnostic } from '../services/aiProvider';
import { OLLAMA_SUGGESTED_MODELS, OllamaProvider } from '../services/providers/ollamaProvider';
import type { OllamaModel } from '../services/providers/ollamaProvider';
import { normalizePromptContract } from '../services/providers/prompts';

interface SettingsPanelProps {
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
}

const CLOUD_PROVIDERS: { value: CloudProvider; label: string }[] = [
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'nvidia', label: 'Nvidia' },
];

const PROVIDER_TABS = [
  { id: 'chrome' as const, label: 'Chrome AI', icon: Globe, desc: 'Gemini Nano en navegador. Sin envío de datos a terceros.' },
  { id: 'ollama' as const, label: 'Ollama local', icon: Server, desc: 'Modelos locales vía Ollama. Requiere servidor abierto.' },
  { id: 'cloud' as const, label: 'Cloud', icon: Cloud, desc: 'Mayor capacidad. API key requerida. Paquete estructurado.' },
];

const INPUT_MODE_OPTIONS: { value: InputMode; label: string; desc: string }[] = [
  {
    value: 'smart_sample',
    label: 'Smart sample',
    desc: 'Equilibrio recomendado: columnas, estadísticas básicas, reglas activadas y muestras limitadas.',
  },
  {
    value: 'recommended',
    label: 'Completo',
    desc: 'Más evidencia para informe final o validación detallada. Puede consumir más contexto.',
  },
  {
    value: 'enhanced_registry',
    label: 'Registro extendido',
    desc: 'Más señales técnicas: tipos semánticos, frecuencias, IQR y reglas con porcentajes.',
  },
  {
    value: 'copy_paste_bad_samples',
    label: 'Muestras problemáticas',
    desc: 'Incluye valores observados problemáticos para forzar trazabilidad textual.',
  },
  {
    value: 'prompt_libre',
    label: 'Mínimo experimental',
    desc: 'Contexto reducido para pruebas rápidas. Menos trazabilidad.',
  },
];

type ProviderChoice = (typeof PROVIDER_TABS)[number]['id'];

const PROVIDER_SUMMARY: Record<ProviderChoice, {
  label: string;
  Icon: LucideIcon;
  decision: string;
  dataRoute: string;
}> = {
  chrome: {
    label: 'Chrome AI',
    Icon: Shield,
    decision: 'Inferencia local dentro del navegador. Ideal si Gemini Nano ya está disponible.',
    dataRoute: 'local / navegador',
  },
  ollama: {
    label: 'Ollama local',
    Icon: Server,
    decision: 'Inferencia local vía servidor Ollama. Mantiene el dataset en este equipo.',
    dataRoute: 'local / localhost',
  },
  cloud: {
    label: 'Cloud',
    Icon: Cloud,
    decision: 'Mayor capacidad para diagnósticos extensos. Usa solo el paquete estructurado.',
    dataRoute: 'externo / paquete',
  },
};

const isProviderChoice = (providerType: AIConfig['providerType']): providerType is ProviderChoice => (
  providerType === 'chrome' || providerType === 'ollama' || providerType === 'cloud'
);

const chromeStatusTone = (status?: ChromeAiDiagnostic['status']) => {
  if (status === 'available') return 'ok';
  return 'warn';
};

const chromeProgressMessage = (diagnostic: ChromeAiDiagnostic | null, progress: ProviderProgressEvent | null) => {
  if (progress?.message) return progress.message;
  if (diagnostic?.status === 'downloading') {
    return 'Chrome reporta una descarga en curso, pero todavía no entregó porcentaje.';
  }
  return '';
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [chromeDiagnostic, setChromeDiagnostic] = useState<ChromeAiDiagnostic | null>(null);
  const [chromeProgress, setChromeProgress] = useState<ProviderProgressEvent | null>(null);
  const [isPreparingChrome, setIsPreparingChrome] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaPullProgress, setOllamaPullProgress] = useState<ProviderProgressEvent | null>(null);
  const [ollamaPullModel, setOllamaPullModel] = useState('');

  useEffect(() => {
    sessionStorage.removeItem('aura_ollama_setup_started');
    void checkChromeDiagnostic();
    void checkOllamaConnection();
  }, []);

  useEffect(() => {
    if (chromeDiagnostic?.status === 'downloading' && !chromeProgress) {
      setChromeProgress({
        stage: 'downloading',
        message: 'Gemini Nano se está descargando. Mantén Chrome abierto. Si no avanza, revisa espacio en disco.',
      });
    }
  }, [chromeDiagnostic, chromeProgress]);

  const checkChromeDiagnostic = async () => {
    try {
      const diag = await getChromeAiDiagnostic();
      setChromeDiagnostic(diag);
      if (diag.status !== 'downloading') setChromeProgress(null);
    } catch (err: any) {
      setChromeDiagnostic({
        apiSurface: 'none',
        status: 'error',
        message: err?.message || 'No se pudo verificar Chrome AI.',
        actions: ['Reinicia Chrome e intenta verificar de nuevo.'],
      });
    }
  };

  const checkOllamaConnection = async () => {
    setOllamaConnected(null);
    try {
      const baseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        setOllamaConnected(false);
        return;
      }
      const data = await response.json();
      setOllamaConnected(true);
      setOllamaModels(data.models || []);
    } catch {
      setOllamaConnected(false);
    }
  };

  const setProviderType = (type: 'chrome' | 'ollama' | 'cloud') => {
    if (type === 'ollama') {
      const savedEndpoint = localStorage.getItem('aura_ollama_endpoint');
      const savedModel = localStorage.getItem('aura_ollama_model');
      const updated = {
        ...localConfig,
        providerType: 'ollama' as const,
        model: savedModel || localConfig.ollamaModel || 'qwen2.5:3b',
        ollamaBaseUrl: savedEndpoint || localConfig.ollamaBaseUrl || 'http://127.0.0.1:11434',
      };
      setLocalConfig(updated);
      onSave(updated);
      if (ollamaConnected !== true) {
        sessionStorage.setItem('aura_ollama_setup_started', 'true');
      }
      return;
    }

    const defaults: Record<'chrome' | 'cloud', string> = {
      chrome: 'gemini-nano',
      cloud: 'gemini-2.5-flash',
    };

    const updated = {
      ...localConfig,
      providerType: type,
      model: defaults[type],
      cloudProvider: type === 'cloud' ? (localConfig.cloudProvider || 'google') : undefined,
    };
    setLocalConfig(updated);
    onSave(updated);
  };

  const handlePrepareChrome = async () => {
    setIsPreparingChrome(true);
    setChromeProgress({
      stage: 'downloading',
      progress: 0,
      message: 'Iniciando descarga de Gemini Nano...',
    });

    try {
      const { ChromePromptProvider } = await import('../services/providers/chromeProvider');
      const provider = new ChromePromptProvider();
      await provider.preloadModel((progress, message) => {
        setChromeProgress({
          stage: 'downloading',
          progress,
          message: message || `Descargando Gemini Nano ${progress}%`,
        });
      });
      setChromeProgress({ stage: 'completed', progress: 100, message: 'Gemini Nano listo para usar.' });
      await checkChromeDiagnostic();
    } catch (err: any) {
      setChromeProgress({
        stage: 'error',
        progress: 0,
        message: `${err?.message || 'Falló la preparación de Gemini Nano'}. Revisa espacio libre en disco y chrome://on-device-internals.`,
      });
    } finally {
      setIsPreparingChrome(false);
    }
  };

  const handleFetchOllamaModels = async () => {
    setOllamaLoading(true);
    await checkOllamaConnection();
    setOllamaLoading(false);
  };

  const handleUseOllamaModel = (modelName: string) => {
    const updated = {
      ...localConfig,
      model: modelName,
      ollamaModel: modelName,
    };
    setLocalConfig(updated);
    localStorage.setItem('aura_ollama_model', modelName);
    onSave(updated);
  };

  const handleOllamaPull = async () => {
    const model = ollamaPullModel || localConfig.model || 'qwen2.5:3b';
    setOllamaPullProgress({ stage: 'downloading', progress: 0, message: 'Iniciando descarga...' });
    try {
      const baseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';
      const provider = new OllamaProvider(model, localConfig.temperature, baseUrl);
      await provider.pullModel(model, (progress, message) => {
        setOllamaPullProgress({ stage: 'downloading', progress, message });
      });
      setOllamaPullProgress({ stage: 'completed', progress: 100, message: `Modelo ${model} listo.` });
      await handleFetchOllamaModels();
    } catch (err: any) {
      setOllamaPullProgress({ stage: 'error', progress: 0, message: err?.message || 'No se pudo descargar el modelo.' });
    }
  };

  const cloudsForProvider = (provider: CloudProvider) => {
    return AVAILABLE_MODELS.cloud.filter(m => {
      if (provider === 'google') return m.provider === 'Google';
      if (provider === 'deepseek') return m.provider === 'DeepSeek';
      if (provider === 'groq') return m.provider === 'Groq';
      if (provider === 'openrouter') return m.provider === 'OpenRouter';
      if (provider === 'minimax') return m.provider === 'MiniMax';
      if (provider === 'nvidia') return m.provider === 'Nvidia';
      return true;
    });
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const promptContract = normalizePromptContract(localConfig.promptContract);
  const activeInputMode = localConfig.inputMode || 'smart_sample';
  const activeInputModeOption = INPUT_MODE_OPTIONS.find(option => option.value === activeInputMode) || INPUT_MODE_OPTIONS[0];
  const updatePromptContract = (patch: Partial<typeof promptContract>) => {
    setLocalConfig({
      ...localConfig,
      promptContract: { ...promptContract, ...patch },
    });
  };

  const recommendedProvider = ollamaConnected ? 'ollama' : chromeDiagnostic?.status === 'available' ? 'chrome' : 'cloud';
  const activeProviderType: ProviderChoice = isProviderChoice(localConfig.providerType) ? localConfig.providerType : 'cloud';
  const activeProvider = PROVIDER_SUMMARY[activeProviderType];
  const recommendedProviderMeta = PROVIDER_SUMMARY[recommendedProvider];
  const ActiveProviderIcon = activeProvider.Icon;
  const recommendationMatchesActive = activeProviderType === recommendedProvider;
  const ollamaBaseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';
  const activeModelLabel = activeProviderType === 'chrome'
    ? 'gemini-nano'
    : activeProviderType === 'ollama'
      ? localConfig.ollamaModel || localConfig.model || 'qwen2.5:3b'
      : `${localConfig.cloudProvider || 'google'} / ${localConfig.model || 'sin modelo'}`;
  const activeProviderStatus = activeProviderType === 'chrome'
    ? chromeDiagnostic?.status === 'available'
      ? 'Listo local'
      : chromeDiagnostic?.status === 'downloading'
        ? 'Descargando modelo'
        : 'Requiere verificación'
    : activeProviderType === 'ollama'
      ? ollamaConnected === true
        ? 'Conectado local'
        : ollamaConnected === false
          ? 'Sin conexión'
          : 'Verificando'
      : localConfig.apiKey || localConfig.cloudProvider === 'openrouter'
        ? 'Cloud configurado'
        : 'API key pendiente';
  const activeChromeProgressMessage = chromeProgressMessage(chromeDiagnostic, chromeProgress);
  const chromeProgressValue = chromeProgress?.progress;
  const shouldShowChromeProgress = chromeDiagnostic?.status === 'downloading' || isPreparingChrome || !!chromeProgress;
  const currentModelInstalled = ollamaConnected === true && ollamaModels.length > 0
    && ollamaModels.some(m => m.name === localConfig.model);

  return (
    <main className="settings-workspace" data-testid="settings-workspace">
      <div className="settings-workspace-header">
        <button className="settings-back-btn" onClick={onClose}>
          <ArrowLeft size={14} /> Volver a auditoría
        </button>
        <div>
          <p className="sec-eye">configuración</p>
          <h1 className="sec-title">Configurar AURA</h1>
          <p className="settings-workspace-subtitle">
            Elige Chrome AI, Ollama local o Cloud para interpretar los hallazgos.
          </p>
        </div>
        <button onClick={handleSave} className="btn-p">
          <Save size={14} /> Guardar configuración
        </button>
      </div>

      <div className="settings-workspace-body">
        <section className="settings-workspace-section">
          <h2 className="settings-section-title">Proveedor activo</h2>
          <div className="settings-active-provider-card">
            <div>
              <div className="settings-active-provider-title">
                <span className="settings-active-provider-icon">
                  <ActiveProviderIcon size={18} />
                </span>
                <div>
                  <strong>{activeProvider.label}</strong>
                  <span className="settings-active-provider-status">{activeProviderStatus}</span>
                </div>
              </div>
              <p>{activeProvider.decision}</p>
              {!recommendationMatchesActive && (
                <p className="settings-active-provider-note">
                  AURA recomienda {recommendedProviderMeta.label} por disponibilidad actual, pero el diagnóstico usará {activeProvider.label} hasta que cambies el proveedor.
                </p>
              )}
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
              const isActive = localConfig.providerType === tab.id;
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
                    <small>{tab.desc}</small>
                  </div>
                  {isActive && <CheckCircle size={14} className="settings-provider-card-check" />}
                </button>
              );
            })}
          </div>

          {localConfig.providerType === 'chrome' && (
            <div className="settings-provider-details">
              <div className="settings-field">
                <label className="settings-label">Estado de Chrome AI</label>
                {!chromeDiagnostic ? (
                  <div className="settings-info-box">
                    <Loader2 size={14} className="animate-spin" />
                    <p>Verificando disponibilidad de Chrome AI...</p>
                  </div>
                ) : (
                  <div className={`settings-status-card settings-status-card--${chromeStatusTone(chromeDiagnostic.status)}`}>
                    {chromeDiagnostic.status === 'available' ? (
                      <CheckCircle size={14} className="settings-status-icon" />
                    ) : chromeDiagnostic.status === 'downloadable' ? (
                      <Download size={14} className="settings-status-icon" />
                    ) : chromeDiagnostic.status === 'downloading' ? (
                      <Loader2 size={14} className="settings-status-icon animate-spin" />
                    ) : (
                      <AlertTriangle size={14} className="settings-status-icon" />
                    )}
                    <div>
                      <p>{chromeDiagnostic.message}</p>
                      <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '2px' }}>
                        API: {chromeDiagnostic.apiSurface === 'none' ? 'No detectada' : chromeDiagnostic.apiSurface}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {shouldShowChromeProgress && (
                <div className="settings-download-card" style={{ marginTop: 'var(--space-sm)' }} data-testid="chrome-ai-download-progress">
                  <div className="settings-download-row">
                    {chromeProgress?.stage === 'error' ? <AlertTriangle size={14} /> : <Loader2 size={14} className="settings-download-spinner" />}
                    <span className="settings-download-message">
                      {activeChromeProgressMessage || 'Gemini Nano se está preparando...'}
                    </span>
                    {chromeProgressValue !== undefined && (
                      <span className="settings-download-pct">{chromeProgressValue}%</span>
                    )}
                  </div>
                  <div className="settings-progress-track" aria-label="Progreso de descarga de Gemini Nano">
                    <div
                      className="settings-progress-fill"
                      style={{ width: `${chromeProgressValue ?? 35}%`, opacity: chromeProgressValue === undefined ? 0.55 : 1 }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '6px' }}>
                    Si la barra no avanza, libera espacio en disco, reinicia Chrome y revisa <code>chrome://on-device-internals</code>.
                  </p>
                </div>
              )}

              {chromeDiagnostic && chromeDiagnostic.status !== 'available' && (
                <div className="settings-field">
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <button className="btn-s btn-sm" onClick={checkChromeDiagnostic} disabled={isPreparingChrome}>
                      <RefreshCw size={10} /> Verificar estado
                    </button>
                    {(chromeDiagnostic.status === 'downloadable' || chromeDiagnostic.status === 'downloading') && (
                      <button className="btn-p btn-sm" onClick={handlePrepareChrome} disabled={isPreparingChrome}>
                        {isPreparingChrome ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        {isPreparingChrome ? ' Preparando...' : ' Preparar Gemini Nano'}
                      </button>
                    )}
                    <button className="btn-s btn-sm" onClick={() => window.open('chrome://on-device-internals', '_blank')}>
                      <ExternalLink size={10} /> on-device-internals
                    </button>
                    <button className="btn-s btn-sm" onClick={() => setProviderType('ollama')}>
                      <Server size={10} /> Usar Ollama
                    </button>
                    <button className="btn-s btn-sm" onClick={() => setProviderType('cloud')}>
                      <Cloud size={10} /> Usar Cloud
                    </button>
                  </div>
                </div>
              )}

              <details className="settings-collapsible-section" style={{ marginTop: 'var(--space-sm)' }} open={chromeDiagnostic?.status === 'unavailable' || chromeDiagnostic?.status === 'downloading'}>
                <summary className="settings-collapsible-summary" style={{ fontSize: '13px', padding: '8px 0' }}>
                  <HelpCircle size={12} />
                  <span>Cómo activar y destrabar Chrome AI</span>
                </summary>
                <div className="settings-collapsible-body" style={{ paddingTop: 'var(--space-sm)' }}>
                  <ol style={{ fontSize: '13px', lineHeight: 1.7, paddingLeft: '20px', color: 'var(--ink2)' }}>
                    <li>Actualiza Chrome a la versión más reciente (138+).</li>
                    <li>Abre <code style={{ fontSize: '12px' }}>chrome://flags</code> en una pestaña nueva.</li>
                    <li>Busca <strong>Prompt API</strong>, <strong>Gemini Nano</strong>, <strong>Built-in AI</strong> y <strong>Optimization Guide On Device Model</strong>.</li>
                    <li>Activa las opciones disponibles y reinicia Chrome completo.</li>
                    <li>Deja al menos ~22 GB libres en el disco donde vive el perfil de Chrome.</li>
                    <li>Vuelve a AURA y pulsa <strong>Verificar estado</strong>.</li>
                  </ol>
                  <p style={{ fontSize: '12px', color: 'var(--ink3)', marginTop: 'var(--space-sm)' }}>
                    Revisa <code style={{ fontSize: '11px' }}>chrome://on-device-internals</code> para ver modelos on-device, errores y estado de descarga.
                  </p>
                </div>
              </details>

              <div className="settings-info-box">
                <Info size={14} />
                <p>Gemini Nano está integrado en Chrome. No requiere API key. Requisitos frecuentes: Chrome escritorio, macOS 13+, GPU {'>'}4GB VRAM o CPU 16GB RAM con 4 cores, y ~22GB libres en el perfil de Chrome. Si el disco queda bajo, Chrome puede borrar o bloquear el modelo.</p>
              </div>
            </div>
          )}

          {localConfig.providerType === 'ollama' && (
            <div className="settings-provider-details">
              <div className="settings-field">
                <label className="settings-label">Endpoint de Ollama</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, ollamaBaseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="settings-input"
                    style={{ flex: 1 }}
                    data-testid="ollama-endpoint-input"
                  />
                  <button className="btn-s btn-sm" onClick={handleFetchOllamaModels} disabled={ollamaLoading} data-testid="ollama-test-connection">
                    <RefreshCw size={10} className={ollamaLoading ? 'animate-spin' : ''} /> Probar y refrescar
                  </button>
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-label">Conexión</label>
                {ollamaConnected === null && (
                  <div className="settings-info-box"><Loader2 size={14} className="animate-spin" /><p>Verificando conexión con Ollama...</p></div>
                )}
                {ollamaConnected === false && (
                  <div className="settings-status-card settings-status-card--warn">
                    <AlertTriangle size={14} className="settings-status-icon" />
                    <div>
                      <p><strong>Ollama todavía no está conectado</strong></p>
                      <p style={{ fontSize: '13px', marginTop: '4px' }}>AURA necesita conectarse con Ollama en este equipo.</p>
                      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <button className="btn-p btn-sm" onClick={() => window.location.assign('/ollama-setup.html?return=/')} data-testid="ollama-open-setup">
                          Configurar Ollama en este equipo
                        </button>
                        <button className="btn-s btn-sm" onClick={handleFetchOllamaModels} data-testid="ollama-retry-connection">
                          Volver a intentar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {ollamaConnected === true && (
                  <div className="settings-status-card settings-status-card--ok">
                    <CheckCircle size={14} className="settings-status-icon" />
                    <p>Ollama conectado en {ollamaBaseUrl}. {ollamaModels.length} modelos encontrados.</p>
                  </div>
                )}
              </div>

              <div className="settings-field">
                <label className="settings-label">Modelo Ollama</label>
                <select
                  value={localConfig.model}
                  onChange={(e) => {
                    const modelName = e.target.value;
                    setLocalConfig({ ...localConfig, model: modelName, ollamaModel: modelName });
                    localStorage.setItem('aura_ollama_model', modelName);
                  }}
                  className="settings-select"
                  data-testid="ollama-model-select"
                >
                  {OLLAMA_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}{m.recommended ? ' ★' : ''}</option>
                  ))}
                  {!OLLAMA_MODELS.find(m => m.id === localConfig.model) && (
                    <option value={localConfig.model}>{localConfig.model} (personalizado)</option>
                  )}
                </select>
              </div>

              {ollamaConnected && ollamaModels.length > 0 && (
                <div className="settings-field">
                  <label className="settings-label">Modelos instalados ({ollamaModels.length})</label>
                  {ollamaConnected === true && !currentModelInstalled && (
                    <div className="settings-status-card settings-status-card--warn" style={{ marginBottom: 'var(--space-sm)' }} data-testid="ollama-model-missing-warning">
                      <AlertTriangle size={14} className="settings-status-icon" />
                      <p>El modelo configurado ya no está instalado en Ollama. Selecciona uno de los modelos detectados.</p>
                    </div>
                  )}
                  <div className="settings-model-cards">
                    {ollamaModels.slice(0, 10).map(m => (
                      <div key={m.name} className="settings-model-card settings-model-card--compact">
                        <div>
                          <strong>{m.name}</strong>
                          {m.name === localConfig.model && (
                            <span className="settings-model-card-active" data-testid={`ollama-model-active-${m.name.replace(/[^a-zA-Z0-9]/g, '_')}`}>
                              <CheckCircle size={10} /> activo
                            </span>
                          )}
                          <span className="settings-model-card-meta">{(m.size / 1e9).toFixed(1)} GB</span>
                        </div>
                        <button
                          className="btn-s btn-sm"
                          onClick={() => handleUseOllamaModel(m.name)}
                          data-testid={`ollama-use-model-${m.name.replace(/[^a-zA-Z0-9]/g, '_')}`}
                        >
                          Usar este modelo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-field">
                <label className="settings-label">Descargar modelo</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={ollamaPullModel}
                    onChange={(e) => setOllamaPullModel(e.target.value)}
                    placeholder="qwen2.5:3b"
                    className="settings-input"
                    style={{ flex: 1 }}
                  />
                  <button className="btn-p btn-sm" onClick={handleOllamaPull} disabled={ollamaPullProgress?.stage === 'downloading'}>
                    <Download size={10} /> Descargar
                  </button>
                </div>
                {ollamaPullProgress && (
                  <div className="settings-download-card" style={{ marginTop: 'var(--space-sm)' }}>
                    <div className="settings-download-row">
                      {ollamaPullProgress.stage === 'downloading' && <Loader2 size={14} className="settings-download-spinner" />}
                      <span className="settings-download-message">{ollamaPullProgress.message}</span>
                      {ollamaPullProgress.progress !== undefined && <span className="settings-download-pct">{ollamaPullProgress.progress}%</span>}
                    </div>
                    {ollamaPullProgress.progress !== undefined && (
                      <div className="settings-progress-track">
                        <div className="settings-progress-fill" style={{ width: `${ollamaPullProgress.progress}%` }} />
                      </div>
                    )}
                  </div>
                )}
                <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '4px' }}>
                  Sugeridos: {OLLAMA_SUGGESTED_MODELS.join(', ')}
                </p>
              </div>

              <div className="settings-info-box">
                <Info size={14} />
                <p>Ollama ejecuta modelos locales en tu máquina. Requiere tener Ollama instalado y abierto. No descarga modelos automáticamente.</p>
              </div>
            </div>
          )}

          {localConfig.providerType === 'cloud' && (
            <div className="settings-provider-details">
              <div className="settings-field">
                <label className="settings-label">Proveedor Cloud</label>
                <select
                  value={localConfig.cloudProvider || 'google'}
                  onChange={(e) => {
                    const cloudProvider = e.target.value as CloudProvider;
                    const models = cloudsForProvider(cloudProvider);
                    setLocalConfig({ ...localConfig, cloudProvider, model: models[0]?.id || localConfig.model });
                  }}
                  className="settings-select"
                >
                  {CLOUD_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {localConfig.cloudProvider !== 'openrouter' && (
                <div className="settings-field">
                  <label className="settings-label">API Key</label>
                  <input
                    type="password"
                    value={localConfig.apiKey || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="settings-input"
                  />
                </div>
              )}

              <div className="settings-field">
                <label className="settings-label">Modelo Cloud</label>
                <select
                  value={localConfig.model}
                  onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                  className="settings-select"
                >
                  {(localConfig.cloudProvider ? cloudsForProvider(localConfig.cloudProvider) : AVAILABLE_MODELS.cloud).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="settings-info-box">
                <Info size={14} />
                <p>En modo Cloud, AURA envía solo el paquete estructurado: columnas, estadísticas y hallazgos. No envía el CSV completo.</p>
              </div>
            </div>
          )}
        </section>

        <section className="settings-workspace-section">
          <h2 className="settings-section-title">Método de entrada</h2>
          <p className="settings-section-desc">
            Define qué evidencia recibirá el modelo durante el diagnóstico. No cambia el CSV ni el perfil determinista.
          </p>
          <div className="settings-field">
            <label className="settings-label">Evidencia para el diagnóstico</label>
            <select
              value={activeInputMode}
              onChange={(e) => setLocalConfig({ ...localConfig, inputMode: e.target.value as InputMode })}
              className="settings-select"
            >
              {INPUT_MODE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="settings-input-mode-desc">{activeInputModeOption.desc}</p>
          </div>
        </section>

        <section className="settings-workspace-section">
          <h2 className="settings-section-title">Temperatura del modelo</h2>
          <p className="settings-section-desc">Controla la estabilidad de las respuestas. Para auditoría se recomienda 0.1.</p>
          <div className="settings-field">
            <label className="settings-label">Temperatura: {(localConfig.temperature ?? 0.1).toFixed(1)}</label>
            <div className="settings-slider-row">
              <span className="settings-slider-label">0.0 — Estable</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localConfig.temperature ?? 0.1}
                onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
                className="settings-slider"
              />
              <span className="settings-slider-label">Creativo — 1.0</span>
            </div>
          </div>
        </section>

        <section className="settings-workspace-section">
          <div className="settings-toggle-card">
            <div>
              <p className="settings-toggle-card-label">Ejecución automática</p>
              <p className="settings-toggle-card-desc">Ejecuta el motor determinista automáticamente al cargar un dataset.</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={localConfig.autoAnalyze}
                onChange={(e) => setLocalConfig({ ...localConfig, autoAnalyze: e.target.checked })}
                className="toggle-input"
              />
              <div className="toggle-track"><div className="toggle-thumb" /></div>
            </label>
          </div>
        </section>

        <section className="settings-workspace-section">
          <details className="settings-collapsible-section">
            <summary className="settings-collapsible-summary">
              <HelpCircle size={14} />
              <span>Solución de problemas</span>
              <span className="settings-collapsible-hint">Errores frecuentes y cómo resolverlos</span>
            </summary>
            <div className="settings-collapsible-body">
              <ul className="settings-privacy-list">
                <li><strong>Gemini Nano descargando sin avanzar:</strong> libera espacio en disco, reinicia Chrome y revisa <code>chrome://on-device-internals</code>.</li>
                <li><strong>Chrome AI no disponible:</strong> habilita <code>chrome://flags/#prompt-api-for-gemini-nano</code> y <code>Optimization Guide On Device Model</code>.</li>
                <li><strong>Ollama no responde:</strong> verifica que Ollama esté abierto y que el endpoint sea localhost o 127.0.0.1.</li>
                <li><strong>API key inválida:</strong> verifica que la key sea correcta y tenga créditos disponibles.</li>
                <li><strong>Diagnóstico vacío:</strong> puedes continuar con el script determinista. El motor de reglas no depende del LLM.</li>
              </ul>
            </div>
          </details>
        </section>

        <section className="settings-workspace-section">
          <details className="settings-collapsible-section">
            <summary className="settings-collapsible-summary">
              <Lock size={14} />
              <span>Privacidad y datos</span>
              <span className="settings-collapsible-hint">Qué sale y qué se queda en tu navegador</span>
            </summary>
            <div className="settings-collapsible-body">
              <ul className="settings-privacy-list">
                <li><strong>Chrome AI:</strong> Gemini Nano se ejecuta en el navegador. Ningún dato sale de tu dispositivo mientras este modo esté activo.</li>
                <li><strong>Ollama local:</strong> La inferencia ocurre en tu máquina vía servidor local.</li>
                <li><strong>Cloud:</strong> Se envía un paquete estructurado al proveedor. No se envía el archivo CSV completo.</li>
                <li><strong>Exportación:</strong> Tú decides qué exportar. Nada se exporta sin tu acción explícita.</li>
              </ul>
            </div>
          </details>
        </section>

        <section className="settings-workspace-section">
          <details className="settings-collapsible-section">
            <summary className="settings-collapsible-summary">
              <Info size={14} />
              <span>Contrato técnico del diagnóstico (avanzado)</span>
              <span className="settings-collapsible-hint">Controla cómo AURA le pide al modelo que responda</span>
            </summary>
            <div className="settings-collapsible-body">
              <p className="settings-section-desc">Si no sabes qué es, deja los valores por defecto.</p>
              <div className="settings-field">
                <label className="settings-label">Objetivo operativo</label>
                <textarea
                  value={promptContract.objective}
                  onChange={(e) => updatePromptContract({ objective: e.target.value })}
                  rows={3}
                  maxLength={260}
                  className="prompt-contract-textarea"
                />
                <p className="prompt-contract-hint">{promptContract.objective.length}/260 · Debe preparar una salida útil para diagnóstico, benchmark y script.</p>
              </div>
              <div className="prompt-contract-grid">
                <button type="button" className={`prompt-contract-card ${promptContract.evidencePolicy === 'strict' ? 'active' : ''}`} onClick={() => updatePromptContract({ evidencePolicy: 'strict' })}>
                  <span>evidencia estricta</span><small>Solo JSON observado; reduce alucinaciones.</small>
                </button>
                <button type="button" className={`prompt-contract-card ${promptContract.evidencePolicy === 'balanced' ? 'active' : ''}`} onClick={() => updatePromptContract({ evidencePolicy: 'balanced' })}>
                  <span>hipótesis separadas</span><small>Permite hipótesis marcadas como no validadas.</small>
                </button>
              </div>
              <div className="prompt-contract-checks">
                <label><input type="checkbox" checked={promptContract.requireScriptReadiness} onChange={(e) => updatePromptContract({ requireScriptReadiness: e.target.checked })} /><span>Preparar criterios para script Pandas</span></label>
                <label><input type="checkbox" checked={promptContract.includeCopyPasteEvidence} onChange={(e) => updatePromptContract({ includeCopyPasteEvidence: e.target.checked })} /><span>Forzar evidencia copy-paste</span></label>
                <label><input type="checkbox" checked={promptContract.includeHumanReviewLabels} onChange={(e) => updatePromptContract({ includeHumanReviewLabels: e.target.checked })} /><span>Etiquetar decisiones HITL</span></label>
              </div>
            </div>
          </details>
        </section>

        <div className="settings-workspace-save-bar">
          <button onClick={onClose} className="btn-s">Cancelar</button>
          <button onClick={handleSave} className="btn-p"><Save size={14} /> Guardar configuración</button>
        </div>
      </div>
    </main>
  );
};

export default SettingsPanel;
