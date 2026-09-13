import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Cloud,
  Download,
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
import { AVAILABLE_MODELS, getChromeAiDiagnostic } from '../services/aiProvider';
import type { ChromeAiDiagnostic } from '../services/aiProvider';
import { OLLAMA_SUGGESTED_MODELS, OllamaProvider } from '../services/providers/ollamaProvider';
import type { OllamaModel } from '../services/providers/ollamaProvider';
import OllamaSetupWizard from './OllamaSetupWizard';
import { DEFAULT_OLLAMA_MODEL_ID } from '../services/modelRegistry';
import { migrateFormalModelId } from '../services/aiConfigStorage';
import { ollamaModelDisplayName, ollamaModelId, refreshOllamaModelCatalog } from '../services/ollamaModelCatalog';

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

interface InputModeOption {
  value: InputMode;
  label: string;
  summary: string;
  whenToUse: string;
  includes: string;
  advantage: string;
  limitation: string;
  recommended?: boolean;
}

const INPUT_MODE_OPTIONS: InputModeOption[] = [
  {
    value: 'prompt_libre',
    label: 'Contexto mínimo',
    summary: 'Resumen físico, esquema y registro mínimo de reglas activadas. Sin muestras observadas.',
    whenToUse: 'Pruebas rápidas, baseline experimental o comprobación básica.',
    includes: 'Resumen físico, esquema y registro mínimo de hallazgos y reglas.',
    advantage: 'Menor consumo de contexto y respuesta más rápida.',
    limitation: 'Menos contexto: mayor riesgo de respuestas genéricas y menor trazabilidad.',
  },
  {
    value: 'smart_sample',
    label: 'Evidencia equilibrada',
    summary: 'Resumen, esquema, estadísticas, reglas activadas y muestras limitadas. Recomendado para la mayoría.',
    whenToUse: 'Diagnóstico normal de la mayoría de datasets.',
    includes: 'Resumen, esquema, estadísticas, reglas activadas y muestras limitadas.',
    advantage: 'Mejor equilibrio entre contexto, claridad, latencia y privacidad.',
    limitation: 'No incorpora todos los manifiestos y controles avanzados.',
    recommended: true,
  },
  {
    value: 'recommended',
    label: 'Evidencia completa',
    summary: 'Todo lo anterior más registro completo, políticas, manifiestos y anclajes exactos a muestras.',
    whenToUse: 'Datasets complejos, informe final, revisión técnica detallada o máxima trazabilidad.',
    includes: 'Registro completo, políticas de acción, autorizaciones, manifiestos y anclajes exactos a muestras.',
    advantage: 'Máxima trazabilidad y contexto.',
    limitation: 'Usa más tokens/contexto y puede tardar más.',
  },
];

const LEGACY_INPUT_MODES: ReadonlySet<InputMode> = new Set<InputMode>([
  'enhanced_registry',
  'copy_paste_bad_samples',
]);

const migrateLegacyInputMode = (mode: InputMode | undefined): InputMode => {
  if (mode && LEGACY_INPUT_MODES.has(mode)) return 'recommended';
  if (mode === 'prompt_libre' || mode === 'smart_sample' || mode === 'recommended') return mode;
  return 'smart_sample';
};

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
  const [localConfig, setLocalConfig] = useState<AIConfig>(() => ({
    ...config,
    inputMode: migrateLegacyInputMode(config.inputMode),
  }));
  const [chromeDiagnostic, setChromeDiagnostic] = useState<ChromeAiDiagnostic | null>(null);
  const [chromeProgress, setChromeProgress] = useState<ProviderProgressEvent | null>(null);
  const [isPreparingChrome, setIsPreparingChrome] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaPullProgress, setOllamaPullProgress] = useState<ProviderProgressEvent | null>(null);
  const [showOllamaWizard, setShowOllamaWizard] = useState(false);
  const [ollamaPullModel, setOllamaPullModel] = useState('');

  useEffect(() => {
    sessionStorage.removeItem('aura_ollama_setup_started');
    void checkChromeDiagnostic();
    void checkOllamaConnection();
  }, []);

  useEffect(() => {
    if (localConfig.inputMode && LEGACY_INPUT_MODES.has(localConfig.inputMode)) {
      const migrated = migrateLegacyInputMode(localConfig.inputMode);
      setLocalConfig(prev => (prev.inputMode === migrated ? prev : { ...prev, inputMode: migrated }));
    }
  }, [localConfig.inputMode]);

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
      const snapshot = await refreshOllamaModelCatalog(baseUrl);
      setOllamaConnected(true);
      setOllamaModels(snapshot.models);
    } catch {
      setOllamaConnected(false);
      setOllamaModels([]);
    }
  };

  const setProviderType = (type: 'chrome' | 'ollama' | 'cloud') => {
    if (type === 'ollama') {
      const savedEndpoint = localStorage.getItem('aura_ollama_endpoint');
      const savedModel = migrateFormalModelId(localStorage.getItem('aura_ollama_model') ?? undefined);
      const updated = {
        ...localConfig,
        providerType: 'ollama' as const,
        model: savedModel || localConfig.ollamaModel || DEFAULT_OLLAMA_MODEL_ID,
        ollamaBaseUrl: savedEndpoint || localConfig.ollamaBaseUrl || 'http://127.0.0.1:11434',
      };
      setLocalConfig(updated);
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
  };

  const handleOllamaPull = async () => {
    const model = ollamaPullModel || localConfig.model || DEFAULT_OLLAMA_MODEL_ID;
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

  const activeInputMode = migrateLegacyInputMode(localConfig.inputMode);
  const activeInputModeOption = INPUT_MODE_OPTIONS.find(option => option.value === activeInputMode) || INPUT_MODE_OPTIONS[1];
  const ollamaReady = ollamaConnected === true
    && ollamaModels.some((model) => model.name === localConfig.model || model.model === localConfig.model);
  const recommendedProvider: ProviderChoice | null = ollamaReady
    ? 'ollama'
    : chromeDiagnostic?.status === 'available'
      ? 'chrome'
      : localConfig.apiKey
        ? 'cloud'
        : null;
  const activeProviderType: ProviderChoice = isProviderChoice(localConfig.providerType) ? localConfig.providerType : 'cloud';
  const activeProvider = PROVIDER_SUMMARY[activeProviderType];
  const recommendedProviderMeta = recommendedProvider ? PROVIDER_SUMMARY[recommendedProvider] : null;
  const ActiveProviderIcon = activeProvider.Icon;
  const recommendationMatchesActive = recommendedProvider !== null && activeProviderType === recommendedProvider;
  const ollamaBaseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';
  const activeModelLabel = activeProviderType === 'chrome'
    ? 'gemini-nano'
    : activeProviderType === 'ollama'
      ? localConfig.ollamaModel || localConfig.model || DEFAULT_OLLAMA_MODEL_ID
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
      : localConfig.apiKey
        ? 'Cloud configurado'
        : 'API key pendiente';
  const activeChromeProgressMessage = chromeProgressMessage(chromeDiagnostic, chromeProgress);
  const chromeProgressValue = chromeProgress?.progress;
  const shouldShowChromeProgress = chromeDiagnostic?.status === 'downloading' || isPreparingChrome || !!chromeProgress;
  const currentModelInstalled = ollamaConnected === true && ollamaModels.length > 0
    && ollamaModels.some(m => ollamaModelId(m) === localConfig.model);

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
        <section className="settings-workspace-section" data-testid="settings-provider-summary">
          <div className="settings-privacy-summary">
            <div className="settings-privacy-summary-header">
              <div className="settings-privacy-summary-icon">
                {activeProviderType === 'chrome' ? <Shield size={18} /> : activeProviderType === 'ollama' ? <Server size={18} /> : <Cloud size={18} />}
              </div>
              <div>
                <strong className="settings-privacy-summary-title">
                  {activeProviderType === 'chrome' ? 'Navegador (Chrome AI)' : activeProviderType === 'ollama' ? 'Local (Ollama)' : 'Externo (Cloud)'}
                </strong>
                <span className={`settings-privacy-summary-status settings-privacy-summary-status--${activeProviderType === 'cloud' ? 'external' : 'local'}`}>
                  {activeProviderType === 'cloud' ? 'Requiere API key' : '100 % local'}
                </span>
              </div>
            </div>
            <div className="settings-privacy-summary-body">
              <div className="settings-privacy-summary-col">
                <span className="settings-privacy-summary-col-label">Se queda en tu dispositivo</span>
                <ul>
                  <li>El archivo CSV completo</li>
                  <li>Perfil determinista y hallazgos</li>
                  {activeProviderType !== 'cloud' && <li>El diagnóstico del modelo</li>}
                  {activeProviderType === 'cloud' && <li>La respuesta recibida del proveedor</li>}
                </ul>
              </div>
              <div className="settings-privacy-summary-col">
                <span className="settings-privacy-summary-col-label">
                  {activeProviderType === 'cloud' ? 'Puede salir de tu dispositivo' : 'Nada sale de tu dispositivo'}
                </span>
                {activeProviderType === 'cloud' ? (
                  <ul>
                    <li>Paquete estructurado (columnas, estadísticas, hallazgos)</li>
                    <li>API key hacia el proveedor</li>
                  </ul>
                ) : (
                  <p className="settings-privacy-summary-note">La inferencia ocurre completamente dentro de tu navegador o red local.</p>
                )}
              </div>
            </div>
            <div className="settings-privacy-summary-footer">
              <span className={`settings-privacy-indicator settings-privacy-indicator--${activeProviderStatus.includes('Conectado') || activeProviderStatus.includes('Listo') || activeProviderStatus.includes('configurado') ? 'ok' : activeProviderStatus.includes('Sin') || activeProviderStatus.includes('pendiente') ? 'warn' : 'checking'}`} />
              <span className="settings-privacy-summary-footer-text" data-testid="settings-privacy-footer-status">
                {activeProviderType === 'chrome'
                  ? chromeDiagnostic?.status === 'available' ? 'Modelo listo en navegador' : chromeDiagnostic?.status === 'downloading' ? 'Descargando modelo' : 'No detectado en navegador'
                  : activeProviderType === 'ollama'
                    ? ollamaConnected === true ? 'Servidor Ollama respondiendo' : ollamaConnected === false ? 'Servidor sin respuesta' : 'Verificando conexión'
                    : localConfig.apiKey ? 'Clave API presente' : 'Requiere clave API'}
              </span>
            </div>
          </div>
        </section>

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
              {!recommendationMatchesActive && recommendedProviderMeta && (
                <p className="settings-active-provider-note">
                  AURA recomienda {recommendedProviderMeta.label} por disponibilidad actual, pero el diagnóstico usará {activeProvider.label} hasta que cambies el proveedor.
                </p>
              )}
              {!recommendedProviderMeta && (
                <p className="settings-active-provider-note">
                  Ningún proveedor listo. Prepara Chrome AI, conecta Ollama con un modelo instalado o guarda una API key Cloud válida.
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
                    <span className="settings-active-provider-meta">
                      Copia <code>chrome://on-device-internals</code> en la barra de Chrome para revisar el modelo.
                    </span>
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
                        <button className="btn-p btn-sm" onClick={() => setShowOllamaWizard(true)} data-testid="ollama-open-setup">
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
                  <>
                    <div className="settings-status-card settings-status-card--ok">
                      <CheckCircle size={14} className="settings-status-icon" />
                      <p>Ollama conectado en {ollamaBaseUrl}. {ollamaModels.length} modelos encontrados.</p>
                    </div>
                    <button className="btn-s btn-sm" onClick={() => setShowOllamaWizard(true)} data-testid="ollama-open-setup">
                      Administrar conexión y modelos
                    </button>
                  </>
                )}
              </div>

              <div className="settings-field">
                <label className="settings-label">Modelo Ollama</label>
                <select
                  value={localConfig.model}
                  onChange={(e) => {
                    const modelName = e.target.value;
                    setLocalConfig({ ...localConfig, model: modelName, ollamaModel: modelName });
                  }}
                  className="settings-select"
                  data-testid="ollama-model-select"
                >
                  {ollamaModels.map(m => (
                    <option key={ollamaModelId(m)} value={ollamaModelId(m)}>
                      {ollamaModelDisplayName(m)} · {(m.size / 1e9).toFixed(1)} GB
                    </option>
                  ))}
                  {!ollamaModels.some(m => ollamaModelId(m) === localConfig.model) && (
                    <option value={localConfig.model}>{localConfig.model} (no detectado)</option>
                  )}
                </select>
                <small>Lista obtenida en tiempo real desde <code>/api/tags</code>.</small>
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
                      <div key={ollamaModelId(m)} className="settings-model-card settings-model-card--compact">
                        <div>
                          <strong>{ollamaModelDisplayName(m)}</strong>
                          {ollamaModelId(m) === localConfig.model && (
                            <span className="settings-model-card-active" data-testid={`ollama-model-active-${ollamaModelId(m).replace(/[^a-zA-Z0-9]/g, '_')}`}>
                              <CheckCircle size={10} /> activo
                            </span>
                          )}
                          <span className="settings-model-card-meta">{(m.size / 1e9).toFixed(1)} GB</span>
                        </div>
                        <button
                          className="btn-s btn-sm"
                          onClick={() => handleUseOllamaModel(ollamaModelId(m))}
                          data-testid={`ollama-use-model-${ollamaModelId(m).replace(/[^a-zA-Z0-9]/g, '_')}`}
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
                    placeholder={DEFAULT_OLLAMA_MODEL_ID}
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
                <p>Ollama ejecuta modelos locales en tu máquina. El asistente de AURA verifica la conexión, descarga los modelos recomendados y muestra el avance real informado por Ollama.</p>
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

              <div className="settings-field">
                <label className="settings-label" htmlFor="aura-cloud-api-key">API Key (solo durante esta sesión)</label>
                <input
                  id="aura-cloud-api-key"
                  type="password"
                  value={localConfig.apiKey || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                  placeholder="Introduce la API key del proveedor"
                  className="settings-input"
                  autoComplete="off"
                />
              </div>

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

        <section className="settings-workspace-section" data-testid="evidence-modes-section">
          <h2 className="settings-section-title">Evidencia que recibe el modelo</h2>
          <p className="settings-section-desc">
            No estás eligiendo el modelo, sino cuánta evidencia técnica recibe durante el diagnóstico.
            El CSV original no cambia y el motor determinista es el mismo en los tres casos.
            Para la mayoría de usuarios se recomienda <strong>Evidencia equilibrada</strong>.
          </p>
          <div
            className="settings-provider-cards"
            role="radiogroup"
            aria-label="Cantidad de evidencia que recibe el modelo"
          >
            {INPUT_MODE_OPTIONS.map(option => {
              const isActive = activeInputMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setLocalConfig({ ...localConfig, inputMode: option.value })}
                  className={`settings-provider-card ${isActive ? 'settings-provider-card--active' : ''}`}
                  data-testid={`evidence-mode-${option.value}`}
                >
                  <div className="settings-provider-card-icon">
                    {isActive ? <CheckCircle size={18} /> : <Info size={18} />}
                  </div>
                  <div className="settings-provider-card-body">
                    <strong>{option.label}</strong>
                    <small>{option.summary}</small>
                  </div>
                  <ul className="settings-input-mode-card-list">
                    <li><strong>Cuándo:</strong> {option.whenToUse}</li>
                    <li><strong>Incluye:</strong> {option.includes}</li>
                    <li><strong>Ventaja:</strong> {option.advantage}</li>
                    <li><strong>Limitación:</strong> {option.limitation}</li>
                  </ul>
                  {option.recommended && (
                    <span className="settings-input-mode-card-badge" data-testid={`evidence-mode-badge-${option.value}`}>
                      Recomendado
                    </span>
                  )}
                  {isActive && <CheckCircle size={14} className="settings-provider-card-check" />}
                </button>
              );
            })}
          </div>
          <p className="settings-input-mode-desc" data-testid="evidence-mode-active-desc">
            <strong>{activeInputModeOption.label}.</strong> {activeInputModeOption.summary}
          </p>
        </section>

        {activeProviderType !== 'chrome' && <section className="settings-workspace-section">
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
        </section>}

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
                <li><strong>API keys:</strong> Permanecen solo en esta sesión del navegador; no se guardan en almacenamiento persistente, sync ni exportaciones.</li>
                <li><strong>Exportación:</strong> Tú decides qué exportar. Nada se exporta sin tu acción explícita.</li>
              </ul>
            </div>
          </details>
        </section>

        <div className="settings-workspace-save-bar">
          <button onClick={onClose} className="btn-s">Cancelar</button>
          <button onClick={handleSave} className="btn-p"><Save size={14} /> Guardar configuración</button>
        </div>
      </div>
      {showOllamaWizard && (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setShowOllamaWizard(false); }}>
          <div className="modal-container modal-container--lg">
            <OllamaSetupWizard
              endpoint={localConfig.ollamaBaseUrl}
              onReady={async (diagnostic) => {
                const model = diagnostic.details.selectedModel ?? localConfig.model;
                setLocalConfig({ ...localConfig, model, ollamaModel: model });
                setOllamaConnected(true);
                const snapshot = await refreshOllamaModelCatalog(localConfig.ollamaBaseUrl);
                setOllamaModels(snapshot.models);
                setShowOllamaWizard(false);
              }}
              onCancel={() => setShowOllamaWizard(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
};

export default SettingsPanel;
