import React, { useState, useEffect } from 'react';
import { Settings, X, HelpCircle, Save, ExternalLink, Cpu, Shield, Server, HardDrive, AlertTriangle, CheckCircle, Download, Loader2 } from 'lucide-react';
import { AIConfig, ModelDownloadState } from '../types';
import { AVAILABLE_MODELS, checkWebGPUSupport, createAIProvider } from '../services/aiProvider';

interface SettingsPanelProps {
    config: AIConfig;
    onSave: (config: AIConfig) => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onClose }) => {
    const [localConfig, setLocalConfig] = useState<AIConfig>(config);
    const [showHelp, setShowHelp] = useState(false);
    const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null);
    const [chromeAvailable, setChromeAvailable] = useState<boolean | null>(null);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<ModelDownloadState>({
        status: 'idle',
        progress: 0,
        message: '',
    });

    useEffect(() => {
        checkWebGPUSupport().then(setWebGpuSupported);
        // Check Chrome AI availability
        if (typeof window !== 'undefined' && (window as any).ai) {
            (window as any).ai.assistant()
                .then((ai: any) => ai.capabilities())
                .then((caps: any) => setChromeAvailable(caps.available))
                .catch(() => setChromeAvailable(false));
        } else {
            setChromeAvailable(false);
        }
    }, []);

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

            const updatedStates = { ...(localConfig.modelDownloadState || {}), [modelId]: { status: 'ready' as const, progress: 100, message: 'Listo' } };
            setLocalConfig({ ...localConfig, modelDownloadState: updatedStates });
        } catch (err: any) {
            setDownloadProgress({ status: 'error', progress: 0, message: err.message });
        } finally {
            setDownloadingModel(null);
        }
    };

    const getModelState = (modelId: string): ModelDownloadState | undefined => {
        return localConfig.modelDownloadState?.[modelId];
    };

    const currentModelState = getModelState(localConfig.model);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[var(--ink)]/60 animate-in fade-in duration-300">
            <div className="bg-[var(--bg)] w-full max-w-md border border-[var(--border)] rounded-lg overflow-hidden flex flex-col">

                <div className="px-6 py-5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center rounded-sm">
                            <Settings size={16} className="text-[var(--ink)]" />
                        </div>
                        <div>
                            <h2 className="heading-md text-[var(--ink)]">Ajustes</h2>
                            <p className="text-[11px] font-sans text-[var(--ink2)] mt-1">Proveedor LLM e infraestructura</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--ink2)] hover:text-[var(--ink)] transition-colors p-2">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">

                    {/* Infraestructura */}
                    <div className="space-y-3">
                        <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Infraestructura</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setLocalConfig({ ...localConfig, providerType: 'cloud', cloudProvider: localConfig.cloudProvider || 'google', model: AVAILABLE_MODELS.cloud.filter(m => m.cloudProvider === (localConfig.cloudProvider || 'google'))[0]?.id || AVAILABLE_MODELS.cloud[0].id })}
                                className={`flex items-center justify-center gap-2 p-3 text-[12px] font-sans font-medium transition-all rounded-sm border ${localConfig.providerType === 'cloud' ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink2)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
                            >
                                <Server size={14} /> Cloud
                            </button>
                            <button
                                onClick={() => setLocalConfig({ ...localConfig, providerType: 'local', model: AVAILABLE_MODELS.local[0].id })}
                                className={`flex items-center justify-center gap-2 p-3 text-[12px] font-sans font-medium transition-all rounded-sm border ${localConfig.providerType === 'local' ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink2)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
                            >
                                <HardDrive size={14} /> WebGPU
                            </button>
                            <button
                                onClick={() => setLocalConfig({ ...localConfig, providerType: 'chrome', model: 'gemini-nano' })}
                                className={`flex items-center justify-center gap-2 p-3 text-[12px] font-sans font-medium transition-all rounded-sm border ${localConfig.providerType === 'chrome' ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink2)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
                            >
                                <Cpu size={14} /> Chrome AI
                            </button>
                        </div>
                        {localConfig.providerType === 'local' && webGpuSupported === false && (
                            <div className="flex items-start gap-2 p-3 mt-2 bg-[var(--surface)] border-2 border-[var(--ink-soft)] text-[var(--ink)] text-[12px] font-sans rounded-sm">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <p>WebGPU no soportado. Usa Chrome/Edge 113+.</p>
                            </div>
                        )}
                        {localConfig.providerType === 'local' && webGpuSupported === true && (
                            <div className="flex items-start gap-2 p-3 mt-2 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink2)] text-[12px] font-sans leading-relaxed rounded-sm">
                                <CheckCircle size={14} className="shrink-0 mt-0.5" />
                                <p>WebGPU disponible. El modelo se ejecuta en tu dispositivo sin enviar datos a servidores.</p>
                            </div>
                        )}
                        {localConfig.providerType === 'chrome' && chromeAvailable === false && (
                            <div className="flex items-start gap-2 p-3 mt-2 bg-[var(--surface)] border-2 border-[var(--ink-soft)] text-[var(--ink)] text-[12px] font-sans rounded-sm">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <p>Chrome AI no disponible. Habilitá en <code className="text-[var(--ink)]">chrome://flags/#prompt-api-for-gemini-nano</code></p>
                            </div>
                        )}
                        {localConfig.providerType === 'chrome' && chromeAvailable === true && (
                            <div className="flex items-start gap-2 p-3 mt-2 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink2)] text-[12px] font-sans leading-relaxed rounded-sm">
                                <CheckCircle size={14} className="shrink-0 mt-0.5" />
                                <p>Gemini Nano listo. Modelo integrado en Chrome, sin API key ni descarga adicional.</p>
                            </div>
                        )}

                        {localConfig.providerType === 'cloud' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Proveedor</label>
                                <div className="grid grid-cols-5 gap-1">
                                    {['google', 'groq', 'deepseek', 'openrouter', 'minimax'].map(provider => (
                                        <button
                                            key={provider}
                                            onClick={() => {
                                                const providerModels = AVAILABLE_MODELS.cloud.filter(m => m.cloudProvider === provider);
                                                setLocalConfig({
                                                    ...localConfig,
                                                    cloudProvider: provider,
                                                    model: providerModels[0]?.id || localConfig.model
                                                });
                                            }}
                                            className={`p-2 text-[10px] font-sans font-medium transition-all rounded-sm border capitalize ${
                                                localConfig.cloudProvider === provider
                                                    ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)]'
                                                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink2)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'
                                            }`}
                                        >
                                            {provider}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* API Key */}
                    {localConfig.providerType === 'cloud' && localConfig.cloudProvider !== 'openrouter' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">
                                <label className="flex items-center gap-2"><Cpu size={12} className="text-[var(--ink)]" /> {localConfig.cloudProvider === 'google' ? 'Google' : localConfig.cloudProvider === 'groq' ? 'Groq' : localConfig.cloudProvider === 'deepseek' ? 'DeepSeek' : 'MiniMax'} API Key</label>
                                <button onClick={() => setShowHelp(!showHelp)} className="flex items-center gap-1 text-[var(--ink)] hover:underline">
                                    <HelpCircle size={12} /> Ayuda
                                </button>
                            </div>

                            {showHelp && (
                                <div className="p-4 bg-[var(--surface)] border border-[var(--border)] text-[12px] text-[var(--ink2)] leading-relaxed mb-4 animate-in slide-in-from-top-2 rounded-sm">
                                    <p className="mb-2 font-sans font-medium text-[var(--ink)] flex items-center gap-2">
                                        <Shield size={12} /> Cómo obtener la API key:
                                    </p>
                                    {localConfig.cloudProvider === 'google' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Ve a <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">Google AI Studio</a></li>
                                            <li>Autentícate y genera una API key gratuita</li>
                                        </ol>
                                    )}
                                    {localConfig.cloudProvider === 'groq' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Ve a <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">Groq Console</a></li>
                                            <li>Crea una cuenta y genera tu API key</li>
                                        </ol>
                                    )}
                                    {localConfig.cloudProvider === 'deepseek' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Ve a <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">DeepSeek Platform</a></li>
                                            <li>Crea una cuenta y genera tu API key</li>
                                        </ol>
                                    )}
                                    {localConfig.cloudProvider === 'minimax' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Ve a <a href="https://platform.minimax.io/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">MiniMax Platform</a></li>
                                            <li>Crea una cuenta y genera tu API key</li>
                                        </ol>
                                    )}
                                </div>
                            )}

                            <input
                                type="password"
                                placeholder="Introduzca llave..."
                                value={localConfig.apiKey}
                                onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                                className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] font-mono text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm placeholder:text-[var(--ink-muted)]"
                            />
                        </div>
                    )}

                    {/* Modelo */}
                    <div className="space-y-3">
                        <label className="block text-[11px] font-sans font-medium uppercase tracking-wider text-[var(--ink2)]">Modelo</label>
                        <div className="relative">
                            <select
                                value={localConfig.model}
                                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] appearance-none cursor-pointer font-sans text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm"
                            >
                                {(localConfig.providerType === 'cloud' 
                                    ? AVAILABLE_MODELS.cloud.filter(m => m.cloudProvider === localConfig.cloudProvider)
                                    : localConfig.providerType === 'chrome'
                                    ? AVAILABLE_MODELS.chrome
                                    : AVAILABLE_MODELS.local
                                ).map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} {m.sizeGB ? `(~${m.sizeGB}GB)` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                <Cpu size={14} className="text-[var(--ink)]" />
                            </div>
                        </div>

                        {/* Download button for local models */}
                        {localConfig.providerType === 'local' && webGpuSupported && (
                            <div className="space-y-2">
                                {currentModelState?.status === 'ready' ? (
                                    <div className="flex items-center gap-2 p-3 bg-[var(--surface)] border border-[var(--border-strong)] text-[12px] font-sans rounded-sm">
                                        <CheckCircle size={14} className="text-[var(--ink)] shrink-0" />
                                        <span className="text-[var(--ink)]">Modelo descargado y listo para usar.</span>
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
                                    Descargar el modelo permite analizar datos sin conexión. La descarga se almacena en caché del navegador.
                                </p>
                            </div>
                        )}
                    </div>

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
                            <div className="w-10 h-5 bg-[var(--border-strong)] rounded-full peer peer-checked:bg-[var(--ink)] transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:bg-[var(--bg)] after:h-3 after:w-3 after:rounded-full after:transition-all peer-checked:after:translate-x-5"></div>
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
            </div>
        </div>
    );
};

export default SettingsPanel;
