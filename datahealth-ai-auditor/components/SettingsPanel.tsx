import React, { useState } from 'react';
import { Settings, X, HelpCircle, Save, ExternalLink, Cpu, Shield, Zap } from 'lucide-react';
import { AIConfig } from '../types';

interface SettingsPanelProps {
    config: AIConfig;
    onSave: (config: AIConfig) => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onClose }) => {
    const [localConfig, setLocalConfig] = useState<AIConfig>(config);
    const [showHelp, setShowHelp] = useState(false);

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[var(--bg-color)] w-full max-w-md border border-[var(--border-color)] shadow-2xl rounded-none overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                <div className="px-6 py-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--technical-bg)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border border-[var(--main-color)] flex items-center justify-center">
                            <Settings size={16} className="text-[var(--main-color)] animate-spin-slow" />
                        </div>
                        <div>
                            <h2 className="font-display text-sm font-bold text-[var(--main-color)] uppercase tracking-tight">AJUSTES_SISTEMA</h2>
                            <p className="text-[8px] font-mono text-[var(--secondary-color)] uppercase tracking-widest font-bold">Configuración Kernel v1.0</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--secondary-color)] hover:text-[var(--main-color)] transition-colors p-2">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto max-h-[75vh]">

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--secondary-color)]">
                            <label className="flex items-center gap-2"><Cpu size={12} className="text-[var(--main-color)]" /> Gemini API Key</label>
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="flex items-center gap-1 text-[var(--main-color)] hover:underline"
                            >
                                <HelpCircle size={12} /> Ayuda
                            </button>
                        </div>

                        {showHelp && (
                            <div className="p-4 bg-[var(--technical-bg)] border border-[var(--border-color)] text-[11px] text-[var(--secondary-color)] leading-relaxed mb-4 animate-in slide-in-from-top-2 border-l-2 border-l-[var(--main-color)]">
                                <p className="mb-3 font-bold text-[var(--main-color)] uppercase tracking-tight flex items-center gap-2">
                                    <Shield size={12} /> Protocolo de Adquisición:
                                </p>
                                <ol className="list-decimal list-inside space-y-2 font-sans font-light">
                                    <li>Acceda a <a href="https://aistudio.google.com/" target="_blank" className="text-[var(--main-color)] underline font-medium">Google AI Studio</a></li>
                                    <li>Autentíquese con su cuenta de servicios</li>
                                    <li>Genere una nueva llave de API (gratuita para uso estándar)</li>
                                </ol>
                                <div className="mt-4 flex items-center gap-2 opacity-60 text-[9px] font-mono">
                                    <Zap size={10} className="text-[var(--main-color)]" />
                                    <span>La conexión es cifrada y local.</span>
                                </div>
                            </div>
                        )}

                        <input
                            type="password"
                            placeholder="Introduzca llave..."
                            value={localConfig.apiKey}
                            onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                            className="w-full bg-[var(--technical-bg)] border border-[var(--border-color)] px-4 py-3 outline-none text-[var(--main-color)] font-mono text-xs focus:border-[var(--main-color)] transition-colors placeholder:text-[var(--secondary-color)] placeholder:opacity-30"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--secondary-color)]">Modelo_Motor_IA</label>
                        <div className="relative">
                            <select
                                value={localConfig.model}
                                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                className="w-full bg-[var(--technical-bg)] border border-[var(--border-color)] px-4 py-3 outline-none text-[var(--main-color)] appearance-none cursor-pointer font-sans text-xs focus:border-[var(--main-color)] transition-colors"
                            >
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Máxima Velocidad)</option>
                                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Equilibrado)</option>
                                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Razonamiento Crítico)</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                <Cpu size={14} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[var(--technical-bg)] border border-[var(--border-color)] group hover:border-[var(--main-color)] transition-colors">
                        <div>
                            <p className="text-xs font-bold text-[var(--main-color)] uppercase tracking-tight">Auto_Análisis_Kernel</p>
                            <p className="text-[9px] text-[var(--secondary-color)] font-mono uppercase tracking-tighter opacity-70">Ejecutar motor al cargar dataset</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localConfig.autoAnalyze}
                                onChange={(e) => setLocalConfig({ ...localConfig, autoAnalyze: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-[var(--border-color)] rounded-none border border-[var(--border-color)] peer peer-checked:bg-[var(--main-color)] transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:bg-[var(--bg-color)] after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                        </label>
                    </div>

                </div>

                <div className="px-6 py-6 bg-[var(--technical-bg)] border-t border-[var(--border-color)] flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-3 bg-[var(--main-color)] text-white px-8 py-3 font-display font-bold text-xs hover:bg-[var(--accent-focus)] transition-all active:translate-y-0.5 uppercase tracking-widest shadow-lg"
                    >
                        <Save size={14} /> Guardar_Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
