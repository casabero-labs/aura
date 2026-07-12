import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Download,
  Globe,
  HardDrive,
  Lock,
  Server,
  Shield,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  diagnoseOllamaLocal,
  fetchOllamaModels,
  isModelHeavy,
  normalizeEndpoint,
  pullOllamaModel,
  type OllamaLocalDiagnostic,
  type OllamaLocalStatus,
  type OllamaModelInfo,
} from '../services/ollamaLocalBridge';
import {
  detectBrowser,
  detectOS,
  getOSLabel,
  type DesktopOS,
  type PlatformInfo,
} from '../services/platformDetection';
import { FINAL_EVALUATION_OLLAMA_MODELS } from '../services/modelRegistry';

interface OllamaSetupWizardProps {
  endpoint?: string;
  onReady?: (diagnostic: OllamaLocalDiagnostic) => void;
  onCancel?: () => void;
}

const ORIGIN = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://aura.casabero.com';

const CAMPAIGN_MODEL_PURPOSES: Record<string, string> = {
  Qwen3: 'Modelo general de 8B recomendado para diagnóstico local y comparación reproducible.',
  'Gemma 3': 'Modelo compacto de 4B recomendado para diagnóstico local y contraste de familia.',
  'DeepSeek R1': 'Modelo de razonamiento de 8B recomendado para diagnóstico local y comparación reproducible.',
};

interface ModelDownloadState {
  status: 'idle' | 'downloading' | 'success' | 'error';
  progress: number | null;
  message: string;
  completedBytes: number | null;
  totalBytes: number | null;
}

interface SetupLogEntry {
  at: string;
  kind: 'info' | 'progress' | 'success' | 'error';
  message: string;
}

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) return '—';
  return `${(bytes / (1024 ** 3)).toFixed(2)} GiB`;
};

const INSTRUCTIONS_WINDOWS = [
  '1. Cierra Ollama desde la bandeja del sistema.',
  '2. Abre Configuración → busca “Variables de entorno”.',
  '3. Abre “Editar las variables de entorno de tu cuenta”.',
  '4. En “Variables de usuario”, pulsa “Nueva”.',
  '5. Nombre: OLLAMA_ORIGINS',
  `6. Valor: ${ORIGIN}`,
  '7. Guarda con “Aceptar”.',
  '8. Abre Ollama nuevamente desde Inicio.',
];

const INSTRUCTIONS_MACOS = [
  '1. Cierra Ollama desde la barra de menús.',
  '2. Abre Terminal.',
  `3. Ejecuta: launchctl setenv OLLAMA_ORIGINS "${ORIGIN}"`,
  '4. Abre Ollama nuevamente desde Aplicaciones.',
  '',
  'O inicia el servidor manualmente:',
  `OLLAMA_ORIGINS="${ORIGIN}" ollama serve`,
];

const INSTRUCTIONS_LINUX = [
  '1. Abre Terminal.',
  '2. Ejecuta: sudo systemctl edit ollama.service',
  '3. Agrega:',
  '[Service]',
  `Environment="OLLAMA_ORIGINS=${ORIGIN}"`,
  '4. Ejecuta:',
  'sudo systemctl daemon-reload',
  'sudo systemctl restart ollama',
  '',
  'O inicia el servidor manualmente:',
  `OLLAMA_ORIGINS="${ORIGIN}" ollama serve`,
];

const PS_WINDOWS = `setx OLLAMA_ORIGINS "${ORIGIN}"`;

const STATUS_INFO: Record<OllamaLocalStatus, {
  icon: React.ReactNode;
  color: string;
  title: string;
}> = {
  not_configured: {
    icon: <Wrench size={16} />,
    color: 'var(--orange)',
    title: 'Falta configurar OLLAMA_ORIGINS',
  },
  permission_required: {
    icon: <Shield size={16} />,
    color: 'var(--blue)',
    title: 'Permiso de red local requerido',
  },
  permission_denied: {
    icon: <AlertCircle size={16} />,
    color: 'var(--error)',
    title: 'Permiso de red local denegado',
  },
  cors_blocked: {
    icon: <AlertCircle size={16} />,
    color: 'var(--error)',
    title: 'Ollama no autoriza a AURA',
  },
  server_unreachable: {
    icon: <Server size={16} />,
    color: 'var(--error)',
    title: 'Ollama no está iniciado',
  },
  timeout: {
    icon: <AlertCircle size={16} />,
    color: 'var(--orange)',
    title: 'Ollama no respondió a tiempo',
  },
  model_missing: {
    icon: <HardDrive size={16} />,
    color: 'var(--orange)',
    title: 'No hay modelos instalados',
  },
  insecure_context: {
    icon: <Lock size={16} />,
    color: 'var(--error)',
    title: 'Contexto no seguro',
  },
  unsupported_browser: {
    icon: <Globe size={16} />,
    color: 'var(--error)',
    title: 'Navegador no compatible',
  },
  ready: {
    icon: <CheckCircle size={16} />,
    color: 'var(--success)',
    title: 'Ollama listo',
  },
  unknown_error: {
    icon: <AlertCircle size={16} />,
    color: 'var(--error)',
    title: 'No se pudo diagnosticar la conexión',
  },
};

const matchesModel = (installedName: string, expectedId: string): boolean => {
  const installed = installedName.toLowerCase();
  const expected = expectedId.toLowerCase();
  return installed === expected || installed.startsWith(`${expected}@`);
};

const friendlyScanFallback = (endpoint: string): string => (
  `AURA no pudo consultar ${endpoint}/api/tags. `
  + 'Confirma que Ollama esté abierto, reinícialo después de configurar OLLAMA_ORIGINS '
  + 'y permite el acceso a la red local cuando Chrome o Edge lo soliciten.'
);

export const OllamaSetupWizard: React.FC<OllamaSetupWizardProps> = ({
  endpoint,
  onReady,
  onCancel,
}) => {
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<PlatformInfo>({
    os: 'unknown',
    browser: 'other',
    isSecureContext: false,
    detectedAt: new Date().toISOString(),
  });
  const [overrideOS, setOverrideOS] = useState<DesktopOS | null>(null);
  const [diagnostic, setDiagnostic] = useState<OllamaLocalDiagnostic | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [installedModels, setInstalledModels] = useState<OllamaModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanActions, setScanActions] = useState<string[]>([]);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadState>>({});
  const [setupLog, setSetupLog] = useState<SetupLogEntry[]>([{
    at: new Date().toISOString(), kind: 'info', message: 'Asistente iniciado. Esperando verificación de Ollama.',
  }]);

  const appendLog = useCallback((kind: SetupLogEntry['kind'], message: string) => {
    setSetupLog((current) => [...current.slice(-59), { at: new Date().toISOString(), kind, message }]);
  }, []);

  useEffect(() => {
    setPlatform({
      os: detectOS(),
      browser: detectBrowser(),
      isSecureContext: typeof window !== 'undefined' && window.isSecureContext === true,
      detectedAt: new Date().toISOString(),
    });
  }, []);

  const currentOS = overrideOS ?? platform.os;
  const osLabel = getOSLabel(currentOS);
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  const campaignModelStatus = useMemo(() => FINAL_EVALUATION_OLLAMA_MODELS.map(model => ({
    ...model,
    installed: installedModels.some(installed => matchesModel(installed.name, model.id)),
    purpose: CAMPAIGN_MODEL_PURPOSES[model.family] || 'Modelo congelado de la campaña OE4.',
  })), [installedModels]);

  const installedCampaignCount = campaignModelStatus.filter(model => model.installed).length;

  const getInstructions = useCallback(() => {
    switch (currentOS) {
      case 'windows': return INSTRUCTIONS_WINDOWS;
      case 'macos': return INSTRUCTIONS_MACOS;
      case 'linux': return INSTRUCTIONS_LINUX;
      default: return INSTRUCTIONS_MACOS;
    }
  }, [currentOS]);

  const copyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      window.setTimeout(() => setCopiedCommand(null), 1600);
    } catch {
      setCopiedCommand(null);
    }
  }, []);

  const handleScanModels = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    setScanActions([]);
    setDiagnostic(null);
    appendLog('info', `Consultando ${normalizedEndpoint}/api/tags`);

    try {
      const models = await fetchOllamaModels(normalizedEndpoint);
      setInstalledModels(models);
      appendLog('success', `Ollama conectado. ${models.length} modelo${models.length === 1 ? '' : 's'} detectado${models.length === 1 ? '' : 's'}.`);

      const preferred = FINAL_EVALUATION_OLLAMA_MODELS
        .map(formal => models.find(model => matchesModel(model.name, formal.id)))
        .find(Boolean);

      setSelectedModel(current => current ?? preferred?.name ?? models[0]?.name ?? null);

      if (models.length === 0) {
        setScanError('Ollama respondió correctamente, pero todavía no tiene modelos instalados.');
        setScanActions([
          'Instala al menos uno de los modelos recomendados mostrados abajo para usar el diagnóstico.',
          'Instala los tres antes de ejecutar la comparación experimental de AURA.',
        ]);
      }
    } catch (error: unknown) {
      let connectionDiagnostic: OllamaLocalDiagnostic | null = null;

      try {
        connectionDiagnostic = await diagnoseOllamaLocal(normalizedEndpoint);
        setDiagnostic(connectionDiagnostic);
      } catch {
        connectionDiagnostic = null;
      }

      if (connectionDiagnostic && connectionDiagnostic.status !== 'ready') {
        const status = STATUS_INFO[connectionDiagnostic.status];
        setScanError(`${status.title}. ${connectionDiagnostic.message}`);
        setScanActions(connectionDiagnostic.recommendedActions);
      } else {
        setScanError(friendlyScanFallback(normalizedEndpoint));
        setScanActions([
          'Comprueba que Ollama esté abierto y responda en el puerto 11434.',
          `Configura OLLAMA_ORIGINS="${ORIGIN}" y reinicia Ollama completamente.`,
          'En Chrome o Edge, permite el acceso a dispositivos de la red local.',
          'Vuelve a escanear después de completar estos pasos.',
        ]);
      }
      appendLog('error', connectionDiagnostic?.message ?? 'No se pudo consultar la lista de modelos.');

      if (error instanceof Error && error.name === 'AbortError') {
        setScanError(`Ollama no respondió dentro del tiempo esperado en ${normalizedEndpoint}.`);
      }
    } finally {
      setIsScanning(false);
    }
  }, [appendLog, normalizedEndpoint]);

  const handleDownloadModel = useCallback(async (model: (typeof campaignModelStatus)[number]) => {
    setDownloads((current) => ({
      ...current,
      [model.id]: { status: 'downloading', progress: null, message: 'Solicitando descarga a Ollama…', completedBytes: null, totalBytes: null },
    }));
    appendLog('info', `Iniciando descarga: ${model.id}`);
    try {
      await pullOllamaModel(normalizedEndpoint, model.id, (event) => {
        setDownloads((current) => ({
          ...current,
          [model.id]: {
            status: event.status === 'success' ? 'success' : 'downloading',
            progress: event.percent,
            message: event.status,
            completedBytes: event.completedBytes,
            totalBytes: event.totalBytes,
          },
        }));
        if (event.percent !== null) {
          appendLog('progress', `${model.name}: ${event.percent}% · ${formatBytes(event.completedBytes)} / ${formatBytes(event.totalBytes)}`);
        }
      });
      const models = await fetchOllamaModels(normalizedEndpoint);
      setInstalledModels(models);
      setSelectedModel(model.id);
      setDownloads((current) => ({
        ...current,
        [model.id]: { ...current[model.id], status: 'success', progress: 100, message: 'Modelo instalado y verificado en /api/tags.' },
      }));
      appendLog('success', `${model.name}: instalación terminada y modelo detectado.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDownloads((current) => ({
        ...current,
        [model.id]: { ...current[model.id], status: 'error', message },
      }));
      appendLog('error', `${model.name}: ${message}`);
    }
  }, [appendLog, normalizedEndpoint]);

  const handleDiagnose = useCallback(async () => {
    setIsChecking(true);
    setErrorDetail(null);

    try {
      const result = await diagnoseOllamaLocal(normalizedEndpoint, selectedModel || undefined);
      setDiagnostic(result);
      appendLog(result.status === 'ready' ? 'success' : 'error', `Diagnóstico de conexión: ${result.message}`);

      if (result.details.modelsInstalled.length > 0 && installedModels.length === 0) {
        setInstalledModels(result.details.modelsInstalled.map(name => ({
          name,
          modified_at: '',
          size: 0,
        })));
      }

      if (result.status === 'ready') {
        if (result.details.selectedModel) setSelectedModel(result.details.selectedModel);
      }
    } catch (error: unknown) {
      setErrorDetail(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsChecking(false);
    }
  }, [appendLog, installedModels.length, normalizedEndpoint, selectedModel]);

  return (
    <div className="ollama-wizard" data-testid="ollama-setup-wizard">
      <div className="ollama-wizard-header">
        <Server size={20} />
        <div>
          <h3 className="ollama-wizard-title">Conectar Ollama de este equipo</h3>
          <p className="ollama-wizard-subtitle">
            Configura diagnóstico local y prepara, cuando corresponda, los modelos congelados de OE4.
          </p>
        </div>
      </div>

      <div className="ollama-wizard-steps" aria-label="Progreso de configuración de Ollama">
        {[0, 1, 2, 3, 4].map(index => (
          <div
            key={index}
            className={`ollama-wizard-step-dot ${index === step ? 'ollama-wizard-step-dot--active' : ''} ${index < step ? 'ollama-wizard-step-dot--done' : ''}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Shield size={14} />
            <strong>Privacidad y arquitectura</strong>
          </div>
          <p className="ollama-wizard-text">
            Esta conexión va directamente desde tu navegador hacia Ollama en este equipo. Los prompts y respuestas no pasan por el servidor de AURA.
          </p>
          <div className="ollama-wizard-diagram">
            <code className="ollama-wizard-diagram-line">Navegador → 127.0.0.1:11434 → Ollama local</code>
          </div>
          <div className="ollama-wizard-actions">
            <button type="button" className="btn-p" onClick={() => setStep(1)}>Continuar</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <HardDrive size={14} />
            <strong>Sistema detectado</strong>
          </div>
          <div className="ollama-wizard-os-detected">
            <span className="ollama-wizard-os-label">Sistema detectado: {osLabel}</span>
            <div className="ollama-wizard-os-options">
              {(['windows', 'macos', 'linux', 'unknown'] as DesktopOS[]).map(os => (
                <button
                  type="button"
                  key={os}
                  className={`btn-s btn-sm ${currentOS === os ? 'ollama-wizard-os-btn--active' : ''}`}
                  onClick={() => setOverrideOS(os === 'unknown' ? null : os)}
                >
                  {getOSLabel(os)}
                </button>
              ))}
            </div>
          </div>
          <div className="ollama-wizard-section-header" style={{ marginTop: 'var(--space-md)' }}>
            <Globe size={14} />
            <strong>
              Navegador: {platform.browser === 'chrome' ? 'Chrome (recomendado)'
                : platform.browser === 'edge' ? 'Edge (compatible)'
                  : platform.browser === 'firefox' ? 'Firefox (puede requerir ajustes)'
                    : platform.browser === 'safari' ? 'Safari (no compatible con loopback)'
                      : 'Otro'}
            </strong>
          </div>
          {platform.browser !== 'chrome' && platform.browser !== 'edge' && (
            <p className="ollama-wizard-warning">Chrome o Edge son recomendados para la conexión local.</p>
          )}
          <div className="ollama-wizard-actions">
            <button type="button" className="btn-s btn-sm" onClick={() => setStep(0)}>Atrás</button>
            <button type="button" className="btn-p" onClick={() => setStep(2)}>Continuar</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Wrench size={14} />
            <strong>Autorizar a AURA · {osLabel}</strong>
          </div>
          <div className="ollama-wizard-origin-box"><code>OLLAMA_ORIGINS="{ORIGIN}"</code></div>
          <div className="ollama-wizard-instructions">
            {getInstructions().map((line, index) => (
              <p
                key={`${line}-${index}`}
                className={line.startsWith('O')
                  || line.startsWith('sudo')
                  || line.startsWith('setx')
                  || line.startsWith('launchctl')
                  || line.startsWith('[')
                  || line.startsWith('Environment')
                  ? 'ollama-wizard-instruction-cmd'
                  : 'ollama-wizard-instruction-step'}
              >
                {line || '\u00A0'}
              </p>
            ))}
          </div>
          {currentOS === 'windows' && (
            <div className="ollama-wizard-subsection">
              <strong>PowerShell:</strong>
              <div className="ollama-wizard-code-block"><code>{PS_WINDOWS}</code></div>
            </div>
          )}
          <p className="ollama-wizard-note">
            El cambio solo aplica a procesos nuevos. Cierra Ollama completamente y ábrelo otra vez antes de escanear.
          </p>
          <div className="ollama-wizard-actions">
            <button type="button" className="btn-s btn-sm" onClick={() => setStep(1)}>Atrás</button>
            <button type="button" className="btn-p" onClick={() => setStep(3)}>Ya configuré y reinicié Ollama</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Zap size={14} />
            <strong>Detectar y seleccionar modelo</strong>
          </div>
          <p className="ollama-wizard-text">
            AURA consulta <code>{normalizedEndpoint}/api/tags</code> para detectar los modelos disponibles.
            {selectedModel && (
              <span style={{ display: 'block', marginTop: '8px', color: 'var(--success)', fontWeight: 600 }}>
                Modelo seleccionado: {selectedModel}
              </span>
            )}
          </p>

          <div className="ollama-wizard-connect-area">
            <button
              type="button"
              className="btn-p"
              onClick={handleScanModels}
              disabled={isScanning}
              data-testid="ollama-scan-btn"
            >
              {isScanning
                ? <><Activity size={16} className="spinning" /> Escaneando...</>
                : <><Activity size={16} /> Escanear modelos instalados</>}
            </button>
          </div>

          {scanError && (
            <div className="ollama-wizard-diagnostic ollama-wizard-diagnostic--warning" style={{ marginTop: '12px' }} data-testid="ollama-scan-error">
              <div className="ollama-wizard-diagnostic-header">
                <AlertCircle size={16} style={{ color: 'var(--orange)' }} />
                <div>
                  <strong>No se pudo completar el escaneo</strong>
                  <p className="ollama-wizard-diagnostic-msg">{scanError}</p>
                </div>
              </div>
              {scanActions.length > 0 && (
                <div className="ollama-wizard-checklist">
                  <div className="ollama-wizard-checklist-title"><Wrench size={12} /><span>Qué revisar:</span></div>
                  <ul>{scanActions.map(action => <li key={action}>{action}</li>)}</ul>
                </div>
              )}
              <div className="ollama-wizard-actions">
                <button type="button" className="btn-s" onClick={handleScanModels} disabled={isScanning}>Volver a escanear</button>
                <button type="button" className="btn-s" onClick={() => setStep(4)}>Diagnosticar conexión</button>
              </div>
            </div>
          )}

          {installedModels.length > 0 && (
            <div className="ollama-wizard-model-list" style={{ marginTop: '12px' }}>
              <span className="ollama-wizard-model-label">Modelos instalados:</span>
              {installedModels.map(model => {
                const sizeGB = model.size > 0 ? (model.size / (1024 ** 3)).toFixed(1) : null;
                const isSelected = selectedModel === model.name;
                const isCampaign = FINAL_EVALUATION_OLLAMA_MODELS.some(formal => matchesModel(model.name, formal.id));
                return (
                  <button
                    type="button"
                    key={model.name}
                    className={`ollama-wizard-model-chip ${isSelected ? 'ollama-wizard-model-chip--selected' : ''}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      border: isSelected ? '2px solid var(--success)' : '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isSelected ? 'var(--surface-success, #f0faf0)' : 'var(--surface1)',
                    }}
                    onClick={() => setSelectedModel(model.name)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{model.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                        {sizeGB ? `${sizeGB} GB` : 'Tamaño no informado'}
                        {isCampaign ? ' · Modelo recomendado AURA' : ''}
                        {isModelHeavy(model.size) ? ' · Modelo pesado' : ''}
                      </div>
                    </div>
                    {isSelected && <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="ollama-wizard-section-header" style={{ marginTop: 'var(--space-md)' }}>
            <Download size={14} />
            <strong>Modelos recomendados de AURA</strong>
          </div>
          <p className="ollama-wizard-text">
            Para un diagnóstico normal basta con uno. Para ejecutar la comparación experimental deben estar instalados los tres con estos identificadores exactos.
          </p>
          <p className="ollama-wizard-note" data-testid="ollama-formal-model-count">
            Detectados: {installedCampaignCount} de {FINAL_EVALUATION_OLLAMA_MODELS.length} modelos recomendados.
          </p>

          <div style={{ display: 'grid', gap: '10px' }}>
            {campaignModelStatus.map(model => {
              const command = `ollama pull ${model.id}`;
              const download = downloads[model.id];
              const isDownloading = download?.status === 'downloading';
              const isInstalled = model.installed || download?.status === 'success';
              return (
                <div
                  key={model.id}
                  className="ollama-wizard-code-block ollama-wizard-model-card"
                  data-testid={`ollama-formal-model-${model.id.replace(/[^a-zA-Z0-9]/g, '-')}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <strong>{model.name}</strong>
                      <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--ink3)' }}>{model.purpose}</p>
                    </div>
                    <span style={{
                      color: isInstalled ? 'var(--success)' : isDownloading ? 'var(--accent)' : 'var(--ink3)',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {isInstalled ? 'Instalado' : isDownloading ? 'Descargando' : 'Pendiente'}
                    </span>
                  </div>
                  {download && (
                    <div className="ollama-model-download" aria-live="polite">
                      {download.progress !== null && (
                        <div
                          className="ollama-model-download-track"
                          role="progressbar"
                          aria-label={`Descarga de ${model.name.replace(' · OE4', '')}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={download.progress}
                        >
                          <span style={{ width: `${download.progress}%` }} />
                        </div>
                      )}
                      <div className={`ollama-model-download-status ollama-model-download-status--${download.status}`}>
                        <span>{download.message}</span>
                        {download.progress !== null && <strong>{download.progress}%</strong>}
                        {(download.completedBytes !== null || download.totalBytes !== null) && (
                          <span>{formatBytes(download.completedBytes)} / {formatBytes(download.totalBytes)}</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1, overflowWrap: 'anywhere' }}>{command}</code>
                    <button type="button" className="btn-s btn-sm" onClick={() => void copyCommand(command)}>
                      {copiedCommand === command ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  {!isInstalled && (
                    <button
                      type="button"
                      className="btn-p btn-sm ollama-model-download-button"
                      onClick={() => void handleDownloadModel(model)}
                      disabled={isDownloading}
                      data-testid={`ollama-download-${model.id.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    >
                      {isDownloading
                        ? <><Activity size={13} className="spinning" /> Descargando en Ollama…</>
                        : <><Download size={13} /> Descargar en Ollama</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="ollama-wizard-note">
            AURA verifica automáticamente cada descarga terminada contra la lista real de modelos de Ollama. El comando queda disponible como alternativa manual.
          </p>
          <div className="ollama-wizard-actions">
            <button type="button" className="btn-s btn-sm" onClick={() => setStep(2)}>Atrás</button>
            <button
              type="button"
              className="btn-p"
              onClick={() => setStep(4)}
              disabled={!selectedModel}
              title={!selectedModel ? 'Escanea y selecciona un modelo instalado primero' : undefined}
            >
              {selectedModel ? `Usar ${selectedModel}` : 'Selecciona un modelo'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Activity size={14} />
            <strong>Verificar conexión</strong>
          </div>
          <p className="ollama-wizard-text">
            La verificación distingue servidor cerrado, permiso de red local, autorización del origen y modelos ausentes.
          </p>

          {!diagnostic && (
            <div className="ollama-wizard-connect-area">
              <button type="button" className="btn-p btn-lg" onClick={handleDiagnose} disabled={isChecking}>
                {isChecking
                  ? <><Activity size={16} className="spinning" /> Verificando...</>
                  : <><Zap size={16} /> Solicitar permiso y conectar</>}
              </button>
              {errorDetail && <div className="ollama-wizard-error"><AlertCircle size={14} /><span>{errorDetail}</span></div>}
            </div>
          )}

          {diagnostic && (
            <div className={`ollama-wizard-diagnostic ollama-wizard-diagnostic--${diagnostic.status === 'ready' ? 'success' : 'warning'}`}>
              <div className="ollama-wizard-diagnostic-header">
                {STATUS_INFO[diagnostic.status].icon}
                <div>
                  <strong style={{ color: STATUS_INFO[diagnostic.status].color }}>{STATUS_INFO[diagnostic.status].title}</strong>
                  <p className="ollama-wizard-diagnostic-msg">{diagnostic.message}</p>
                </div>
              </div>

              {diagnostic.details.selectedModel && (
                <div className="ollama-wizard-model-list" style={{ marginTop: '8px' }}>
                  <span className="ollama-wizard-model-label">Modelo activo:</span>
                  <code className="ollama-wizard-model-chip">{diagnostic.details.selectedModel}</code>
                </div>
              )}

              {diagnostic.status !== 'ready' && diagnostic.recommendedActions.length > 0 && (
                <div className="ollama-wizard-checklist">
                  <div className="ollama-wizard-checklist-title"><Wrench size={12} /><span>Acciones recomendadas:</span></div>
                  <ul>{diagnostic.recommendedActions.map(action => <li key={action}>{action}</li>)}</ul>
                </div>
              )}

              <div className="ollama-wizard-actions">
                <button type="button" className="btn-s btn-sm" onClick={() => setStep(3)}>Volver a modelos</button>
                {diagnostic.status !== 'ready' && (
                  <button type="button" className="btn-s" onClick={handleDiagnose} disabled={isChecking}>Volver a intentar</button>
                )}
                {diagnostic.status === 'ready' && (
                  <>
                    <div className="ollama-wizard-ready-confirm">
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                      <span>Ollama y el modelo están listos para diagnóstico local.</span>
                    </div>
                    <button
                      type="button"
                      className="btn-p"
                      onClick={() => onReady?.(diagnostic)}
                      data-testid="ollama-use-model"
                    >
                      Usar este modelo en AURA
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ollama-syntax-display" data-testid="ollama-setup-log">
        <div className="ollama-syntax-display-head">
          <span>ollama.setup.log</span>
          <span>actividad real</span>
        </div>
        <div className="ollama-syntax-display-body" role="log" aria-live="polite">
          {setupLog.map((entry, index) => (
            <div className={`ollama-syntax-line ollama-syntax-line--${entry.kind}`} key={`${entry.at}-${index}`}>
              <time>{new Date(entry.at).toLocaleTimeString()}</time>
              <span>{entry.kind.toUpperCase()}</span>
              <code>{entry.message}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="ollama-wizard-footer">
        {onCancel && <button type="button" className="btn-s btn-sm" onClick={onCancel}>Cerrar asistente</button>}
      </div>
    </div>
  );
};

export default OllamaSetupWizard;
