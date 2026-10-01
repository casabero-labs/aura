import React from 'react';
import { AlertTriangle, CheckCircle, Download, HelpCircle, Info, Loader2, Server } from 'lucide-react';
import { AIConfig, ProviderProgressEvent } from '../../types';
import type { ChromeAiDiagnostic } from '../../services/aiProvider';
import { DEFAULT_OLLAMA_MODEL_ID } from '../../services/modelRegistry';
import { OLLAMA_SUGGESTED_MODELS } from '../../services/providers/ollamaProvider';
import type { OllamaModel } from '../../services/providers/ollamaProvider';
import { DEFAULT_OLLAMA_ENDPOINT, type ProviderChoice } from './ProvidersSection';

const chromeStatusTone = (status?: ChromeAiDiagnostic['status']) => (status === 'available' ? 'ok' : 'warn');

interface AdvancedDiagnosticsSectionProps {
  config: AIConfig;
  setProviderType: (type: ProviderChoice) => void;
  chromeDiagnostic: ChromeAiDiagnostic | null;
  chromeProgress: ProviderProgressEvent | null;
  isPreparingChrome: boolean;
  onCheckChrome: () => void;
  onPrepareChrome: () => void;
  ollamaConnected: boolean | null;
  ollamaModels: OllamaModel[];
  ollamaLoading: boolean;
  onTestOllama: () => void;
  onOpenOllamaWizard: () => void;
  ollamaPullModel: string;
  onOllamaPullModelChange: (value: string) => void;
  ollamaPullProgress: ProviderProgressEvent | null;
  onOllamaPull: () => void;
}

const AdvancedDiagnosticsSection: React.FC<AdvancedDiagnosticsSectionProps> = ({
  config, setProviderType,
  chromeDiagnostic, chromeProgress, isPreparingChrome, onCheckChrome, onPrepareChrome,
  ollamaConnected, ollamaModels, ollamaLoading, onTestOllama, onOpenOllamaWizard,
  ollamaPullModel, onOllamaPullModelChange, ollamaPullProgress, onOllamaPull,
}) => {
  const shouldShowChromeProgress = chromeDiagnostic?.status === 'downloading' || isPreparingChrome || !!chromeProgress;

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / Diagnóstico avanzado</p>
        <h1 className="settings-section-h1">Diagnóstico avanzado</h1>
        <p className="settings-section-lead">Comprueba el estado del entorno y resuelve problemas de configuración.</p>
      </header>

      <section className="settings-workspace-section">
        <details className="settings-collapsible-section" open>
          <summary className="settings-collapsible-summary">
            <Server size={14} />
            <span>Estado del sistema</span>
            <span className="settings-collapsible-hint">Chrome AI y Ollama</span>
          </summary>
          <div className="settings-collapsible-body">
            <div className="settings-field">
              <label className="settings-label">Chrome AI</label>
              {!chromeDiagnostic ? (
                <div className="settings-info-box"><Loader2 size={14} className="animate-spin" /><p>Verificando disponibilidad de Chrome AI...</p></div>
              ) : (
                <div className={`settings-status-card settings-status-card--${chromeStatusTone(chromeDiagnostic.status)}`}>
                  {chromeDiagnostic.status === 'available' ? <CheckCircle size={14} className="settings-status-icon" />
                    : chromeDiagnostic.status === 'downloadable' ? <Download size={14} className="settings-status-icon" />
                    : chromeDiagnostic.status === 'downloading' ? <Loader2 size={14} className="settings-status-icon animate-spin" />
                    : <AlertTriangle size={14} className="settings-status-icon" />}
                  <div>
                    <p>{chromeDiagnostic.message}</p>
                    <p className="settings-status-meta">API: {chromeDiagnostic.apiSurface === 'none' ? 'No detectada' : chromeDiagnostic.apiSurface}</p>
                  </div>
                </div>
              )}
              {shouldShowChromeProgress && (
                <div className="settings-download-card" data-testid="chrome-ai-download-progress">
                  <div className="settings-download-row">
                    {chromeProgress?.stage === 'error' ? <AlertTriangle size={14} /> : <Loader2 size={14} className="settings-download-spinner" />}
                    <span className="settings-download-message">{chromeProgress?.message || 'Gemini Nano se está preparando...'}</span>
                    {chromeProgress?.progress !== undefined && <span className="settings-download-pct">{chromeProgress.progress}%</span>}
                  </div>
                  <div className="settings-progress-track" aria-label="Progreso de descarga de Gemini Nano">
                    <div className="settings-progress-fill" style={{ width: `${chromeProgress?.progress ?? 35}%`, opacity: chromeProgress?.progress === undefined ? 0.55 : 1 }} />
                  </div>
                </div>
              )}
              {chromeDiagnostic && chromeDiagnostic.status !== 'available' && (
                <div className="settings-field-row">
                  <button className="btn-s btn-sm" onClick={onCheckChrome} disabled={isPreparingChrome}>Verificar estado</button>
                  {(chromeDiagnostic.status === 'downloadable' || chromeDiagnostic.status === 'downloading') && (
                    <button className="btn-p btn-sm" onClick={onPrepareChrome} disabled={isPreparingChrome}>
                      {isPreparingChrome ? 'Preparando...' : 'Preparar Gemini Nano'}
                    </button>
                  )}
                  <button className="btn-s btn-sm" onClick={() => setProviderType('ollama')}>Usar Ollama local</button>
                </div>
              )}
            </div>

            <div className="settings-field">
              <label className="settings-label">Ollama</label>
              {ollamaConnected === null && (
                <div className="settings-info-box"><Loader2 size={14} className="animate-spin" /><p>Verificando conexión con Ollama...</p></div>
              )}
              {ollamaConnected === false && (
                <div className="settings-status-card settings-status-card--warn">
                  <AlertTriangle size={14} className="settings-status-icon" />
                  <div>
                    <p><strong>Ollama todavía no está conectado</strong></p>
                    <p className="settings-status-meta">AURA necesita conectarse con Ollama en este equipo.</p>
                    <div className="settings-field-row">
                      <button className="btn-p btn-sm" onClick={onOpenOllamaWizard} data-testid="ollama-open-setup">Conectar Ollama de este equipo</button>
                      <button className="btn-s btn-sm" onClick={onTestOllama} data-testid="ollama-retry-connection">Volver a intentar</button>
                    </div>
                  </div>
                </div>
              )}
              {ollamaConnected === true && (
                <>
                  <div className="settings-status-card settings-status-card--ok">
                    <CheckCircle size={14} className="settings-status-icon" />
                    <p>Ollama conectado en {config.ollamaBaseUrl || DEFAULT_OLLAMA_ENDPOINT}. {ollamaModels.length} modelos encontrados.</p>
                  </div>
                  <button className="btn-s btn-sm" onClick={onOpenOllamaWizard} data-testid="ollama-open-setup">Administrar conexión y modelos</button>
                </>
              )}
            </div>
          </div>
        </details>
      </section>

      <section className="settings-workspace-section">
        <details className="settings-collapsible-section">
          <summary className="settings-collapsible-summary">
            <Download size={14} />
            <span>Compatibilidad e instalación</span>
            <span className="settings-collapsible-hint">Activar Chrome AI y descargar modelos Ollama</span>
          </summary>
          <div className="settings-collapsible-body">
            <p className="settings-label">Cómo activar y destrabar Chrome AI</p>
            <ol className="settings-instructions-list">
              <li>Actualiza Chrome a la versión más reciente (138+).</li>
              <li>Abre <code>chrome://flags</code> en una pestaña nueva.</li>
              <li>Busca <strong>Prompt API</strong>, <strong>Gemini Nano</strong>, <strong>Built-in AI</strong> y <strong>Optimization Guide On Device Model</strong>.</li>
              <li>Activa las opciones disponibles y reinicia Chrome completo.</li>
              <li>Deja al menos ~22 GB libres en el disco donde vive el perfil de Chrome.</li>
              <li>Vuelve a AURA y pulsa Verificar estado.</li>
            </ol>
            <p className="settings-status-meta">
              Revisa <code>chrome://on-device-internals</code> para ver modelos on-device, errores y estado de descarga.
              Requisitos frecuentes: Chrome escritorio, macOS 13+, GPU {'>'}4GB VRAM o CPU 16GB RAM con 4 cores.
            </p>

            <p className="settings-label" style={{ marginTop: 'var(--space-md)' }}>Descargar un modelo de Ollama</p>
            <div className="settings-field-row">
              <input
                type="text"
                value={ollamaPullModel}
                onChange={(e) => onOllamaPullModelChange(e.target.value)}
                placeholder={DEFAULT_OLLAMA_MODEL_ID}
                className="settings-input"
              />
              <button className="btn-p btn-sm" onClick={onOllamaPull} disabled={ollamaPullProgress?.stage === 'downloading'}>
                <Download size={10} /> Descargar
              </button>
            </div>
            {ollamaPullProgress && (
              <div className="settings-download-card">
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
            <p className="settings-status-meta">Sugeridos: {OLLAMA_SUGGESTED_MODELS.join(', ')}</p>
          </div>
        </details>
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
              <li><strong>Diagnóstico vacío:</strong> puedes continuar con el script determinista. El motor de reglas no depende del LLM.</li>
            </ul>
          </div>
        </details>
      </section>

      <section className="settings-workspace-section">
        <div className="settings-info-box">
          <Info size={14} />
          <p>Gemini Nano está integrado en Chrome, sin API key. Ollama ejecuta modelos locales en tu máquina. Los proveedores cloud son una implementación futura.</p>
        </div>
      </section>
    </>
  );
};

export default AdvancedDiagnosticsSection;
