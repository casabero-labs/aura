import React, { useState, useEffect } from 'react';
import { Settings, Save, HardDrive, AlertTriangle, CheckCircle, Download, Loader2, Cloud, Globe, Cpu, Trash2, FileCode2, ArrowLeft, Shield, HelpCircle, Wifi, Activity, Circle, Zap, Lock, Info } from 'lucide-react';
import { AIConfig, ModelDownloadState, CloudProvider, LocalModelStatus } from '../types';
import { AVAILABLE_MODELS, LOCAL_MODELS, checkWebGPUSupport, createAIProvider, deleteDownloadedModel, getLocalModelStatus, markPreloadVerified, clearPreloadVerification } from '../services/aiProvider';
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
    { id: 'cloud' as const, label: 'Cloud', icon: Cloud, desc: 'Más potente. Requiere API key y envía datos al proveedor.' },
    { id: 'local' as const, label: 'Local', icon: Cpu, desc: 'Privacidad total. Descarga pesada. Requiere WebGPU.' },
    { id: 'chrome' as const, label: 'Chrome AI', icon: Globe, desc: 'Experimental. Integrado en Chrome. Depende del navegador.' },
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onClose }) => {
    const [localConfig, setLocalConfig] = useState<AIConfig>(config);
    const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null);
    const [chromeAiSupported, setChromeAiSupported] = useState<boolean | null>(null);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<ModelDownloadState>({
        status: 'idle',
        progress: 0,
        message: '',
    });
    const [modelStatuses, setModelStatuses] = useState<Record<string, LocalModelStatus>>({});
    const [checkingModels, setCheckingModels] = useState<string[]>([]);

    useEffect(() => {
        checkWebGPUSupport().then(setWebGpuSupported);
        checkChromeAiSupport().then(setChromeAiSupported);
    }, []);

    useEffect(() => {
        if (localConfig.providerType === 'local') {
            refreshAllModelStatuses();
        }
    }, [localConfig.providerType]);

    const refreshAllModelStatuses = async () => {
        const statuses: Record<string, LocalModelStatus> = {};
        for (const model of LOCAL_MODELS) {
            statuses[model.id] = await getLocalModelStatus(model.id);
        }
        setModelStatuses(statuses);
    };

    const checkChromeAiSupport = async (): Promise<boolean> => {
        try {
            const { ChromePromptProvider } = await import('../services/providers/chromeProvider');
            const provider = new ChromePromptProvider(0.1);
            return provider.isAvailable();
        } catch {
            return false;
        }
    };

    const handleSave = () => {
        onSave(localConfig);
        onClose();
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
                providerType: 'local' as const,
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
            promptContract: {
                ...promptContract,
                ...patch,
            },
        });
    };

    const setProviderType = (type: 'cloud' | 'local' | 'chrome') => {
        const defaults: Record<string, string> = {
            cloud: 'deepseek-chat',
            local: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
            chrome: 'gemini-nano',
        };
        setLocalConfig({ ...localConfig, providerType: type, model: defaults[type] || localConfig.model });
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

    const recommendedProvider = webGpuSupported ? 'local' : 'cloud';

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
                        Elige cómo quieres que AURA interprete los hallazgos: local, cloud o navegador.
                    </p>
                </div>
                <button onClick={handleSave} className="btn-p">
                    <Save size={14} /> Guardar configuración
                </button>
            </div>

            <div className="settings-workspace-body">

                {/* A. Quick Recommendation */}
                <section className="settings-workspace-section">
                    <h2 className="settings-section-title">Recomendación rápida</h2>
                    <div className="settings-recommendation-card">
                        <div className="settings-recommendation-icon">
                            {recommendedProvider === 'local' ? <Shield size={20} /> : <Zap size={20} />}
                        </div>
                        <div>
                            <strong>{recommendedProvider === 'local' ? 'Local (recomendado)' : 'Cloud (recomendado)'}</strong>
                            <p>
                                {recommendedProvider === 'local'
                                    ? 'Tu navegador soporta WebGPU. Usa Local para máxima privacidad: el modelo se ejecuta en tu dispositivo sin enviar datos a ningún servidor.'
                                    : 'Tu navegador no soporta WebGPU o no se detectó. Usa Cloud para mayor velocidad y capacidad. Requiere una API key del proveedor que elijas.'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* B. Provider Selection */}
                <section className="settings-workspace-section">
                    <h2 className="settings-section-title">Proveedor de IA</h2>
                    <p className="settings-section-desc">
                        Local es más privado pero requiere descarga pesada y WebGPU. Cloud es más potente pero envía el paquete estructurado al proveedor. Chrome AI es experimental y depende del navegador.
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
                                    <div className="settings-provider-card-icon">
                                        <Icon size={18} />
                                    </div>
                                    <div className="settings-provider-card-body">
                                        <strong>{tab.label}</strong>
                                        <small>{tab.desc}</small>
                                    </div>
                                    {isActive && <CheckCircle size={14} className="settings-provider-card-check" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Cloud Provider Details */}
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

                    {/* Local Provider Details */}
                    {localConfig.providerType === 'local' && (
                        <div className="settings-provider-details">
                            <div className="settings-field">
                                <label className="settings-label">Infraestructura WebGPU</label>
                                {webGpuSupported === false && (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <AlertTriangle size={14} className="settings-status-icon" />
                                        <p>WebGPU no soportado. Necesitas Chrome/Edge 113+ con aceleración de hardware activada.</p>
                                    </div>
                                )}
                                {webGpuSupported === true && (
                                    <div className="settings-status-card settings-status-card--ok">
                                        <CheckCircle size={14} className="settings-status-icon" />
                                        <p>WebGPU disponible. Los modelos se ejecutan en tu GPU sin enviar datos externamente.</p>
                                    </div>
                                )}
                                {webGpuSupported === null && (
                                    <div className="settings-info-box">
                                        <Loader2 size={14} className="animate-spin" />
                                        <p>Verificando soporte WebGPU...</p>
                                    </div>
                                )}
                            </div>

                            {/* Local Model Selector */}
                            <div className="settings-field">
                                <label className="settings-label">Modelo local activo</label>
                                <select
                                    value={localConfig.model}
                                    onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                    className="settings-select"
                                >
                                    {LOCAL_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} (~{m.sizeGB}GB){m.recommended ? ' ★' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* C. Model Cards */}
                            <div className="settings-field">
                                <div className="settings-model-cards-header">
                                    <label className="settings-label">Modelos locales</label>
                                    <button className="btn-s btn-sm" onClick={refreshAllModelStatuses} disabled={checkingModels.length > 0}>
                                        <Activity size={10} /> Verificar todos
                                    </button>
                                </div>

                                <div className="settings-model-cards" data-testid="settings-model-cards">
                                    {LOCAL_MODELS.map(model => {
                                        const status = modelStatuses[model.id];
                                        const isDownloading = downloadingModel === model.id;
                                        const isChecking = checkingModels.includes(model.id);
                                        const isActive = localConfig.model === model.id;

                                        return (
                                            <div key={model.id} className={`settings-model-card ${isActive ? 'settings-model-card--active' : ''}`}>
                                                <div className="settings-model-card-main">
                                                    <strong className="settings-model-card-name">
                                                        {model.name}
                                                        {model.recommended && <span className="settings-model-recommended">★ Recomendado</span>}
                                                    </strong>
                                                    <div className="settings-model-card-meta">
                                                        <span>{model.sizeGB} GB</span>
                                                        <span className="settings-model-card-family">{model.family}</span>
                                                    </div>

                                                    {status && (
                                                        <div className={`settings-model-card-status settings-model-card-status--${status.status}`}>
                                                            {status.status === 'ready' && <CheckCircle size={10} />}
                                                            {status.status === 'partial' && <AlertTriangle size={10} />}
                                                            {status.status === 'not_downloaded' && <Circle size={10} />}
                                                            {status.status === 'error' && <AlertTriangle size={10} />}
                                                            {status.status === 'checking' && <Loader2 size={10} className="animate-spin" />}
                                                            <span>
                                                                {status.status === 'ready' && 'Verificado y listo'}
                                                                {status.status === 'partial' && 'Parcial / No verificado'}
                                                                {status.status === 'not_downloaded' && 'No descargado'}
                                                                {status.status === 'error' && 'Error'}
                                                                {status.status === 'checking' && 'Verificando...'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {status?.message && status.status !== 'checking' && (
                                                        <p className="settings-model-card-msg">{status.message}</p>
                                                    )}

                                                    {isDownloading && (
                                                        <div className="settings-download-card" style={{ marginTop: 'var(--space-sm)' }}>
                                                            <div className="settings-download-row">
                                                                <Loader2 size={14} className="settings-download-spinner" />
                                                                <span className="settings-download-message">{downloadProgress.message}</span>
                                                                <span className="settings-download-pct">{downloadProgress.progress}%</span>
                                                            </div>
                                                            <div className="settings-progress-track">
                                                                <div className="settings-progress-fill" style={{ width: `${downloadProgress.progress}%` }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="settings-model-card-actions" data-testid="model-download-action">
                                                    <button
                                                        className="btn-s btn-sm"
                                                        onClick={() => handleVerifyModel(model.id)}
                                                        disabled={isChecking || isDownloading}
                                                    >
                                                        <Activity size={10} /> {isChecking ? 'Verificando...' : 'Verificar'}
                                                    </button>

                                                    {(status?.status === 'not_downloaded' || status?.status === 'partial' || status?.status === 'error') && (
                                                        <button
                                                            className="btn-p btn-sm"
                                                            onClick={() => handleDownloadModel(model.id)}
                                                            disabled={isDownloading || !webGpuSupported}
                                                        >
                                                            <Download size={10} />
                                                            {status?.status === 'error' ? 'Reintentar' : 'Descargar'}
                                                        </button>
                                                    )}

                                                    {(status?.status === 'ready' || status?.status === 'partial' || status?.status === 'error') && (
                                                        <button
                                                            className="btn-s btn-sm settings-model-delete-btn"
                                                            onClick={() => handleDeleteModel(model.id)}
                                                            disabled={isDownloading || isChecking}
                                                        >
                                                            <Trash2 size={10} /> Eliminar
                                                        </button>
                                                    )}
                                                </div>

                                                <p className="settings-model-card-note">
                                                    {model.recommended
                                                        ? `La primera descarga puede tardar varios minutos y consumir ~${model.sizeGB}GB de espacio. Los modelos ★ son recomendados para análisis de datos.`
                                                        : `La primera descarga puede tardar y consumir ~${model.sizeGB}GB de espacio.`}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chrome AI Provider Details */}
                    {localConfig.providerType === 'chrome' && (
                        <div className="settings-provider-details">
                            <div className="settings-field">
                                <label className="settings-label">Estado de Chrome AI</label>
                                {chromeAiSupported === false && (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <AlertTriangle size={14} className="settings-status-icon" />
                                        <p>Chrome AI no disponible. Habilita chrome://flags/#prompt-api-for-gemini-nano y chrome://flags/#optimization-guide-on-device-model.</p>
                                    </div>
                                )}
                                {chromeAiSupported === true && (
                                    <div className="settings-status-card settings-status-card--ok">
                                        <CheckCircle size={14} className="settings-status-icon" />
                                        <p>Chrome AI (Gemini Nano) está disponible en este navegador.</p>
                                    </div>
                                )}
                                {chromeAiSupported === null && (
                                    <div className="settings-status-card settings-status-card--loading">
                                        <Loader2 size={14} className="settings-status-icon animate-spin" />
                                        <p>Verificando disponibilidad de Chrome AI...</p>
                                    </div>
                                )}
                            </div>
                            <div className="settings-info-box">
                                <Info size={14} />
                                <p>Gemini Nano está integrado en Chrome. No requiere descarga externa ni API key. Es experimental y su disponibilidad varía según la versión del navegador.</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* E. Temperature */}
                <section className="settings-workspace-section">
                    <h2 className="settings-section-title">Temperatura del modelo</h2>
                    <p className="settings-section-desc">
                        Controla la estabilidad de las respuestas del modelo. 0.0 = respuestas más deterministas y predecibles. 0.7 = respuestas más creativas y variables. Para auditoría de datos se recomienda 0.1 o 0.2.
                    </p>
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

                {/* Auto-Analysis */}
                <section className="settings-workspace-section">
                    <div className="settings-toggle-card">
                        <div>
                            <p className="settings-toggle-card-label">Ejecución automática</p>
                            <p className="settings-toggle-card-desc">Ejecuta el motor determinista automáticamente al cargar un dataset. Desactívalo si prefieres revisar la configuración antes de cada análisis.</p>
                        </div>
                        <label className="toggle">
                            <input
                                type="checkbox"
                                checked={localConfig.autoAnalyze}
                                onChange={(e) => setLocalConfig({ ...localConfig, autoAnalyze: e.target.checked })}
                                className="toggle-input"
                            />
                            <div className="toggle-track">
                                <div className="toggle-thumb" />
                            </div>
                        </label>
                    </div>
                </section>

                {/* F. Prompt Contract (Collapsible) */}
                <section className="settings-workspace-section">
                    <details className="settings-collapsible-section">
                        <summary className="settings-collapsible-summary">
                            <FileCode2 size={14} />
                            <span>Contrato técnico del diagnóstico (avanzado)</span>
                            <span className="settings-collapsible-hint">Controla cómo AURA le pide al modelo que responda</span>
                        </summary>
                        <div className="settings-collapsible-body">
                            <p className="settings-section-desc">
                                Esto controla cómo AURA le pide al modelo que responda. Si no sabes qué es, deja los valores por defecto. AURA conserva reglas anti-alucinación para que el benchmark sea comparable.
                            </p>

                            <div className="settings-field">
                                <label className="settings-label">Objetivo operativo</label>
                                <textarea
                                    value={promptContract.objective}
                                    onChange={(event) => updatePromptContract({ objective: event.target.value })}
                                    rows={3}
                                    maxLength={260}
                                    className="prompt-contract-textarea"
                                />
                                <p className="prompt-contract-hint">{promptContract.objective.length}/260 · Debe preparar una salida útil para diagnóstico, benchmark y script.</p>
                            </div>

                            <div className="prompt-contract-grid">
                                <button
                                    type="button"
                                    className={`prompt-contract-card ${promptContract.evidencePolicy === 'strict' ? 'active' : ''}`}
                                    onClick={() => updatePromptContract({ evidencePolicy: 'strict' })}
                                >
                                    <span>evidencia estricta</span>
                                    <small>Solo JSON observado; reduce alucinaciones.</small>
                                </button>
                                <button
                                    type="button"
                                    className={`prompt-contract-card ${promptContract.evidencePolicy === 'balanced' ? 'active' : ''}`}
                                    onClick={() => updatePromptContract({ evidencePolicy: 'balanced' })}
                                >
                                    <span>hipótesis separadas</span>
                                    <small>Permite hipótesis marcadas como no validadas.</small>
                                </button>
                            </div>

                            <div className="prompt-contract-checks">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={promptContract.requireScriptReadiness}
                                        onChange={(event) => updatePromptContract({ requireScriptReadiness: event.target.checked })}
                                    />
                                    <span>Preparar criterios para script Pandas</span>
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={promptContract.includeCopyPasteEvidence}
                                        onChange={(event) => updatePromptContract({ includeCopyPasteEvidence: event.target.checked })}
                                    />
                                    <span>Forzar evidencia copy-paste</span>
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={promptContract.includeHumanReviewLabels}
                                        onChange={(event) => updatePromptContract({ includeHumanReviewLabels: event.target.checked })}
                                    />
                                    <span>Etiquetar decisiones HITL</span>
                                </label>
                            </div>

                            <div className="settings-field" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="settings-label">Instrucción adicional guiada</label>
                                <textarea
                                    value={promptContract.extraInstructions || ''}
                                    onChange={(event) => updatePromptContract({ extraInstructions: event.target.value })}
                                    rows={4}
                                    maxLength={420}
                                    placeholder="Ejemplo: priorizar acciones reversibles, no convertir fechas ambiguas sin revisión humana..."
                                    className="prompt-contract-textarea"
                                />
                                <p className="prompt-contract-hint">No reemplaza el contrato base; solo agrega restricciones experimentales controladas.</p>
                            </div>
                        </div>
                    </details>
                </section>

                {/* G. Privacy & Data */}
                <section className="settings-workspace-section">
                    <details className="settings-collapsible-section">
                        <summary className="settings-collapsible-summary">
                            <Lock size={14} />
                            <span>Privacidad y datos</span>
                            <span className="settings-collapsible-hint">Qué sale y qué se queda en tu navegador</span>
                        </summary>
                        <div className="settings-collapsible-body">
                            <ul className="settings-privacy-list">
                                <li><strong>Local (WebGPU):</strong> El modelo se descarga y ejecuta completamente en tu navegador. Ningún dato sale de tu dispositivo. Los hallazgos, estadísticas y diagnóstico se procesan localmente.</li>
                                <li><strong>Cloud (API):</strong> Se envía un paquete estructurado al proveedor: columnas, estadísticas, hallazgos detectados y reglas activadas. <strong>No se envía el archivo CSV completo ni datos crudos de filas.</strong></li>
                                <li><strong>Chrome AI:</strong> Gemini Nano se ejecuta en el navegador. Similar a Local en privacidad.</li>
                                <li><strong>localStorage:</strong> AURA guarda tu configuración (proveedor, modelo, API key, temperatura) en localStorage del navegador. La API key se almacena localmente y solo se usa para llamadas a la API del proveedor.</li>
                                <li><strong>Exportación:</strong> Tú decides qué exportar (JSON, PDF, CSV, script). Nada se exporta sin tu acción explícita.</li>
                                <li><strong>Nunca subas:</strong> Datasets con información personal, sensible o protegida si no tienes permiso explícito para procesarlos.</li>
                            </ul>
                        </div>
                    </details>
                </section>

                {/* H. Troubleshooting */}
                <section className="settings-workspace-section">
                    <details className="settings-collapsible-section">
                        <summary className="settings-collapsible-summary">
                            <HelpCircle size={14} />
                            <span>Solución de problemas</span>
                            <span className="settings-collapsible-hint">Errores frecuentes y cómo resolverlos</span>
                        </summary>
                        <div className="settings-collapsible-body">
                            <ul className="settings-privacy-list">
                                <li><strong>Cache.add / network error:</strong> Ocurre al descargar modelos locales grandes. Intenta con un modelo más pequeño, verifica tu conexión, o limpia el caché del modelo y reintenta.</li>
                                <li><strong>WebGPU no soportado:</strong> Usa Chrome o Edge 113+. Activa la aceleración de hardware en chrome://settings. En Linux puede requerir flags adicionales. Como alternativa usa modo Cloud.</li>
                                <li><strong>Modelo parcial o corrupto:</strong> Usa "Eliminar" en la tarjeta del modelo y vuelve a descargar. Los restos de descargas incompletas pueden causar falsos positivos.</li>
                                <li><strong>API key inválida:</strong> Verifica que la key sea correcta y tenga créditos/saldo disponible. Algunos proveedores requieren configuración adicional de billing.</li>
                                <li><strong>Descarga lenta:</strong> Los modelos locales pueden pesar varios GB. La primera descarga es la más lenta. Usa WiFi en lugar de datos móviles.</li>
                                <li><strong>Diagnóstico vacío:</strong> Si el modelo no responde, AURA te permite continuar con el script determinista. El motor de reglas no depende del LLM.</li>
                                <li><strong>Cómo limpiar todos los modelos:</strong> Ve a Configuración, usa "Eliminar" en cada tarjeta de modelo, o limpia los datos del sitio desde la configuración del navegador.</li>
                            </ul>
                        </div>
                    </details>
                </section>

                {/* Save button at bottom */}
                <div className="settings-workspace-save-bar">
                    <button onClick={onClose} className="btn-s">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="btn-p">
                        <Save size={14} /> Guardar configuración
                    </button>
                </div>
            </div>
        </main>
    );
};

export default SettingsPanel;
