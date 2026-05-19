import React, { useState, useEffect } from 'react';
import { Settings, X, Save, HardDrive, AlertTriangle, CheckCircle, Download, Loader2, Cloud, Globe, Cpu, Trash2 } from 'lucide-react';
import { AIConfig, ModelDownloadState, CloudProvider } from '../types';
import { AVAILABLE_MODELS, LOCAL_MODELS, checkWebGPUSupport, createAIProvider, checkModelDownloaded, deleteDownloadedModel } from '../services/aiProvider';

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
            const updatedConfig = {
                ...localConfig,
                modelDownloadState: {
                    ...(localConfig.modelDownloadState || {}),
                    [modelId]: { status: 'error' as const, progress: 0, message: err.message },
                },
            };
            setLocalConfig(updatedConfig);
            setDownloadProgress({ status: 'error', progress: 0, message: err.message });
        } finally {
            setDownloadingModel(null);
        }
    };

    const getModelState = (modelId: string): ModelDownloadState | undefined => {
        return localConfig.modelDownloadState?.[modelId];
    };

    const currentModelState = getModelState(localConfig.model);

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

                <div className="px-6 py-5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center rounded-sm">
                            <Settings size={16} className="text-[var(--ink)]" />
                        </div>
                        <div>
                            <h2 id="settings-sheet-title" className="heading-md text-[var(--ink)]">Configuración de modelos</h2>
                            <p className="text-[11px] font-sans text-[var(--ink2)] mt-1">Proveedor de IA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--ink2)] hover:text-[var(--ink)] transition-colors p-2">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">

                    {/* Provider Type Tabs */}
                    <div className="flex gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                        {PROVIDER_TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setProviderType(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-sans font-medium transition-all rounded-sm ${
                                        localConfig.providerType === tab.id
                                            ? 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--border-strong)]'
                                            : 'text-[var(--ink2)] hover:text-[var(--ink)]'
                                    }`}
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
                            <div className="space-y-3">
                                <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Proveedor Cloud</label>
                                <div className="relative">
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
                                        className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] appearance-none cursor-pointer font-sans text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm"
                                    >
                                        {CLOUD_PROVIDERS.map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {localConfig.cloudProvider !== 'openrouter' && (
                                <div className="space-y-3">
                                    <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">API Key</label>
                                    <input
                                        type="password"
                                        value={localConfig.apiKey || ''}
                                        onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                                        placeholder="sk-..."
                                        className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] font-sans text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm"
                                    />
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Modelo</label>
                                <div className="relative">
                                    <select
                                        value={localConfig.model}
                                        onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                        className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] appearance-none cursor-pointer font-sans text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm"
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
                            <div className="space-y-3">
                                <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Infraestructura</label>
                                {webGpuSupported === false && (
                                    <div className="flex items-start gap-2 p-3 bg-[var(--surface)] border-2 border-[var(--ink-soft)] text-[var(--ink)] text-[12px] font-sans rounded-sm">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <p>WebGPU no soportado. Usa Chrome/Edge 113+.</p>
                                    </div>
                                )}
                                {webGpuSupported === true && (
                                    <div className="flex items-start gap-2 p-3 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink2)] text-[12px] font-sans leading-relaxed rounded-sm">
                                        <CheckCircle size={14} className="shrink-0 mt-0.5" />
                                        <p>WebGPU disponible. El modelo se ejecuta en tu dispositivo sin enviar datos a servidores.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Modelo Local ({LOCAL_MODELS.length} disponibles)</label>
                                <div className="relative">
                                    <select
                                        value={localConfig.model}
                                        onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                        className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] appearance-none cursor-pointer font-sans text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm"
                                    >
                                        {LOCAL_MODELS.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} (~{m.sizeGB}GB){m.recommended ? ' ★' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                        <HardDrive size={14} className="text-[var(--ink)]" />
                                    </div>
                                </div>

                                {webGpuSupported && (
                                    <div className="space-y-2">
                                        {currentModelState?.status === 'ready' ? (
                                            <div className="flex items-center gap-2 p-3 bg-[var(--surface)] border border-[var(--border-strong)] text-[12px] font-sans rounded-sm">
                                                <CheckCircle size={14} className="text-[var(--ink)] shrink-0" />
                                                <span className="text-[var(--ink)]">Modelo descargado y listo para usar.</span>
                                                <button
                                                    onClick={async () => {
                                                        await deleteDownloadedModel(localConfig.model);
                                                        const updatedStates = { ...(localConfig.modelDownloadState || {}) };
                                                        delete updatedStates[localConfig.model];
                                                        setLocalConfig({ ...localConfig, modelDownloadState: updatedStates });
                                                    }}
                                                    className="ml-auto flex items-center gap-1 text-[11px] text-[var(--error)] hover:underline"
                                                >
                                                    <Trash2 size={12} /> Eliminar
                                                </button>
                                            </div>
                                        ) : downloadingModel === localConfig.model ? (
                                            <div className="space-y-2 p-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-sm">
                                                <div className="flex items-center gap-2 text-[12px] font-sans">
                                                    <Loader2 size={14} className="animate-spin text-[var(--ink)] shrink-0" />
                                                    <span className="text-[var(--ink)]">{downloadProgress.message}</span>
                                                    <span className="text-[var(--ink2)] ml-auto">{downloadProgress.progress}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-[var(--border-strong)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[var(--ink)] transition-all duration-300"
                                                        style={{ width: `${downloadProgress.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleDownloadModel(localConfig.model)}
                                                disabled={downloadProgress.status === 'downloading'}
                                                className="w-full flex items-center justify-center gap-2 p-3 text-[12px] font-sans font-medium transition-all rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-raised)]"
                                            >
                                                <Download size={14} />
                                                {currentModelState?.status === 'error' ? 'Reintentar descarga' : 'Descargar modelo para uso offline'}
                                            </button>
                                        )}
                                        {currentModelState?.status === 'error' && (
                                            <p className="text-[11px] font-sans text-red-400">{currentModelState.message}</p>
                                        )}
                                        <p className="text-[10px] font-sans text-[var(--ink2)] leading-relaxed">
                                            El modelo se almacena en caché del navegador. Los modelos ★ son recomendados para análisis de datos.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Chrome AI Provider */}
                    {localConfig.providerType === 'chrome' && (
                        <div className="space-y-3">
                            <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Chrome AI</label>
                            {chromeAiSupported === false && (
                                <div className="flex items-start gap-2 p-3 bg-[var(--surface)] border-2 border-[var(--ink-soft)] text-[var(--ink)] text-[12px] font-sans rounded-sm">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <p>Chrome AI no disponible. Habilita chrome://flags/#prompt-api-for-gemini-nano.</p>
                                </div>
                            )}
                            {chromeAiSupported === true && (
                                <div className="flex items-start gap-2 p-3 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink2)] text-[12px] font-sans leading-relaxed rounded-sm">
                                    <CheckCircle size={14} className="shrink-0 mt-0.5" />
                                    <p>Chrome AI (Gemini Nano) está disponible.</p>
                                </div>
                            )}
                            {chromeAiSupported === null && (
                                <div className="flex items-start gap-2 p-3 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink2)] text-[12px] font-sans leading-relaxed rounded-sm">
                                    <Loader2 size={14} className="animate-spin shrink-0" />
                                    <p>Verificando disponibilidad...</p>
                                </div>
                            )}
                            <p className="text-[10px] font-sans text-[var(--ink2)] leading-relaxed">
                                Gemini Nano está integrado en Chrome. No requiere descarga de modelos ni API keys.
                            </p>
                        </div>
                    )}

                    {/* Temperatura */}
                    <div className="space-y-3">
                        <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Temperatura <span className="text-[var(--ink)]">{(localConfig.temperature ?? 0.1).toFixed(1)}</span></label>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-sans text-[var(--ink-muted)]">0.0</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={localConfig.temperature ?? 0.1}
                                onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 appearance-none bg-[var(--border-strong)] rounded-full outline-none cursor-pointer
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--ink)] [&::-webkit-slider-thumb]:cursor-pointer
                                    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--ink)] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
                            />
                            <span className="text-[10px] font-sans text-[var(--ink-muted)]">1.0</span>
                        </div>
                    </div>

                    {/* Auto-Análisis */}
                    <div className="flex items-center justify-between p-4 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors rounded-sm">
                        <div>
                            <p className="text-[13px] font-sans font-medium text-[var(--ink)] tracking-tight">Auto-Análisis</p>
                            <p className="text-[11px] text-[var(--ink2)] font-sans mt-0.5">Ejecutar motor al cargar dataset</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localConfig.autoAnalyze}
                                onChange={(e) => setLocalConfig({ ...localConfig, autoAnalyze: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-[var(--border-strong)] rounded-full peer peer-checked:bg-[var(--ink)] transition-colors after:content-[\'\'] after:absolute after:top-1 after:left-1 after:bg-[var(--bg)] after:h-3 after:w-3 after:rounded-full after:transition-all peer-checked:after:translate-x-5"></div>
                        </label>
                    </div>

                </div>

                <div className="px-6 py-5 bg-[var(--surface)] border-t border-[var(--border)] flex justify-end gap-3">
                    <button onClick={onClose} className="cs-button">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="cs-button cs-button-primary flex items-center gap-2"
                    >
                        <Save size={14} /> Guardar
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default SettingsPanel;
