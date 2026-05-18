import React, { useState, useEffect } from 'react';
import { Settings, X, HelpCircle, Save, ExternalLink, Cpu, Shield, Zap, Server, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { AIConfig } from '../types';
import { AVAILABLE_MODELS, checkWebGPUSupport } from '../services/aiProvider';

interface SettingsPanelProps {
    config: AIConfig;
    onSave: (config: AIConfig) => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onClose }) => {
    const [localConfig, setLocalConfig] = useState<AIConfig>(config);
    const [showHelp, setShowHelp] = useState(false);
    const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null);

    useEffect(() => {
        checkWebGPUSupport().then(setWebGpuSupported);
    }, []);

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[var(--ink)]/60 animate-in fade-in duration-300">
            <div className="bg-[var(--bg)] w-full max-w-md border border-[var(--border)] rounded-lg overflow-hidden flex flex-col">

                <div className="px-6 py-5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center rounded-sm">
                            <Settings size={16} className="text-[var(--ink)]" />
                        </div>
                        <div>
                            <h2 className="heading-md text-[var(--ink)]">Ajustes del Sistema</h2>
                            <p className="text-[11px] font-sans text-[var(--ink2)] mt-1">Configuración del Motor Cognitivo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--ink2)] hover:text-[var(--ink)] transition-colors p-2">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto max-h-[75vh]">

                    {/* Selección de Capa 0: Infraestructura */}
                    <div className="space-y-3">
                        <label className="block eyebrow text-[var(--ink2)]">Capa 0: Infraestructura</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setLocalConfig({ ...localConfig, providerType: 'cloud', cloudProvider: localConfig.cloudProvider || 'google', model: AVAILABLE_MODELS.cloud.filter(m => m.cloudProvider === (localConfig.cloudProvider || 'google'))[0]?.id || AVAILABLE_MODELS.cloud[0].id })}
                                className={`flex items-center justify-center gap-2 p-3 text-[12px] font-sans font-medium transition-all rounded-sm border ${localConfig.providerType === 'cloud' ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink2)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
                            >
                                <Server size={14} /> Cloud API
                            </button>
                            <button
                                onClick={() => setLocalConfig({ ...localConfig, providerType: 'local', model: AVAILABLE_MODELS.local[0].id })}
                                className={`flex items-center justify-center gap-2 p-3 text-[12px] font-sans font-medium transition-all rounded-sm border ${localConfig.providerType === 'local' ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink2)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
                            >
                                <HardDrive size={14} /> WebGPU Local
                            </button>
                        </div>
                        {localConfig.providerType === 'local' && webGpuSupported === false && (
                            <div className="flex items-start gap-2 p-3 mt-2 bg-[var(--surface)] border-2 border-[var(--ink-soft)] text-[var(--ink)] text-[12px] font-sans rounded-sm">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <p>Tu navegador no soporta WebGPU. El motor local no funcionará. Usa Chrome/Edge 113+.</p>
                            </div>
                        )}
                        {localConfig.providerType === 'local' && webGpuSupported === true && (
                            <div className="flex items-start gap-2 p-3 mt-2 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink2)] text-[12px] font-sans leading-relaxed rounded-sm">
                                <CheckCircle size={14} className="shrink-0 mt-0.5" />
                                <p>WebGPU detectado. En modo local, el modelo y el smart sample se ejecutan en tu dispositivo sin llamar a una API cloud.</p>
                            </div>
                        )}

                        {localConfig.providerType === 'cloud' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <label className="block eyebrow text-[var(--ink2)]">Proveedor Cloud</label>
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

                    {/* API Key (Solo Cloud, excepto OpenRouter) */}
                    {localConfig.providerType === 'cloud' && localConfig.cloudProvider !== 'openrouter' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center eyebrow text-[var(--ink2)]">
                                <label className="flex items-center gap-2"><Cpu size={12} className="text-[var(--ink)]" /> {localConfig.cloudProvider === 'google' ? 'Google' : localConfig.cloudProvider === 'groq' ? 'Groq' : localConfig.cloudProvider === 'deepseek' ? 'DeepSeek' : 'MiniMax'} API Key</label>
                                <button
                                    onClick={() => setShowHelp(!showHelp)}
                                    className="flex items-center gap-1 text-[var(--ink)] hover:underline"
                                >
                                    <HelpCircle size={12} /> Ayuda
                                </button>
                            </div>

                            {showHelp && (
                                <div className="p-4 bg-[var(--surface)] border border-[var(--border)] text-[12px] text-[var(--ink2)] leading-relaxed mb-4 animate-in slide-in-from-top-2 rounded-sm">
                                    <p className="mb-2 font-sans font-medium text-[var(--ink)] flex items-center gap-2">
                                        <Shield size={12} /> Protocolo de Adquisición:
                                    </p>
                                    {localConfig.cloudProvider === 'google' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Acceda a <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">Google AI Studio</a></li>
                                            <li>Autentíquese con su cuenta de servicios</li>
                                            <li>Genere una nueva llave de API (gratuita)</li>
                                        </ol>
                                    )}
                                    {localConfig.cloudProvider === 'groq' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Acceda a <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">Groq Console</a></li>
                                            <li>Cree una cuenta o autentíquese</li>
                                            <li>Genere una nueva llave de API</li>
                                        </ol>
                                    )}
                                    {localConfig.cloudProvider === 'deepseek' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Acceda a <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">DeepSeek Platform</a></li>
                                            <li>Cree una cuenta o autentíquese</li>
                                            <li>Genere una nueva llave de API</li>
                                        </ol>
                                    )}
                                    {localConfig.cloudProvider === 'minimax' && (
                                        <ol className="list-decimal list-inside space-y-1 font-sans">
                                            <li>Acceda a <a href="https://platform.minimax.io/" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline font-medium">MiniMax Platform</a></li>
                                            <li>Cree una cuenta o autentíquese</li>
                                            <li>Genere una nueva llave de API</li>
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

                    {/* Selección de Modelo */}
                    <div className="space-y-3">
                        <label className="block eyebrow text-[var(--ink2)]">Modelo del Motor IA</label>
                        <div className="relative">
                            <select
                                value={localConfig.model}
                                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] px-4 py-3 outline-none text-[var(--ink)] appearance-none cursor-pointer font-sans text-[13px] focus:border-[var(--ink-soft)] transition-colors rounded-sm"
                            >
                                {(localConfig.providerType === 'cloud' 
                                    ? AVAILABLE_MODELS.cloud.filter(m => m.cloudProvider === localConfig.cloudProvider)
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
                    </div>

                    {/* Temperatura */}
                    <div className="space-y-3">
                        <label className="block eyebrow text-[var(--ink2)]">Temperatura del Modelo <span className="text-[var(--ink)]">{(localConfig.temperature ?? 0.1).toFixed(1)}</span></label>
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
                        <p className="text-[10px] font-sans text-[var(--ink2)] leading-relaxed">
                            M1: Control de varianza estocástica. Valores bajos (&lt;0.3) favorecen consistencia y adherencia a formato. Valores altos (&gt;0.5) aumentan creatividad pero pueden reducir precisión.
                        </p>
                    </div>

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
                        <Save size={14} /> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
