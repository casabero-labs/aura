import React, { useState, useEffect } from 'react';
import { Settings, X, Save, HardDrive, AlertTriangle, CheckCircle, Download, Loader2, Cloud, Globe, Cpu, Trash2, FileCode2 } from 'lucide-react';
import { AIConfig, ModelDownloadState, CloudProvider } from '../types';
import { AVAILABLE_MODELS, LOCAL_MODELS, checkWebGPUSupport, createAIProvider, checkModelDownloaded, deleteDownloadedModel } from '../services/aiProvider';
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
    { id: 'cloud' as const, label: 'Cloud', icon: Cloud },
    { id: 'local' as const, label: 'Local', icon: Cpu },
    { id: 'chrome' as const, label: 'Chrome AI', icon: Globe },
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

    useEffect(() => {
        checkWebGPUSupport().then(setWebGpuSupported);
        checkChromeAiSupport().then(setChromeAiSupported);
    }, []);

    useEffect(() => {
        if (localConfig.providerType !== 'local') return;

        const syncDownloadedModels = async () => {
            const updatedStates = { ...(localConfig.modelDownloadState || {}) };
            let changed = false;

            for (const model of LOCAL_MODELS) {
                if (updatedStates[model.id]?.status === 'ready') continue;
                if (await checkModelDownloaded(model.id)) {
                    updatedStates[model.id] = { status: 'ready', progress: 100, message: 'Detectado en caché local' };
                    changed = true;
                }
            }

            if (changed) {
                setLocalConfig((current) => ({ ...current, modelDownloadState: updatedStates }));
            }
        };

        syncDownloadedModels();
    }, [localConfig.providerType]);

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
        } catch (err: any) {
            // Normalizar el error para mensajes más claros
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
        } finally {
            setDownloadingModel(null);
        }
    };

    const getModelState = (modelId: string): ModelDownloadState | undefined => {
        return localConfig.modelDownloadState?.[modelId];
    };

    const currentModelState = getModelState(localConfig.model);
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

    return (
        <div className="settings-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-sheet-title" onClick={onClose}>
            <aside className="settings-sheet" onClick={(event) => event.stopPropagation()}>

                <div className="settings-header">
                    <div className="settings-header-left">
                        <div className="settings-header-icon">
                            <Settings size={16} />
                        </div>
                        <div>
                            <h2 id="settings-sheet-title" className="settings-header-title">Configuración de modelos</h2>
                            <p className="settings-header-sub">Proveedor de IA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="settings-close-btn">
                        <X size={18} />
                    </button>
                </div>

                <div className="settings-body">

                    {/* Provider Type Tabs */}
                    <div className="settings-tabs">
                        {PROVIDER_TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setProviderType(tab.id)}
                                    className={`settings-tab ${localConfig.providerType === tab.id ? 'active' : ''}`}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Cloud Provider */}
                    {localConfig.providerType === 'cloud' && (
                        <>
                            <div className="settings-section">
                                <label className="settings-label">Proveedor Cloud</label>
                                <div className="settings-select-wrap">
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
                            </div>

                            {localConfig.cloudProvider !== 'openrouter' && (
                                <div className="settings-section">
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

                            <div className="settings-section">
                                <label className="settings-label">Modelo</label>
                                <div className="settings-select-wrap">
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
                            </div>
                        </>
                    )}

                    {/* Local Provider */}
                    {localConfig.providerType === 'local' && (
                        <>
                            <div className="settings-section">
                                <label className="settings-label">Infraestructura</label>
                                {webGpuSupported === false && (
                                    <div className="settings-status-card settings-status-card--warn">
                                        <AlertTriangle size={14} className="settings-status-icon" />
                                        <p>WebGPU no soportado. Usa Chrome/Edge 113+.</p>
                                    </div>
                                )}
                                {webGpuSupported === true && (
                                    <div className="settings-status-card settings-status-card--ok">
                                        <CheckCircle size={14} className="settings-status-icon" />
                                        <p>WebGPU disponible. El modelo se ejecuta en tu dispositivo sin enviar datos a servidores.</p>
                                    </div>
                                )}
                            </div>

                            <div className="settings-section">
                                <label className="settings-label">Modelo Local ({LOCAL_MODELS.length} disponibles)</label>
                                <div className="settings-select-wrap">
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
                                    <div className="settings-select-icon">
                                        <HardDrive size={14} />
                                    </div>
                                </div>

                                {webGpuSupported && (
                                    <div style={{display:'flex',flexDirection:'column',gap:'var(--space-xs)'}}>
                                        {currentModelState?.status === 'ready' ? (
                                            <div className="settings-model-ready">
                                                <CheckCircle size={14} className="settings-model-ready-icon" />
                                                <span className="settings-model-ready-text">Modelo descargado y listo para usar.</span>
                                                <button
                                                    onClick={async () => {
                                                        await deleteDownloadedModel(localConfig.model);
                                                        const updatedStates = { ...(localConfig.modelDownloadState || {}) };
                                                        delete updatedStates[localConfig.model];
                                                        setLocalConfig({ ...localConfig, modelDownloadState: updatedStates });
                                                    }}
                                                    className="settings-model-delete"
                                                >
                                                    <Trash2 size={12} /> Eliminar
                                                </button>
                                            </div>
                                        ) : downloadingModel === localConfig.model ? (
                                            <div className="settings-download-card">
                                                <div className="settings-download-row">
                                                    <Loader2 size={14} className="settings-download-spinner" />
                                                    <span className="settings-download-message">{downloadProgress.message}</span>
                                                    <span className="settings-download-pct">{downloadProgress.progress}%</span>
                                                </div>
                                                <div className="settings-progress-track">
                                                    <div
                                                        className="settings-progress-fill"
                                                        style={{ width: `${downloadProgress.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleDownloadModel(localConfig.model)}
                                                disabled={downloadProgress.status === 'downloading'}
                                                className="settings-download-btn"
                                            >
                                                <Download size={14} />
                                                {currentModelState?.status === 'error' ? 'Reintentar descarga' : 'Descargar modelo para uso offline'}
                                            </button>
                                        )}
                                        {currentModelState?.status === 'error' && (
                                            <div className="settings-error-msg" style={{ 
                                                marginTop: 'var(--space-xs)',
                                                padding: 'var(--space-sm)',
                                                background: 'var(--error-surface)',
                                                border: '1px solid var(--error-border)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '12px'
                                            }}>
                                                <p style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--error)' }}>{currentModelState.message}</p>
                                                <p style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--ink3)' }}>
                                                    Si la descarga falla, intenta:
                                                </p>
                                                <ul style={{ margin: 0, paddingLeft: 'var(--space-md)' }}>
                                                    <li>Eliminar el modelo cacheado y volver a intentar</li>
                                                    <li>Verificar tu conexión a internet</li>
                                                    <li>Libiar espacio en disco</li>
                                                </ul>
                                            </div>
                                        )}
                                        <p className="settings-hint">
                                            El modelo se almacena en caché del navegador. Los modelos ★ son recomendados para análisis de datos.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Chrome AI Provider */}
                    {localConfig.providerType === 'chrome' && (
                        <div className="settings-section">
                            <label className="settings-label">Chrome AI</label>
                            {chromeAiSupported === false && (
                                <div className="settings-status-card settings-status-card--warn">
                                    <AlertTriangle size={14} className="settings-status-icon" />
                                    <p>Chrome AI no disponible. Habilita chrome://flags/#prompt-api-for-gemini-nano.</p>
                                </div>
                            )}
                            {chromeAiSupported === true && (
                                <div className="settings-status-card settings-status-card--ok">
                                    <CheckCircle size={14} className="settings-status-icon" />
                                    <p>Chrome AI (Gemini Nano) está disponible.</p>
                                </div>
                            )}
                            {chromeAiSupported === null && (
                                <div className="settings-status-card settings-status-card--loading">
                                    <Loader2 size={14} className="settings-status-icon animate-spin" />
                                    <p>Verificando disponibilidad...</p>
                                </div>
                            )}
                            <p className="settings-hint">
                                Gemini Nano está integrado en Chrome. No requiere descarga de modelos ni API keys.
                            </p>
                        </div>
                    )}

                    {/* Temperatura */}
                    <div className="settings-section">
                        <label className="settings-label">Temperatura <span>{(localConfig.temperature ?? 0.1).toFixed(1)}</span></label>
                        <div className="settings-slider-row">
                            <span className="settings-slider-label">0.0</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={localConfig.temperature ?? 0.1}
                                onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
                                className="settings-slider"
                            />
                            <span className="settings-slider-label">1.0</span>
                        </div>
                    </div>

                    {/* Auto-Análisis */}
                    <div className="settings-toggle-card">
                        <div>
                            <p className="settings-toggle-card-label">Auto-Análisis</p>
                            <p className="settings-toggle-card-desc">Ejecutar motor al cargar dataset</p>
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

                    <div className="prompt-contract-editor">
                        <div className="prompt-contract-head">
                            <FileCode2 size={14} />
                            <div>
                                <strong>Contrato técnico del diagnóstico</strong>
                                <p>Edita la estructura del prompt con controles guiados. AURA conserva reglas anti-alucinación para que el benchmark siga siendo comparable.</p>
                            </div>
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Objetivo operativo</label>
                            <textarea
                                value={promptContract.objective}
                                onChange={(event) => updatePromptContract({ objective: event.target.value })}
                                rows={3}
                                maxLength={260}
                                className="prompt-contract-textarea"
                            />
                            <p className="prompt-contract-hint">{promptContract.objective.length}/260 · debe preparar una salida útil para diagnóstico, benchmark y script.</p>
                        </div>

                        <div className="prompt-contract-grid">
                            <button
                                type="button"
                                className={`prompt-contract-card ${promptContract.evidencePolicy === 'strict' ? 'active' : ''}`}
                                onClick={() => updatePromptContract({ evidencePolicy: 'strict' })}
                            >
                                <span>evidencia estricta</span>
                                <small>Solo JSON observado; mejor para reducir alucinaciones.</small>
                            </button>
                            <button
                                type="button"
                                className={`prompt-contract-card ${promptContract.evidencePolicy === 'balanced' ? 'active' : ''}`}
                                onClick={() => updatePromptContract({ evidencePolicy: 'balanced' })}
                            >
                                <span>hipótesis separadas</span>
                                <small>Permite hipótesis, siempre marcadas como no validadas.</small>
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

                        <div className="settings-section">
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

                </div>

                <div className="settings-footer">
                    <button onClick={onClose} className="cs-button">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="cs-button-primary"
                    >
                        <Save size={14} /> Guardar
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default SettingsPanel;
