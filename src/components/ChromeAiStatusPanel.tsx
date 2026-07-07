import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Activity, Download, CheckCircle, AlertCircle, FlaskConical, Eye, EyeOff, Copy, ExternalLink, ChevronDown, ChevronRight, Lock, Server, Globe, HardDrive, Wrench, Info } from 'lucide-react';
import { NormalizedAvailability } from '../services/chromeAvailability';
import { 
  checkChromeModelStatus,
  getChromeModelStatus, 
  startChromeModelPolling, 
  stopChromeModelPolling, 
  updateDownloadProgress,
  setPreparingState,
  clearDownloadProgress,
  resetChromeModelStatus,
  ChromeModelStatus,
  UIStatus,
  subscribeToStatusChanges
} from '../services/chromeModelStatus';

interface ChromeAiStatusPanelProps {
  compact?: boolean;
  onStatusChange?: (status: UIStatus) => void;
  onReady?: () => void;
  onDownloadProgress?: (progress: number, message: string) => void;
  onPrepare?: () => Promise<void>;
}

const CHROME_INTERNAL_URL = 'chrome://on-device-internals';
const CHROME_FLAGS_URL = 'chrome://flags';

export const ChromeAiStatusPanel: React.FC<ChromeAiStatusPanelProps> = ({
  compact = false,
  onStatusChange,
  onReady,
  onDownloadProgress,
  onPrepare,
}) => {
  const [status, setStatus] = useState<ChromeModelStatus>({
    uiStatus: 'idle',
    availability: null,
    downloadProgress: undefined,
    downloadLoaded: undefined,
    downloadTotal: undefined,
    downloadMessage: '',
    isPolling: false,
    lastChecked: null,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToStatusChanges((newStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus.uiStatus);
      
      if (newStatus.uiStatus === 'ready') {
        onReady?.();
      }
      
      if (newStatus.downloadProgress !== undefined) {
        onDownloadProgress?.(newStatus.downloadProgress, newStatus.downloadMessage);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [onStatusChange, onReady, onDownloadProgress]);

  useEffect(() => {
    return () => {
      stopChromeModelPolling();
    };
  }, []);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const result = await checkChromeModelStatus();
    setStatus(result);
    setIsChecking(false);
    return result;
  }, []);

  const handleVerify = useCallback(async () => {
    setIsChecking(true);
    const result = await checkChromeModelStatus();
    setStatus(result);
    setIsChecking(false);
    return result;
  }, []);

  const handlePrepare = useCallback(async () => {
    if (!onPrepare) return;
    
    setIsPreparing(true);
    setPreparingState('Iniciando descarga de Gemini Nano...');
    
    const pollingCallback = (newStatus: ChromeModelStatus) => {
      setStatus(newStatus);
      
      if (newStatus.uiStatus === 'downloading' && newStatus.downloadProgress !== undefined) {
        onDownloadProgress?.(newStatus.downloadProgress, newStatus.downloadMessage);
      }
      
      if (newStatus.uiStatus === 'ready') {
        setIsPreparing(false);
        clearDownloadProgress();
        stopChromeModelPolling();
      }
    };
    
    startChromeModelPolling(pollingCallback);
    
    try {
      await onPrepare();
    } catch (error) {
      setIsPreparing(false);
      clearDownloadProgress();
      stopChromeModelPolling();
    }
  }, [onPrepare, onDownloadProgress]);

  useEffect(() => {
    checkChromeModelStatus().then(result => {
      setStatus(result);
      if (result.uiStatus === 'downloading') {
        startChromeModelPolling((newStatus) => {
          setStatus(newStatus);
          onStatusChange?.(newStatus.uiStatus);
          if (newStatus.uiStatus === 'ready') {
            onReady?.();
            stopChromeModelPolling();
          }
          if (newStatus.downloadProgress !== undefined) {
            onDownloadProgress?.(newStatus.downloadProgress, newStatus.downloadMessage);
          }
        });
      }
    });
  }, []);

  const copyInternalUrl = useCallback(() => {
    navigator.clipboard.writeText(CHROME_INTERNAL_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const getStatusBadge = (uiStatus: UIStatus) => {
    const colors: Record<UIStatus, string> = {
      idle: 'info',
      api_missing: 'error',
      unavailable: 'error',
      downloadable: 'warning',
      downloading: 'info',
      preparing: 'info',
      ready: 'success',
      error: 'error',
    };
    
    const icons: Record<UIStatus, React.ReactNode> = {
      idle: <Activity size={12} />,
      api_missing: <AlertCircle size={12} />,
      unavailable: <AlertCircle size={12} />,
      downloadable: <Download size={12} />,
      downloading: <Activity size={12} className="spinning" />,
      preparing: <Activity size={12} className="spinning" />,
      ready: <CheckCircle size={12} />,
      error: <AlertCircle size={12} />,
    };
    
    const labels: Record<UIStatus, string> = {
      idle: 'Sin verificar',
      api_missing: 'API no detectada',
      unavailable: 'No disponible',
      downloadable: 'Disponible',
      downloading: 'Descargando',
      preparing: 'Preparando',
      ready: 'Listo',
      error: 'Error',
    };
    
    return {
      color: colors[uiStatus],
      icon: icons[uiStatus],
      label: labels[uiStatus],
    };
  };

  const badge = getStatusBadge(status.uiStatus);

  const renderDownloadingState = () => (
    <div className="chrome-ai-downloading-state">
      {compact ? (
        <div className="chrome-ai-compact-message">
          <span>Gemini Nano se está descargando</span>
          {status.downloadProgress !== undefined ? (
            <div className="chrome-ai-compact-bar">
              <div className="chrome-ai-progress-bar">
                <div className="chrome-ai-progress-fill" style={{ width: `${status.downloadProgress}%` }} />
              </div>
              <span>{status.downloadProgress}%</span>
            </div>
          ) : (
            <div className="chrome-ai-progress-bar chrome-ai-progress-bar--indeterminate">
              <div className="chrome-ai-progress-fill chrome-ai-progress-fill--indeterminate" />
            </div>
          )}
          <span className="chrome-ai-compact-note">AURA verificará cada 5s</span>
        </div>
      ) : (
        <>
          <div className="chrome-ai-status-message">
            <p><strong>Gemini Nano se está descargando en Chrome.</strong></p>
            <p>Mantén Chrome abierto durante el proceso. No cierres esta pestaña.</p>
          </div>
          
          {status.downloadProgress !== undefined ? (
            <div className="chrome-ai-progress-container">
              <div className="chrome-ai-progress-bar">
                <div 
                  className="chrome-ai-progress-fill"
                  style={{ width: `${status.downloadProgress}%` }}
                />
              </div>
              <div className="chrome-ai-progress-info">
                <span className="chrome-ai-progress-percent">{status.downloadProgress}%</span>
                {status.downloadTotal !== undefined && status.downloadTotal > 0 && (
                  <span className="chrome-ai-progress-bytes">
                    {formatMB(status.downloadLoaded || 0)} / {formatMB(status.downloadTotal)}
                  </span>
                )}
              </div>
              {status.downloadMessage && (
                <span className="chrome-ai-progress-message">{status.downloadMessage}</span>
              )}
            </div>
          ) : (
            <div className="chrome-ai-progress-container">
              <div className="chrome-ai-progress-bar chrome-ai-progress-bar--indeterminate">
                <div className="chrome-ai-progress-fill chrome-ai-progress-fill--indeterminate" />
              </div>
              <span className="chrome-ai-progress-message">Esperando información de descarga de Chrome...</span>
            </div>
          )}

          <div className="chrome-ai-diagnostic-checklist">
            <div className="chrome-ai-checklist-title">
              <Wrench size={12} />
              <span>¿No avanza la descarga? Revisa esto:</span>
            </div>
            <ul className="chrome-ai-checklist-items">
              <li>
                <HardDrive size={12} />
                <span>Espacio libre en disco: Gemini Nano requiere ~4.5 GB. Libera espacio si es necesario.</span>
              </li>
              <li>
                <Info size={12} />
                <span>Es normal que tarde varios minutos. La barra se actualiza cuando Chrome reporta progreso.</span>
              </li>
              <li>
                <Activity size={12} />
                <span>Abre <code>chrome://on-device-internals</code> para ver el estado real de descarga.</span>
              </li>
              <li>
                <RefreshCwIcon size={12} />
                <span>Si queda bloqueada más de 15 minutos, reinicia Chrome y vuelve a preparar Gemini Nano.</span>
              </li>
              <li>
                <AlertCircle size={12} />
                <span>No cierres Chrome durante la descarga. Si se completa, el modelo queda guardado localmente.</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );

  const renderReadyState = () => (
    <div className="chrome-ai-ready-state">
      {compact ? (
        <div className="chrome-ai-compact-message">
          <CheckCircle size={12} />
          <span>Gemini Nano listo</span>
          <span className="chrome-ai-compact-note">Proveedor local en navegador</span>
        </div>
      ) : (
        <>
          <div className="chrome-ai-status-message">
            <p><strong>Gemini Nano listo para diagnóstico.</strong></p>
            <p>El modelo se ejecuta localmente en tu navegador. Los datos crudos no se envían a servidores externos mientras este modo esté activo.</p>
          </div>
          <div className="chrome-ai-ready-indicator">
            <Lock size={14} />
            <span>Proveedor local en navegador</span>
          </div>
        </>
      )}
    </div>
  );

  const renderDownloadableState = () => (
    <div className="chrome-ai-downloadable-state">
      <div className="chrome-ai-status-message">
        <p><strong>Gemini Nano puede prepararse en este equipo.</strong></p>
        <p>La primera preparación descargará el modelo (~4.5 GB). Chrome hará la descarga localmente. Una vez completada, el modelo queda disponible para uso inmediato.</p>
      </div>
      <button 
        className="btn-p"
        onClick={handlePrepare}
        disabled={isPreparing}
      >
        {isPreparing ? (
          <>
            <Activity size={14} className="spinning" /> Preparando...
          </>
        ) : (
          <>
            <Download size={14} /> Preparar Gemini Nano
          </>
        )}
      </button>
      <p className="chrome-ai-downloadable-note">
        Mantén Chrome abierto durante el proceso. No cierres esta pestaña.
      </p>
    </div>
  );

  const renderUnavailableState = () => (
    <div className="chrome-ai-unavailable-state">
      <div className="chrome-ai-status-message">
        <p><strong>Gemini Nano no está disponible en este equipo.</strong></p>
        <p>Esto no significa que AURA esté rota. El flujo determinístico y el resto de proveedores siguen funcionando.</p>
      </div>
      <div className="chrome-ai-actions-row">
        <button 
          className="btn-s"
          onClick={handleVerify}
          disabled={isChecking}
        >
          <FlaskConical size={12} /> {isChecking ? 'Verificando...' : 'Verificar de nuevo'}
        </button>
        <button 
          className="btn-s"
          onClick={() => window.open(CHROME_INTERNAL_URL, '_blank')}
        >
          <ExternalLink size={12} /> chrome://on-device-internals
        </button>
      </div>
      <div className="chrome-ai-diagnostic-checklist">
        <div className="chrome-ai-checklist-title">
          <Wrench size={12} />
          <span>Diagnóstico guiado:</span>
        </div>
        <ul className="chrome-ai-checklist-items">
          <li>
            <HardDrive size={12} />
            <span>Revisa espacio libre en disco. Gemini Nano necesita ~4.5 GB. Sin espacio suficiente, Chrome no descargará el modelo.</span>
          </li>
          <li>
            <Activity size={12} />
            <span>Abre <code>chrome://on-device-internals</code> para ver el estado y los modelos descargados.</span>
          </li>
          <li>
            <Wrench size={12} />
            <span>Verifica en <code>chrome://flags</code> que "Prompt API" o "Built-in AI" estén habilitados.</span>
          </li>
          <li>
            <AlertCircle size={12} />
            <span>Libera espacio en el perfil de Chrome si ves que la descarga no logra completarse.</span>
          </li>
          <li>
            <RefreshCwIcon size={12} />
            <span>Reinicia Chrome después de cambiar flags o liberar espacio.</span>
          </li>
        </ul>
      </div>
      <div className="chrome-ai-instructions">
        <p><strong>Requisitos de activación:</strong></p>
        <ol>
          <li>Usa Google Chrome 138 o superior.</li>
          <li>Abre <code>chrome://flags</code></li>
          <li>Busca "Prompt API", "Gemini Nano" o "Built-in AI".</li>
          <li>Activa las opciones encontradas.</li>
          <li>Reinicia Chrome.</li>
          <li>Vuelve a verificar el estado desde aquí.</li>
        </ol>
      </div>
    </div>
  );

  const renderApiMissingState = () => (
    <div className="chrome-ai-api-missing-state">
      <div className="chrome-ai-status-message">
        <p><strong>API de Chrome AI no detectada en este navegador.</strong></p>
        <p>El flujo determinístico de AURA y el resto de proveedores (Ollama, Cloud) no dependen de Chrome AI. Puedes continuar sin problema.</p>
      </div>
      <div className="chrome-ai-actions-row">
        <button 
          className="btn-s"
          onClick={() => window.open(CHROME_INTERNAL_URL, '_blank')}
        >
          <ExternalLink size={12} /> chrome://on-device-internals
        </button>
        <button 
          className="btn-s"
          onClick={() => window.open(CHROME_FLAGS_URL, '_blank')}
        >
          <ExternalLink size={12} /> chrome://flags
        </button>
      </div>
      <div className="chrome-ai-diagnostic-checklist">
        <div className="chrome-ai-checklist-title">
          <Wrench size={12} />
          <span>¿Quieres activar Chrome AI?</span>
        </div>
        <ul className="chrome-ai-checklist-items">
          <li>
            <Activity size={12} />
            <span>Usa Google Chrome 138 o superior. Otros navegadores (Firefox, Safari, Brave) no tienen esta API.</span>
          </li>
          <li>
            <Wrench size={12} />
            <span>Abre <code>chrome://flags</code> y busca "Prompt API" o "Built-in AI". Activa las opciones.</span>
          </li>
          <li>
            <RefreshCwIcon size={12} />
            <span>Reinicia Chrome después de cambiar los flags. Luego vuelve a verificar el estado.</span>
          </li>
        </ul>
      </div>
      <div className="chrome-ai-instructions">
        <p><strong>Pasos detallados:</strong></p>
        <ol>
          <li>Abre <code>chrome://flags</code></li>
          <li>Busca "Prompt API" o "Built-in AI"</li>
          <li>Activa las opciones encontradas</li>
          <li>Reinicia Chrome</li>
          <li>Abre <code>chrome://on-device-internals</code> para confirmar</li>
        </ol>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="chrome-ai-error-state">
      <div className="chrome-ai-status-message">
        <p><strong>Error al verificar Chrome AI.</strong></p>
        <p>El motor determinista de AURA sigue disponible. Puedes continuar con otro proveedor mientras tanto.</p>
      </div>
      <div className="chrome-ai-diagnostic-checklist">
        <div className="chrome-ai-checklist-title">
          <Wrench size={12} />
          <span>Posibles causas y soluciones:</span>
        </div>
        <ul className="chrome-ai-checklist-items">
          <li>
            <HardDrive size={12} />
            <span>Falta de espacio en disco. Gemini Nano requiere ~4.5 GB libres en el perfil de Chrome.</span>
          </li>
          <li>
            <Activity size={12} />
            <span>Revisa <code>chrome://on-device-internals</code> para ver si el modelo está bloqueado o corrupto.</span>
          </li>
          <li>
            <Wrench size={12} />
            <span>Verifica en <code>chrome://flags</code> que los flags de Chrome AI sigan activos.</span>
          </li>
          <li>
            <RefreshCwIcon size={12} />
            <span>Reinicia Chrome. Si el error persiste, prueba en una ventana de incógnito para descartar extensiones.</span>
          </li>
        </ul>
      </div>
      <div className="chrome-ai-actions-row">
        <button 
          className="btn-s"
          onClick={handleVerify}
          disabled={isChecking}
        >
          <Activity size={12} /> {isChecking ? 'Verificando...' : 'Volver a verificar'}
        </button>
        <button 
          className="btn-s"
          onClick={() => window.open(CHROME_INTERNAL_URL, '_blank')}
        >
          <ExternalLink size={12} /> chrome://on-device-internals
        </button>
      </div>
    </div>
  );

  const renderStateContent = () => {
    switch (status.uiStatus) {
      case 'downloading':
      case 'preparing':
        return renderDownloadingState();
      case 'ready':
        return renderReadyState();
      case 'downloadable':
        return renderDownloadableState();
      case 'unavailable':
        return renderUnavailableState();
      case 'api_missing':
        return renderApiMissingState();
      case 'error':
        return renderErrorState();
      default:
        return (
          <div className="chrome-ai-idle-state">
            <div className="chrome-ai-status-message">
              <p>Verifica el estado de Chrome AI para continuar.</p>
            </div>
            <button 
              className="btn-s"
              onClick={handleVerify}
              disabled={isChecking}
            >
              <Eye size={12} /> {isChecking ? 'Verificando...' : 'Verificar estado'}
            </button>
          </div>
        );
    }
  };

  if (compact) {
    return (
      <div className="chrome-ai-status-strip" data-testid="chrome-ai-status-strip">
        <div className="chrome-ai-status-strip-main">
          {badge.icon}
          <span className="chrome-ai-strip-label">
            {status.uiStatus === 'ready' && 'Gemini Nano listo · Modo local activo'}
            {status.uiStatus === 'downloading' && 'Gemini Nano descargando...'}
            {status.uiStatus === 'downloadable' && 'Gemini Nano disponible'}
            {status.uiStatus === 'preparing' && 'Preparando Gemini Nano...'}
            {(status.uiStatus === 'idle' || status.uiStatus === 'api_missing' || status.uiStatus === 'unavailable' || status.uiStatus === 'error') && 'Chrome AI / Gemini Nano'}
          </span>
        </div>
        <button
          className="btn-s btn-sm chrome-ai-internal-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
          <span>{showDetails ? 'Ocultar' : 'Estado interno'}</span>
        </button>

        {showDetails && (
          <div className="chrome-ai-internal-panel">
            <div className="chrome-ai-internal-grid">
              {status.availability && (
                <>
                  <div className="chrome-ai-internal-row">
                    <span>API</span>
                    <span>{status.availability.apiSurface}</span>
                  </div>
                  <div className="chrome-ai-internal-row">
                    <span>Estado</span>
                    <span>{status.availability.status}</span>
                  </div>
                  {status.availability.availabilityRaw && (
                    <div className="chrome-ai-internal-row">
                      <span>Raw</span>
                      <span className="chrome-ai-raw">{status.availability.availabilityRaw}</span>
                    </div>
                  )}
                  {status.lastChecked && (
                    <div className="chrome-ai-internal-row">
                      <span>Verificación</span>
                      <span>{status.lastChecked.toLocaleTimeString()}</span>
                    </div>
                  )}
                  {status.availability.browserInfo && (
                    <>
                      <div className="chrome-ai-internal-row">
                        <span>Plataforma</span>
                        <span>{status.availability.browserInfo.platform}</span>
                      </div>
                      {status.availability.browserInfo.chromeVersion && (
                        <div className="chrome-ai-internal-row">
                          <span>Chrome</span>
                          <span>{status.availability.browserInfo.chromeVersion}</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <div className="chrome-ai-internal-url-row">
              <code className="chrome-ai-internal-url">{CHROME_INTERNAL_URL}</code>
              <button
                className="btn-s btn-xs"
                onClick={copyInternalUrl}
                title="Copiar URL"
              >
                {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
              </button>
              <button
                className="btn-s btn-xs"
                onClick={() => window.open(CHROME_INTERNAL_URL, '_blank')}
                title="Abrir"
              >
                <ExternalLink size={10} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chrome-ai-status-panel" data-testid="chrome-ai-status-panel">
      <div className="chrome-ai-status-panel-header">
        <div className="chrome-ai-status-panel-title">
          <Brain size={16} />
          <h3>Chrome AI / Gemini Nano</h3>
        </div>
        <div className={`chrome-ai-status-badge chrome-ai-status-badge--${badge.color}`}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      </div>

      <div className="chrome-ai-status-panel-content">
        {renderStateContent()}
      </div>

      <div className="chrome-ai-status-panel-footer">
        <button
          className="chrome-ai-details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
          <span>{showDetails ? 'Ocultar' : 'Ver'} detalles técnicos</span>
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showDetails && (
          <div className="chrome-ai-details-content">
            <div className="chrome-ai-url-copy">
              <code className="chrome-ai-internal-url">{CHROME_INTERNAL_URL}</code>
              <button
                className="btn-s btn-xs"
                onClick={copyInternalUrl}
                title="Copiar URL"
              >
                {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
              </button>
            </div>

            <p className="chrome-ai-note">
              AURA no puede leer esta página interna, pero puedes abrirla para confirmar el estado de Chrome.
            </p>

            {status.availability && (
              <div className="chrome-ai-tech-details">
                <div className="chrome-ai-detail-row">
                  <span>API Surface:</span>
                  <span>{status.availability.apiSurface}</span>
                </div>
                <div className="chrome-ai-detail-row">
                  <span>Estado:</span>
                  <span>{status.availability.status}</span>
                </div>
                {status.availability.availabilityRaw && (
                  <div className="chrome-ai-detail-row">
                    <span>Raw:</span>
                    <span>{status.availability.availabilityRaw}</span>
                  </div>
                )}
                {status.lastChecked && (
                  <div className="chrome-ai-detail-row">
                    <span>Última verificación:</span>
                    <span>{status.lastChecked.toLocaleTimeString()}</span>
                  </div>
                )}
                {status.isPolling && (
                  <div className="chrome-ai-detail-row">
                    <span>Polling:</span>
                    <span>Activo (cada 5s)</span>
                  </div>
                )}
                {status.availability.browserInfo && (
                  <>
                    <div className="chrome-ai-detail-row">
                      <span>Plataforma:</span>
                      <span>{status.availability.browserInfo.platform}</span>
                    </div>
                    {status.availability.browserInfo.chromeVersion && (
                      <div className="chrome-ai-detail-row">
                        <span>Chrome:</span>
                        <span>{status.availability.browserInfo.chromeVersion}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function formatMB(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function ChevronUp({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  );
}

function RefreshCwIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  );
}

export default ChromeAiStatusPanel;
