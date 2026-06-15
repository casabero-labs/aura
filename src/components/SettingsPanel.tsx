import React, { useState, useEffect } from 'react';
import { Settings, Save, HardDrive, AlertTriangle, CheckCircle, Download, Loader2, Cloud, Globe, Cpu, Trash2, FileCode2, ArrowLeft, Shield, HelpCircle, Wifi, Activity, Circle, Zap, Lock, Info, Server, RefreshCw } from 'lucide-react';
import { AIConfig, ModelDownloadState, CloudProvider, LocalModelStatus, ProviderProgressEvent } from '../types';
import { AVAILABLE_MODELS, LOCAL_MODELS, OLLAMA_MODELS, checkWebGPUSupport, createAIProvider, deleteDownloadedModel, getLocalModelStatus, markPreloadVerified, clearPreloadVerification, hasShownMigrationNotice, markMigrationNoticeShown, getChromeAiDiagnostic } from '../services/aiProvider';
import type { ChromeAiDiagnostic } from '../services/aiProvider';
import { OLLAMA_SUGGESTED_MODELS } from '../services/providers/ollamaProvider';
import type { OllamaModel } from '../services/providers/ollamaProvider';
import { normalizePromptContract } from '../services/providers/prompts';
import { normalizeAiProviderError } from '../services/providers/errors';

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

const isWebLLMExperimentalEnabled = (): boolean => {
    try {
        return import.meta.env.VITE_ENABLE_WEBLLM_EXPERIMENTAL === 'true';
    } catch {
        return false;
    }
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onClose }) => {
    const [localConfig, setLocalConfig] = useState<AIConfig>(config);
    const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null);
    const [chromeDiagnostic, setChromeDiagnostic] = useState<ChromeAiDiagnostic | null>(null);
    const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
    const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
    const [ollamaLoading, setOllamaLoading] = useState(false);
    const [ollamaPullProgress, setOllamaPullProgress] = useState<ProviderProgressEvent | null>(null);
    const [ollamaPullModel, setOllamaPullModel] = useState('');
    const [showMigrationNotice, setShowMigrationNotice] = useState(false);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<ModelDownloadState>({
        status: 'idle', progress: 0, message: '',
    });
    const [modelStatuses, setModelStatuses] = useState<Record<string, LocalModelStatus>>({});
    const [checkingModels, setCheckingModels] = useState<string[]>([]);

    useEffect(() => {
        checkWebGPUSupport().then(setWebGpuSupported);
        checkChromeDiagnostic();
        checkOllamaConnection();

        // Show migration notice once
        if (!hasShownMigrationNotice() && config.providerType === 'local') {
            setShowMigrationNotice(true);
        }
    }, []);

    useEffect(() => {
        if (isWebLLMExperimentalEnabled() && localConfig.providerType === 'webllm_experimental') {
            refreshAllModelStatuses();
        }
    }, [localConfig.providerType]);

    const checkChromeDiagnostic = async () => {
        try {
            const diag = await getChromeAiDiagnostic();
            setChromeDiagnostic(diag);
        } catch {
            setChromeDiagnostic(null);
        }
    };

    const checkOllamaConnection = async () => {
        setOllamaConnected(null);
        try {
            const baseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';
            const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
                setOllamaConnected(true);
                const data = await response.json();
                setOllamaModels(data.models || []);
            } else {
                setOllamaConnected(false);
            }
        } catch {
            setOllamaConnected(false);
        }
    };

    const handleFetchOllamaModels = async () => {
        setOllamaLoading(true);
        await checkOllamaConnection();
        setOllamaLoading(false);
    };

    const handleOllamaPull = async () => {
        const model = ollamaPullModel || localConfig.model || 'qwen2.5:3b';
        if (!model) return;
        setOllamaPullProgress({ stage: 'downloading', message: 'Iniciando descarga...', progress: 0 });
        try {
            const baseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';
            const provider = new (await import('../services/providers/ollamaProvider')).OllamaProvider(
                model, localConfig.temperature, baseUrl
            );
            await provider.pullModel(model, (progress, message) => {
                setOllamaPullProgress({ stage: 'downloading', progress, message });
            });
            setOllamaPullProgress({ stage: 'completed', progress: 100, message: `Modelo ${model} listo.` });
            await handleFetchOllamaModels();
        } catch (err: any) {
            setOllamaPullProgress({ stage: 'error', message: err.message, progress: 0 });
        }
    };

    const refreshAllModelStatuses = async () => {
        const statuses: Record<string, LocalModelStatus> = {};
        for (const model of LOCAL_MODELS) {
            statuses[model.id] = await getLocalModelStatus(model.id);
        }
        setModelStatuses(statuses);
    };

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    const handleDismissMigration = () => {
        markMigrationNoticeShown();
        setShowMigrationNotice(false);
        // Auto-migrate to a safe default
        setLocalConfig(prev => ({ ...prev, providerType: 'chrome', model: 'gemini-nano' }));
    };

    const handleDownloadModel = async (modelId: string) => {
        setDownloadingModel(modelId);
        setDownloadProgress({ status: 'downloading', progress: 0, message: 'Iniciando descarga...' });
        try {
            const provider = createAIProvider({ ...localConfig, model: modelId });
            await provider.preloadModel?.((progress, message) => {
                setDownloadProgress({ status: 'downloading', progress, message });
            });
            setDownloadProgress({ status: 'ready', progress: 100, message: 'Modelo listo para usar.' });
            markPreloadVerified(modelId);
            const updatedConfig = {
                ...localConfig,
                providerType: 'webllm_experimental' as const,
                model: modelId,
                modelDownloadState: {
                    ...(localConfig.modelDownloadState || {}),
                    [modelId]: { status: 'ready' as const, progress: 100, message: 'Listo' },
                },
            };
            setLocalConfig(updatedConfig);
            onSave(updatedConfig);
            setModelStatuses(prev => ({ ...prev, [modelId]: { status: 'ready', confidence: 'high', source: 'preload_verified', message: 'Descargado y verificado.' } }));
        } catch (err: any) {
            const normalized = normalizeAiProviderError(err, localConfig);
            const updatedConfig = {
                ...localConfig,
                modelDownloadState: {
                    ...(localConfig.modelDownloadState || {}),
                    [modelId]: { status: 'error' as const, progress: 0, message: normalized.message },
                },
            };
            setLocalConfig(updatedConfig);
            setDownloadProgress({ status: 'error', progress: 0, message: normalized.message });
            setModelStatuses(prev => ({ ...prev, [modelId]: { status: 'error', confidence: 'low', source: 'unknown', message: normalized.message } }));
        } finally {
            setDownloadingModel(null);
        }
    };

    const handleVerifyModel = async (modelId: string) => {
        setCheckingModels(prev => [...prev, modelId]);
        const status = await getLocalModelStatus(modelId);
        setModelStatuses(prev => ({ ...prev, [modelId]: status }));
        setCheckingModels(prev => prev.filter(id => id !== modelId));
    };

    const handleDeleteModel = async (modelId: string) => {
        await deleteDownloadedModel(modelId);
        clearPreloadVerification(modelId);
        setModelStatuses(prev => ({ ...prev, [modelId]: { status: 'not_downloaded', confidence: 'high', source: 'unknown', message: 'Modelo eliminado del caché.' } }));
    };

    const promptContract = normalizePromptContract(localConfig.promptContract);

    const updatePromptContract = (patch: Partial<typeof promptContract>) => {
        setLocalConfig({
            ...localConfig,
            promptContract: { ...promptContract, ...patch },
        });
    };

    const setProviderType = (type: 'chrome' | 'ollama' | 'cloud') => {
        const defaults: Record<string, string> = {
            chrome: 'gemini-nano',
            ollama: 'qwen2.5:3b',
            cloud: 'gemini-2.5-flash',
        };
        setLocalConfig({
            ...localConfig,
            providerType: type,
            model: defaults[type] || localConfig.model,
            cloudProvider: type === 'cloud' ? (localConfig.cloudProvider || 'google') : undefined,
        });
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

    const recommendedProvider = ollamaConnected ? 'ollama' : chromeAvailability === 'available' ? 'chrome' : 'cloud';

    const ollamaBaseUrl = localConfig.ollamaBaseUrl || 'http://localhost:11434';

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

                {/* Migration Notice */}
                {showMigrationNotice && (
                    <section className="settings-workspace-section">
                        <div className="settings-status-card settings-status-card--warn" style={{ padding: 'var(--space-md)' }}>
                            <AlertTriangle size={14} className="settings-status-icon" />
                            <div style={{ flex: 1 }}>
                                <strong>WebLLM quedó como modo experimental</strong>
                                <p>AURA ahora recomienda Chrome AI, Ollama o Cloud para mayor estabilidad. WebLLM presentaba fallos de Cache API/IndexedDB en navegador.</p>
                                <button className="btn-p btn-sm" onClick={handleDismissMigration} style={{ marginTop: 'var(--space-sm)' }}>
                                    Entendido, usar Chrome AI
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* A. Quick Recommendation */}
                <section className="settings-workspace-section">
                    <h2 className="settings-section-title">Recomendación rápida</h2>
                    <div className="settings-recommendation-card">
                        <div className="settings-recommendation-icon">
                            {recommendedProvider === 'ollama' ? <Server size={20} /> :
                             recommendedProvider === 'chrome' ? <Shield size={20} /> :
                             <Zap size={20} />}
                        </div>
                        <div>
                            <strong>
                                {recommendedProvider === 'ollama' ? 'Ollama local (recomendado)' :
                                 recommendedProvider === 'chrome' ? 'Chrome AI (recomendado)' :
                                 'Cloud (recomendado)'}
                            </strong>
                            <p>
                                {recommendedProvider === 'ollama'
                                    ? 'Ollama responde en localhost. Máxima privacidad con modelos locales sin depender del navegador.'
                                    : recommendedProvider === 'chrome'
                                    ? 'Chrome AI está disponible en este navegador. Procesa localmente sin enviar datos a terceros.'
                                    : 'Usa Cloud para mayor velocidad y capacidad. Requiere una API key del proveedor que elijas.'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* B. Provider Selection */}
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

                    {/* Chrome AI Details */}
                    {localConfig.providerType === 'chrome' && (
                        <div className="settings-provider-details">
                            <div className="settings-field">
                                <label className="settings-label">Estado de Chrome AI</label>
                                {!chromeDiagnostic ? (
                                    <div className="settings-info-box">
                                        <Loader2 size={14} className="animate-spin" />
                                        <p>Verificando disponibilidad de Chrome AI...</p>
                                    </div>
                                ) : chromeDiagnostic.status === 'available' ? (
                                    <div className="settings-status-card settings-status-card--ok">
                                        <CheckCircle size={14} className="settings-status-icon" />
                                        <div>
                                            <p>{chromeDiagnostic.message}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '2px' }}>
                                                API: {chromeDiagnostic.apiSurface}
                                            </p>
                                        </div>
                                    </div>
                                ) : chromeDiagnostic.status === 'downloadable' ? (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <Download size={14} className="settings-status-icon" />
                                        <div>
                                            <p>{chromeDiagnostic.message}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '2px' }}>
                                                API: {chromeDiagnostic.apiSurface} · Pulsa "Preparar Gemini Nano" para iniciar.
                                            </p>
                                        </div>
                                    </div>
                                ) : chromeDiagnostic.status === 'error' ? (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <AlertTriangle size={14} className="settings-status-icon" />
                                        <div>
                                            <p>{chromeDiagnostic.message}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '2px' }}>
                                                API: {chromeDiagnostic.apiSurface}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <AlertTriangle size={14} className="settings-status-icon" />
                                        <div>
                                            <p>{chromeDiagnostic.message}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '2px' }}>
                                                API: {chromeDiagnostic.apiSurface === 'none' ? 'No detectada' : chromeDiagnostic.apiSurface}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {chromeDiagnostic && chromeDiagnostic.status !== 'available' && (
                                <div className="settings-field">
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                        <button className="btn-s btn-sm" onClick={checkChromeDiagnostic}>
                                            <RefreshCw size={10} /> Verificar estado
                                        </button>
                                        {chromeDiagnostic.status === 'downloadable' && (
                                            <button className="btn-p btn-sm" onClick={async () => {
                                                try {
                                                    const { ChromePromptProvider } = await import('../services/providers/chromeProvider');
                                                    const provider = new ChromePromptProvider(localConfig.temperature);
                                                    await provider.preloadModel((pct, msg) => {
                                                        setOllamaPullProgress({ stage: 'downloading', progress: pct, message: msg });
                                                    });
                                                    await checkChromeDiagnostic();
                                                } catch (err: any) {
                                                    setOllamaPullProgress({ stage: 'error', message: err.message });
                                                }
                                            }}>
                                                <Download size={10} /> Preparar Gemini Nano
                                            </button>
                                        )}
                                        <button className="btn-s btn-sm" onClick={() => setProviderType('ollama')}>
                                            <Server size={10} /> Usar Ollama
                                        </button>
                                        <button className="btn-s btn-sm" onClick={() => setProviderType('cloud')}>
                                            <Cloud size={10} /> Usar Cloud
                                        </button>
                                    </div>
                                </div>
                            )}

                            <details className="settings-collapsible-section" style={{ marginTop: 'var(--space-sm)' }}>
                                <summary className="settings-collapsible-summary" style={{ fontSize: '13px', padding: '8px 0' }}>
                                    <HelpCircle size={12} />
                                    <span>Cómo activar Chrome AI</span>
                                </summary>
                                <div className="settings-collapsible-body" style={{ paddingTop: 'var(--space-sm)' }}>
                                    <ol style={{ fontSize: '13px', lineHeight: 1.7, paddingLeft: '20px', color: 'var(--ink2)' }}>
                                        <li>Actualiza Chrome a la versión más reciente (138+).</li>
                                        <li>Abre <code style={{ fontSize: '12px' }}>chrome://flags</code> en una pestaña nueva.</li>
                                        <li>Busca <strong>"Prompt API"</strong>, <strong>"Gemini Nano"</strong> o <strong>"Built-in AI"</strong>.</li>
                                        <li>Activa las opciones disponibles (los nombres pueden variar según versión).</li>
                                        <li>Reinicia Chrome.</li>
                                        <li>Vuelve a AURA y pulsa <strong>Verificar estado</strong>.</li>
                                    </ol>
                                    <p style={{ fontSize: '12px', color: 'var(--ink3)', marginTop: 'var(--space-sm)' }}>
                                        También puedes revisar <code style={{ fontSize: '11px' }}>chrome://on-device-internals</code> para ver modelos on-device disponibles y estado de descarga.
                                    </p>
                                </div>
                            </details>

                            <div className="settings-info-box">
                                <Info size={14} />
                                <p>Gemini Nano está integrado en Chrome. No requiere descarga externa ni API key. Requisitos: macOS 13+, GPU {'>'}4GB VRAM o CPU 16GB RAM con 4 cores, ~22GB libres en el perfil de Chrome. No funciona en Chrome móvil (iOS/Android).</p>
                            </div>
                        </div>
                    )}

                    {/* Ollama Details */}
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
                                        <RefreshCw size={10} className={ollamaLoading ? 'animate-spin' : ''} /> Probar
                                    </button>
                                </div>
                                {!ollamaBaseUrl.includes('localhost') && !ollamaBaseUrl.includes('127.0.0.1') && (
                                    <div className="settings-status-card settings-status-card--warn" style={{ marginTop: 'var(--space-sm)' }}>
                                        <AlertTriangle size={12} />
                                        <p>No expongas Ollama en red pública sin autenticación.</p>
                                    </div>
                                )}
                            </div>

                            <div className="settings-field">
                                <label className="settings-label">Conexión</label>
                                {ollamaConnected === null && (
                                    <div className="settings-info-box">
                                        <Loader2 size={14} className="animate-spin" />
                                        <p>Verificando conexión con Ollama...</p>
                                    </div>
                                )}
                                {ollamaConnected === false && (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <AlertTriangle size={14} className="settings-status-icon" />
                                        <div>
                                            <p>Ollama no responde en {ollamaBaseUrl}. Verifica que Ollama esté abierto.</p>
                                            <p style={{ fontSize: '12px', marginTop: '4px' }}>
                                                Si el navegador bloquea la conexión, configura OLLAMA_ORIGINS para permitir el origen de AURA.
                                            </p>
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
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <select
                                        value={localConfig.model}
                                        onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value, ollamaModel: e.target.value })}
                                        className="settings-select"
                                        style={{ flex: 1 }}
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
                            </div>

                            {ollamaConnected && ollamaModels.length > 0 && (
                                <div className="settings-field">
                                    <label className="settings-label">Modelos instalados ({ollamaModels.length})</label>
                                    <div className="settings-model-cards">
                                        {ollamaModels.slice(0, 10).map(m => (
                                            <div key={m.name} className="settings-model-card settings-model-card--compact">
                                                <strong>{m.name}</strong>
                                                <span className="settings-model-card-meta">{(m.size / 1e9).toFixed(1)} GB</span>
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
                                    <button className="btn-p btn-sm" onClick={handleOllamaPull} disabled={!!ollamaPullProgress && ollamaPullProgress.stage === 'downloading'}>
                                        <Download size={10} /> Descargar
                                    </button>
                                </div>
                                {ollamaPullProgress && ollamaPullProgress.stage !== 'idle' && (
                                    <div className="settings-download-card" style={{ marginTop: 'var(--space-sm)' }}>
                                        <div className="settings-download-row">
                                            {ollamaPullProgress.stage === 'downloading' && <Loader2 size={14} className="settings-download-spinner" />}
                                            <span className="settings-download-message">{ollamaPullProgress.message}</span>
                                            {ollamaPullProgress.progress !== undefined && (
                                                <span className="settings-download-pct">{ollamaPullProgress.progress}%</span>
                                            )}
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
                                <p>Ollama ejecuta modelos locales en tu máquina. Requiere tener Ollama instalado y abierto. Modelos sugeridos: qwen2.5:3b, llama3.2:3b. No se descarga ningún modelo automáticamente.</p>
                            </div>
                        </div>
                    )}

                    {/* Cloud Details */}
                    {localConfig.providerType === 'cloud' && (
                        <div className="settings-provider-details">
                            <div className="settings-field">
                                <label className="settings-label">Proveedor Cloud</label>
                                <select
                                    value={localConfig.cloudProvider || 'google'}
                                    onChange={(e) => {
                                        const cloudProvider = e.target.value as CloudProvider;
                                        const models = cloudsForProvider(cloudProvider);
                                        setLocalConfig({
                                            ...localConfig,
                                            cloudProvider,
                                            model: models[0]?.id || localConfig.model,
                                        });
                                    }}
                                    className="settings-select"
                                >
                                    {CLOUD_PROVIDERS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
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
                                <p>En modo Cloud, AURA envía solo el paquete estructurado (hallazgos, columnas, estadísticas), nunca el archivo CSV completo.</p>
                            </div>
                        </div>
                    )}

                    {/* WebLLM Experimental (hidden by default) */}
                    {isWebLLMExperimentalEnabled() && (
                        <details className="settings-collapsible-section" style={{ marginTop: 'var(--space-md)' }}>
                            <summary className="settings-collapsible-summary">
                                <Cpu size={14} />
                                <span>WebLLM experimental (solo desarrollo)</span>
                                <span className="settings-collapsible-hint">Oculto en producción. Activar con VITE_ENABLE_WEBLLM_EXPERIMENTAL=true</span>
                            </summary>
                            <div className="settings-collapsible-body">
                                <div className="settings-status-card settings-status-card--warn">
                                    <AlertTriangle size={14} className="settings-status-icon" />
                                    <p>WebLLM es experimental. Puede fallar con Cache API/IndexedDB. Se recomienda Chrome AI, Ollama o Cloud para producción.</p>
                                </div>

                                <div className="settings-field" style={{ marginTop: 'var(--space-sm)' }}>
                                    <label className="settings-label">Infraestructura WebGPU</label>
                                    {webGpuSupported === false && (
                                        <div className="settings-status-card settings-status-card--warn">
                                            <AlertTriangle size={14} />
                                            <p>WebGPU no soportado.</p>
                                        </div>
                                    )}
                                    {webGpuSupported === true && (
                                        <div className="settings-status-card settings-status-card--ok">
                                            <CheckCircle size={14} />
                                            <p>WebGPU disponible.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="settings-field">
                                    <label className="settings-label">Modelo WebLLM activo</label>
                                    <select
                                        value={localConfig.model}
                                        onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value, providerType: 'webllm_experimental' })}
                                        className="settings-select"
                                    >
                                        {LOCAL_MODELS.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} (~{m.sizeGB}GB){m.recommended ? ' ★' : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="settings-field">
                                    <div className="settings-model-cards-header">
                                        <label className="settings-label">Modelos WebLLM</label>
                                        <button className="btn-s btn-sm" onClick={refreshAllModelStatuses} disabled={checkingModels.length > 0}>
                                            <Activity size={10} /> Verificar todos
                                        </button>
                                    </div>
                                    <div className="settings-model-cards" data-testid="settings-model-cards">
                                        {LOCAL_MODELS.map(model => {
                                            const status = modelStatuses[model.id];
                                            const isDownloading = downloadingModel === model.id;
                                            const isChecking = checkingModels.includes(model.id);
                                            return (
                                                <div key={model.id} className="settings-model-card">
                                                    <div className="settings-model-card-main">
                                                        <strong>{model.name}{model.recommended && <span className="settings-model-recommended">★</span>}</strong>
                                                        <div className="settings-model-card-meta">
                                                            <span>{model.sizeGB} GB</span>
                                                            <span>{model.family}</span>
                                                        </div>
                                                        {status && (
                                                            <div className={`settings-model-card-status settings-model-card-status--${status.status}`}>
                                                                {status.status === 'ready' && <><CheckCircle size={10} /><span>Listo</span></>}
                                                                {status.status === 'partial' && <><AlertTriangle size={10} /><span>Parcial</span></>}
                                                                {status.status === 'not_downloaded' && <><Circle size={10} /><span>No descargado</span></>}
                                                                {status.status === 'error' && <><AlertTriangle size={10} /><span>Error</span></>}
                                                            </div>
                                                        )}
                                                        {isDownloading && (
                                                            <div className="settings-download-card">
                                                                <div className="settings-download-row">
                                                                    <Loader2 size={14} className="settings-download-spinner" />
                                                                    <span>{downloadProgress.message}</span>
                                                                    <span>{downloadProgress.progress}%</span>
                                                                </div>
                                                                <div className="settings-progress-track">
                                                                    <div className="settings-progress-fill" style={{ width: `${downloadProgress.progress}%` }} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="settings-model-card-actions">
                                                        <button className="btn-s btn-sm" onClick={() => handleVerifyModel(model.id)} disabled={isChecking || isDownloading}>
                                                            <Activity size={10} /> {isChecking ? 'Verificando' : 'Verificar'}
                                                        </button>
                                                        {(status?.status === 'not_downloaded' || status?.status === 'partial' || status?.status === 'error') && (
                                                            <button className="btn-p btn-sm" onClick={() => handleDownloadModel(model.id)} disabled={isDownloading || !webGpuSupported}>
                                                                <Download size={10} /> {status?.status === 'error' ? 'Reintentar' : 'Descargar'}
                                                            </button>
                                                        )}
                                                        {(status?.status === 'ready' || status?.status === 'partial' || status?.status === 'error') && (
                                                            <button className="btn-s btn-sm" onClick={() => handleDeleteModel(model.id)} disabled={isDownloading || isChecking}>
                                                                <Trash2 size={10} /> Eliminar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </details>
                    )}
                </section>

                {/* Temperature */}
                <section className="settings-workspace-section">
                    <h2 className="settings-section-title">Temperatura del modelo</h2>
                    <p className="settings-section-desc">
                        Controla la estabilidad de las respuestas. 0.0 = más determinista. 0.7 = más creativo. Para auditoría se recomienda 0.1.
                    </p>
                    <div className="settings-field">
                        <label className="settings-label">Temperatura: {(localConfig.temperature ?? 0.1).toFixed(1)}</label>
                        <div className="settings-slider-row">
                            <span className="settings-slider-label">0.0 — Estable</span>
                            <input
                                type="range" min="0" max="1" step="0.1"
                                value={localConfig.temperature ?? 0.1}
                                onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
                                className="settings-slider"
                            />
                            <span className="settings-slider-label">Creativo — 1.0</span>
                        </div>
                    </div>
                </section>

                {/* Auto-Analysis */}
                <section className="settings-workspace-section">
                    <div className="settings-toggle-card">
                        <div>
                            <p className="settings-toggle-card-label">Ejecución automática</p>
                            <p className="settings-toggle-card-desc">Ejecuta el motor determinista automáticamente al cargar un dataset.</p>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={localConfig.autoAnalyze} onChange={(e) => setLocalConfig({ ...localConfig, autoAnalyze: e.target.checked })} className="toggle-input" />
                            <div className="toggle-track"><div className="toggle-thumb" /></div>
                        </label>
                    </div>
                </section>

                {/* Prompt Contract */}
                <section className="settings-workspace-section">
                    <details className="settings-collapsible-section">
                        <summary className="settings-collapsible-summary">
                            <FileCode2 size={14} />
                            <span>Contrato técnico del diagnóstico (avanzado)</span>
                            <span className="settings-collapsible-hint">Controla cómo AURA le pide al modelo que responda</span>
                        </summary>
                        <div className="settings-collapsible-body">
                            <p className="settings-section-desc">Esto controla cómo AURA le pide al modelo que responda. Si no sabes qué es, deja los valores por defecto.</p>
                            <div className="settings-field">
                                <label className="settings-label">Objetivo operativo</label>
                                <textarea value={promptContract.objective} onChange={(e) => updatePromptContract({ objective: e.target.value })} rows={3} maxLength={260} className="prompt-contract-textarea" />
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
                            <div className="settings-field" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="settings-label">Instrucción adicional guiada</label>
                                <textarea value={promptContract.extraInstructions || ''} onChange={(e) => updatePromptContract({ extraInstructions: e.target.value })} rows={4} maxLength={420} placeholder="Ej: priorizar acciones reversibles..." className="prompt-contract-textarea" />
                                <p className="prompt-contract-hint">No reemplaza el contrato base; solo agrega restricciones experimentales controladas.</p>
                            </div>
                        </div>
                    </details>
                </section>

                {/* Privacy & Data */}
                <section className="settings-workspace-section">
                    <details className="settings-collapsible-section">
                        <summary className="settings-collapsible-summary">
                            <Lock size={14} />
                            <span>Privacidad y datos</span>
                            <span className="settings-collapsible-hint">Qué sale y qué se queda en tu navegador</span>
                        </summary>
                        <div className="settings-collapsible-body">
                            <ul className="settings-privacy-list">
                                <li><strong>Chrome AI:</strong> Gemini Nano se ejecuta en el navegador. Ningún dato sale de tu dispositivo. Privacidad total.</li>
                                <li><strong>Ollama local:</strong> La inferencia ocurre en tu máquina vía servidor local. Los datos no salen de tu red local.</li>
                                <li><strong>Cloud (API):</strong> Se envía un paquete estructurado al proveedor: columnas, estadísticas, hallazgos detectados. <strong>No se envía el archivo CSV completo.</strong></li>
                                <li><strong>localStorage:</strong> AURA guarda tu configuración en localStorage. La API key se almacena localmente.</li>
                                <li><strong>Exportación:</strong> Tú decides qué exportar. Nada se exporta sin tu acción explícita.</li>
                            </ul>
                        </div>
                    </details>
                </section>

                {/* Troubleshooting */}
                <section className="settings-workspace-section">
                    <details className="settings-collapsible-section">
                        <summary className="settings-collapsible-summary">
                            <HelpCircle size={14} />
                            <span>Solución de problemas</span>
                            <span className="settings-collapsible-hint">Errores frecuentes y cómo resolverlos</span>
                        </summary>
                        <div className="settings-collapsible-body">
                            <ul className="settings-privacy-list">
                                <li><strong>Ollama no responde:</strong> Verifica que Ollama esté abierto. Configura OLLAMA_ORIGINS si el navegador bloquea CORS.</li>
                                <li><strong>Chrome AI no disponible:</strong> Habilita chrome://flags/#prompt-api-for-gemini-nano. Requiere Chrome 127+.</li>
                                <li><strong>API key inválida:</strong> Verifica que la key sea correcta y tenga créditos disponible.</li>
                                <li><strong>Diagnóstico vacío:</strong> Puedes continuar con el script determinista. El motor de reglas no depende del LLM.</li>
                                <li><strong>WebLLM (experimental):</strong> Presenta fallos de Cache API/IndexedDB. Se recomienda Chrome AI u Ollama.</li>
                            </ul>
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
