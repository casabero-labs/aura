import React from 'react';
import { RefreshCw } from 'lucide-react';
import { AIConfig, ProviderProgressEvent, SettingsSectionId } from '../../types';
import type { ChromeAiDiagnostic } from '../../services/aiProvider';
import type { OllamaModel } from '../../services/providers/ollamaProvider';
import { ollamaModelDisplayName, ollamaModelId } from '../../services/ollamaModelCatalog';

/**
 * Proveedores que esta versión ofrece. Cloud es implementación futura
 * (ver services/providerAvailability.ts): no aparece como opción.
 */
const PROVIDER_OPTIONS = [
  { id: 'chrome' as const, label: 'Chrome AI', desc: 'Gemini Nano dentro de este navegador. Sin servidor adicional.' },
  { id: 'ollama' as const, label: 'Ollama local', desc: 'Modelos instalados en este equipo, servidos por Ollama en localhost.' },
];

export type ProviderChoice = (typeof PROVIDER_OPTIONS)[number]['id'];

export const isProviderChoice = (providerType: AIConfig['providerType']): providerType is ProviderChoice => (
  providerType === 'chrome' || providerType === 'ollama'
);

export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';

const chromeStatusLabel = (diagnostic: ChromeAiDiagnostic | null) => {
  switch (diagnostic?.status) {
    case 'available': return 'Listo';
    case 'downloadable': return 'Requiere descargar Gemini Nano';
    case 'downloading': return 'Descargando Gemini Nano';
    case 'unavailable': return 'No disponible en este navegador';
    case 'session_start_failed': return 'Detectado, pero la sesión no inicia';
    case 'error': return 'Error al verificar';
    default: return 'Verificando…';
  }
};

const ollamaStatusLabel = (connected: boolean | null, modelCount: number) => {
  if (connected === true) return `Conectado · ${modelCount} ${modelCount === 1 ? 'modelo' : 'modelos'}`;
  if (connected === false) return 'Sin conexión';
  return 'Verificando…';
};

// Pasos que ya resuelve un botón de esta vista; no se repiten como texto.
const isRedundantChromeAction = (action: string) => /Preparar Gemini Nano|Puedes generar/i.test(action);

interface ProvidersSectionProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
  setProviderType: (type: ProviderChoice) => void;
  onSectionChange?: (section: SettingsSectionId) => void;
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
  onUseOllamaModel: (modelName: string) => void;
}

const ProvidersSection: React.FC<ProvidersSectionProps> = ({
  config, onChange, setProviderType, onSectionChange,
  chromeDiagnostic, chromeProgress, isPreparingChrome, onCheckChrome, onPrepareChrome,
  ollamaConnected, ollamaModels, ollamaLoading, onTestOllama, onOpenOllamaWizard, onUseOllamaModel,
}) => {
  const activeProviderType: ProviderChoice = isProviderChoice(config.providerType) ? config.providerType : 'chrome';
  const ollamaBaseUrl = config.ollamaBaseUrl || DEFAULT_OLLAMA_ENDPOINT;
  const chromeStatus = chromeDiagnostic?.status;
  const canPrepareChrome = chromeStatus === 'downloadable' || chromeStatus === 'downloading';
  const chromeSteps = (chromeDiagnostic?.actions ?? []).filter(action => !isRedundantChromeAction(action));
  const showChromeProgress = isPreparingChrome || chromeStatus === 'downloading' || !!chromeProgress;
  const chromeProgressValue = chromeProgress?.progress;
  const configuredModelInstalled = ollamaModels.some(m => ollamaModelId(m) === config.model);

  const statusFor = (id: ProviderChoice) => (
    id === 'chrome' ? chromeStatusLabel(chromeDiagnostic) : ollamaStatusLabel(ollamaConnected, ollamaModels.length)
  );

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / IA y proveedores</p>
        <h1 className="settings-section-h1">IA y proveedores</h1>
        <p className="settings-section-lead">Elige dónde se ejecuta el diagnóstico asistido. Los dos proveedores son locales: el CSV no sale de este equipo.</p>
      </header>

      <section className="settings-workspace-section">
        <fieldset className="settings-choice-list" data-testid="provider-choice-list">
          <legend className="settings-section-title">Proveedor de diagnóstico</legend>
          {PROVIDER_OPTIONS.map(option => {
            const isActive = activeProviderType === option.id;
            return (
              <label key={option.id} className={`settings-choice ${isActive ? 'settings-choice--active' : ''}`}>
                <input
                  type="radio"
                  name="aura-provider"
                  value={option.id}
                  checked={isActive}
                  onChange={() => setProviderType(option.id)}
                  data-testid={`provider-mode-${option.id}`}
                />
                <span className="settings-choice-body">
                  <span className="settings-choice-label">{option.label}</span>
                  <span className="settings-choice-desc">{option.desc}</span>
                  <span className="settings-choice-status" data-testid={`provider-status-${option.id}`}>{statusFor(option.id)}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="settings-choice-note" data-testid="provider-cloud-future">
          Proveedores cloud: implementación futura. Esta versión no envía evidencia a servicios externos.
        </p>
      </section>

      {activeProviderType === 'chrome' && (
        <section className="settings-workspace-section settings-resolution" data-testid="provider-resolution-chrome" aria-labelledby="provider-resolution-chrome-title">
          <h2 id="provider-resolution-chrome-title" className="settings-section-title">Estado de Chrome AI</h2>
          <p className="settings-resolution-status" role="status">
            <strong>{chromeStatusLabel(chromeDiagnostic)}.</strong>{' '}
            {chromeDiagnostic?.message || 'Comprobando si este navegador expone Gemini Nano.'}
          </p>

          {showChromeProgress && (
            <div className="settings-resolution-progress" data-testid="chrome-ai-download-progress">
              <p className="settings-resolution-progress-label" id="chrome-progress-label">
                {chromeProgress?.message || 'Gemini Nano se está descargando. Mantén Chrome abierto.'}
                {chromeProgressValue !== undefined && ` ${chromeProgressValue} %`}
              </p>
              <div
                className="settings-progress-track"
                role="progressbar"
                aria-labelledby="chrome-progress-label"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={chromeProgressValue}
                aria-valuetext={chromeProgressValue === undefined ? 'en curso' : undefined}
              >
                <div className="settings-progress-fill" style={{ transform: `scaleX(${(chromeProgressValue ?? 35) / 100})` }} />
              </div>
            </div>
          )}

          {chromeStatus !== 'available' && chromeSteps.length > 0 && (
            <ol className="settings-resolution-steps" data-testid="chrome-ai-steps">
              {chromeSteps.map(step => <li key={step}>{step}</li>)}
            </ol>
          )}

          <div className="settings-resolution-actions">
            {canPrepareChrome && (
              <button className="btn-p" onClick={onPrepareChrome} disabled={isPreparingChrome} data-testid="chrome-ai-prepare">
                {isPreparingChrome ? 'Preparando Gemini Nano…' : 'Preparar Gemini Nano'}
              </button>
            )}
            <button className="btn-s" onClick={onCheckChrome} disabled={isPreparingChrome}>
              <RefreshCw size={12} aria-hidden="true" /> Verificar estado
            </button>
            {chromeStatus !== 'available' && (
              <button className="btn-s" onClick={() => setProviderType('ollama')}>Usar Ollama local</button>
            )}
          </div>

          {chromeStatus !== 'available' && onSectionChange && (
            <p className="settings-resolution-more">
              <button type="button" className="settings-link" onClick={() => onSectionChange('diagnostico')}>
                Guía completa de activación en Diagnóstico avanzado
              </button>
            </p>
          )}
        </section>
      )}

      {activeProviderType === 'ollama' && (
        <section className="settings-workspace-section settings-resolution" data-testid="provider-resolution-ollama" aria-labelledby="provider-resolution-ollama-title">
          <h2 id="provider-resolution-ollama-title" className="settings-section-title">Conexión con Ollama</h2>

          <div className="settings-field">
            <label className="settings-label" htmlFor="aura-ollama-endpoint">Endpoint de Ollama</label>
            <div className="settings-field-row">
              <input
                id="aura-ollama-endpoint"
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => onChange({ ...config, ollamaBaseUrl: e.target.value })}
                placeholder={DEFAULT_OLLAMA_ENDPOINT}
                className="settings-input"
                data-testid="ollama-endpoint-input"
                autoComplete="off"
              />
              <button className="btn-s" onClick={onTestOllama} disabled={ollamaLoading} data-testid="ollama-test-connection">
                <RefreshCw size={12} aria-hidden="true" className={ollamaLoading ? 'animate-spin' : ''} /> Probar y refrescar
              </button>
            </div>
          </div>

          <p className="settings-resolution-status" role="status">
            {ollamaConnected === null && 'Comprobando la conexión con Ollama…'}
            {ollamaConnected === true && <><strong>Conectado local.</strong> {ollamaModels.length} {ollamaModels.length === 1 ? 'modelo instalado' : 'modelos instalados'} en {ollamaBaseUrl}.</>}
            {ollamaConnected === false && <><strong>Sin conexión.</strong> AURA no obtiene respuesta de {ollamaBaseUrl}. Abre la aplicación Ollama o usa el asistente para permitir el origen de AURA.</>}
          </p>

          {ollamaConnected === false && (
            <div className="settings-resolution-actions">
              <button className="btn-p" onClick={onOpenOllamaWizard} data-testid="ollama-open-setup">Conectar Ollama de este equipo</button>
              <button className="btn-s" onClick={onTestOllama} disabled={ollamaLoading} data-testid="ollama-retry-connection">Volver a intentar</button>
            </div>
          )}

          {ollamaConnected === true && ollamaModels.length === 0 && (
            <div className="settings-resolution-actions">
              <p className="settings-resolution-status">Ollama responde, pero no tiene modelos instalados.</p>
              <button className="btn-p" onClick={onOpenOllamaWizard} data-testid="ollama-open-setup">Instalar un modelo</button>
            </div>
          )}

          {ollamaConnected === true && ollamaModels.length > 0 && (
            <div className="settings-field">
              <label className="settings-label" htmlFor="aura-ollama-model">Modelo</label>
              <select
                id="aura-ollama-model"
                value={configuredModelInstalled ? config.model : ''}
                onChange={(e) => onUseOllamaModel(e.target.value)}
                className="settings-select"
                data-testid="ollama-model-select"
              >
                {!configuredModelInstalled && <option value="" disabled>Elige un modelo instalado</option>}
                {ollamaModels.map(m => (
                  <option key={ollamaModelId(m)} value={ollamaModelId(m)}>
                    {ollamaModelDisplayName(m)} · {(m.size / 1e9).toFixed(1)} GB
                  </option>
                ))}
              </select>
              {!configuredModelInstalled && (
                <p className="settings-field-error" data-testid="ollama-model-missing-warning">
                  El modelo guardado ({config.model || 'sin modelo'}) ya no está instalado en Ollama. Elige uno de la lista.
                </p>
              )}
              <p className="settings-field-hint">
                <button type="button" className="settings-link" onClick={onOpenOllamaWizard}>Administrar conexión y modelos</button>
              </p>
            </div>
          )}
        </section>
      )}

      {activeProviderType === 'ollama' && (
        <section className="settings-workspace-section">
          <h2 className="settings-section-title">Temperatura del modelo</h2>
          <div className="settings-field">
            <label className="settings-label" htmlFor="aura-temperature">Temperatura: {(config.temperature ?? 0.1).toFixed(1)}</label>
            <div className="settings-slider-row">
              <span className="settings-slider-label">0.0 · Estable</span>
              <input
                id="aura-temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature ?? 0.1}
                onChange={(e) => onChange({ ...config, temperature: parseFloat(e.target.value) })}
                className="settings-slider"
                aria-describedby="aura-temperature-hint"
              />
              <span className="settings-slider-label">1.0 · Variable</span>
            </div>
            <p className="settings-field-hint" id="aura-temperature-hint">Para auditoría se recomienda 0.1: valores altos aumentan la variación entre corridas.</p>
          </div>
        </section>
      )}
    </>
  );
};

export default ProvidersSection;
