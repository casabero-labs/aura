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
  OllamaLocalDiagnostic,
  OllamaLocalStatus,
  OllamaModelInfo,
} from '../services/ollamaLocalBridge';
import {
  detectBrowser,
  detectOS,
  DesktopOS,
  getOSLabel,
  PlatformInfo,
} from '../services/platformDetection';

interface OllamaSetupWizardProps {
  endpoint?: string;
  onReady?: (diagnostic: OllamaLocalDiagnostic) => void;
  onCancel?: () => void;
}

interface FormalOllamaModel {
  name: string;
  label: string;
  purpose: string;
}

const ORIGIN = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://aura.casabero.com';

const FORMAL_OLLAMA_MODELS: readonly FormalOllamaModel[] = [
  {
    name: 'qwen2.5:3b',
    label: 'Qwen 2.5 3B',
    purpose: 'Modelo compacto y rápido para diagnóstico local.',
  },
  {
    name: 'gemma3:4b',
    label: 'Gemma 3 4B',
    purpose: 'Modelo intermedio para contraste de cumplimiento y claridad.',
  },
  {
    name: 'mistral:7b',
    label: 'Mistral 7B',
    purpose: 'Modelo de mayor tamaño para la comparación experimental.',
  },
] as const;

const INSTRUCTIONS_WINDOWS = [
  '1. Cierra Ollama desde la bandeja del sistema.',
  '2. Abre Configuración → busca "Variables de entorno".',
  '3. Abre "Editar las variables de entorno de tu cuenta".',
  '4. En "Variables de usuario", pulsa "Nueva".',
  '5. Nombre: OLLAMA_ORIGINS',
  `6. Valor: ${ORIGIN}`,
  '7. Guarda con "Aceptar".',
  '8. Abre Ollama nuevamente desde Inicio.',
];

const INSTRUCTIONS_MACOS = [
  '1. Cierra Ollama desde la barra de menús.',
  '2. Abre Terminal.',
  `3. Ejecuta: launchctl setenv OLLAMA_ORIGINS "${ORIGIN}"`,
  '4. Abre Ollama nuevamente desde Aplicaciones.',
  '',
  'O manualmente:',
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
  'O manualmente:',
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
    title: 'Modelo no instalado',
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

const matchesModel = (installedName: string, formalName: string): boolean => (
  installedName === formalName
  || installedName.startsWith(`${formalName}-`)
  || installedName.startsWith(`${formalName}@`)
);

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

  const formalModelStatus = useMemo(() => FORMAL_OLLAMA_MODELS.map(model => ({
    ...model,
    installed: installedModels.some(installed => matchesModel(installed.name, model.name)),
  })), [installedModels]);

  const installedFormalCount = formalModelStatus.filter(model => model.installed).length;

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

    try {
      const models = await fetchOllamaModels(normalizedEndpoint);
      setInstalledModels(models);

      const preferred = FORMAL_OLLAMA_MODELS
        .map(formal => models.find(model => matchesModel(model.name, formal.name)))
        .find(Boolean);

      setSelectedModel(current => current ?? preferred?.name ?? models[0]?.name ?? null);

      if (models.length === 0) {
        setScanError('Ollama respondió correctamente, pero todavía no tiene modelos instalados.');
        setScanActions([
          'Instala al menos uno de los modelos formales mostrados abajo para usar el diagnóstico.',
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

      if (error instanceof Error && error.name === 'AbortError') {
        setScanError(`Ollama no respondió dentro del tiempo esperado en ${normalizedEndpoint}.`);
      }
    } finally {
      setIsScanning(false);
    }
  }, [normalizedEndpoint]);

  const handleDiagnose = useCallback(async () => {
    setIsChecking(true);
    setErrorDetail(null);

    try {
      const result = await diagnoseOllamaLocal(normalizedEndpoint, selectedModel || undefined);
      setDiagnostic(result);

      if (result.details.modelsInstalled.length > 0 && installedModels.length === 0) {
        setInstalledModels(result.details.modelsInstalled.map(name => ({
          name,
          modified_at: '',
          size: 0,
        })));
      }

      if (result.status === 'ready') {
        if (result.details.selectedModel) {
          setSelectedModel(result.details.selectedModel);
        }
        onReady?.(result);
      }
    } catch (error: unknown) {
      setErrorDetail(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsChecking(false);
    }
  }, [installedModels.length, normalizedEndpoint, onReady, selectedModel]);

  return (
    <div className="ollama-wizard" data-testid="ollama-setup-wizard">
      <div className="ollama-wizard-header">
        <Server size={20} />
        <div>
          <h3 className="ollama-wizard-title">Conectar Ollama de este equipo</h3>
          <p className="ollama-wizard-subtitle">
            Configura Ollama local para diagnóstico privado desde AURA
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
            AURA está alojada en internet, pero esta conexión va directamente desde tu navegador hacia Ollama en este equipo. Los prompts y respuestas no pasan por el servidor de AURA.
          </p>
          <div className="ollama-wizard-diagram">
            <code className="ollama-wizard-diagram-line">
              Navegador → 127.0.0.1:11434 → Ollama local
            </code>
          </div>
          <div className="ollama-wizard-actions">
            <button type="button" className="btn-p" onClick={() => setStep(1)}>
              Continuar
            </button>
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
            <p className="ollama-wizard-warning">
              Chrome o Edge son recomendados para la conexión con Ollama local.
            </p>
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
            <strong>Configurar OLLAMA_ORIGINS · {osLabel}</strong>
          </div>
          <div className="ollama-wizard-origin-box">
            <code>OLLAMA_ORIGINS="{ORIGIN}"</code>
          </div>
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
            <strong>Seleccionar modelo</strong>
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

          {isScanning && (
            <div className="ollama-wizard-diagnostic ollama-wizard-diagnostic--warning" style={{ marginTop: '12px' }}>
              <div className="ollama-wizard-diagnostic-header">
                <Activity size={16} className="spinning" />
                <span>Consultando Ollama en este equipo...</span>
              </div>
            </div>
          )}

          {scanError && (
            <div
              className="ollama-wizard-diagnostic ollama-wizard-diagnostic--warning"
              style={{ marginTop: '12px' }}
              data-testid="ollama-scan-error"
            >
              <div className="ollama-wizard-diagnostic-header">
                <AlertCircle size={16} style={{ color: 'var(--orange)' }} />
                <div>
                  <strong>No se pudo completar el escaneo</strong>
                  <p className="ollama-wizard-diagnostic-msg">{scanError}</p>
                </div>
              </div>
              {scanActions.length > 0 && (
                <div className="ollama-wizard-checklist">
                  <div className="ollama-wizard-checklist-title">
                    <Wrench size={12} />
                    <span>Qué revisar:</span>
                  </div>
                  <ul>
                    {scanActions.map(action => <li key={action}>{action}</li>)}
                  </ul>
                </div>
              )}
              <div className="ollama-wizard-actions">
                <button type="button" className="btn-s" onClick={handleScanModels} disabled={isScanning}>
                  <Activity size={12} /> Volver a escanear
                </button>
                <button type="button" className="btn-s" onClick={() => setStep(4)}>
                  Diagnosticar conexión
                </button>
              </div>
            </div>
          )}

          {installedModels.length > 0 && (
            <div className="ollama-wizard-model-list" style={{ marginTop: '12px' }}>
              <span className="ollama-wizard-model-label">Modelos instalados:</span>
              {installedModels.map(model => {
                const isHeavy = isModelHeavy(model.size);
                const sizeGB = model.size > 0
                  ? (model.size / (1024 * 1024 * 1024)).toFixed(1)
                  : null;
                const isSelected = selectedModel === model.name;
                const isFormal = FORMAL_OLLAMA_MODELS.some(formal => matchesModel(model.name, formal.name));

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
                    data-testid={`ollama-model-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{model.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                        {sizeGB ? `${sizeGB} GB` : 'Tamaño no informado'}
                        {isFormal ? ' · Modelo formal AURA' : ''}
                        {isHeavy ? ' · Modelo pesado' : ''}
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
            <strong>Modelos formales de AURA</strong>
          </div>
          <p className="ollama-wizard-text">
            Para un diagnóstico normal basta con uno. Para ejecutar la comparación experimental deben estar instalados los tres.
          </p>
          <p className="ollama-wizard-note" data-testid="ollama-formal-model-count">
            Detectados: {installedFormalCount} de {FORMAL_OLLAMA_MODELS.length} modelos formales.
          </p>

          <div style={{ display: 'grid', gap: '10px' }}>
            {formalModelStatus.map(model => {
              const command = `ollama pull ${model.name}`;
              return (
                <div
                  key={model.name}
                  className="ollama-wizard-code-block"
                  style={{ display: 'grid', gap: '6px' }}
                  data-testid={`ollama-formal-model-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <strong>{model.label}</strong>
                      <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--ink3)' }}>{model.purpose}</p>
                    </div>
                    <span style={{
                      color: model.installed ? 'var(--success)' : 'var(--ink3)',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {model.installed ? 'Instalado' : 'Pendiente'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1 }}>{command}</code>
                    <button type="button" className="btn-s btn-sm" onClick={() => void copyCommand(command)}>
                      {copiedCommand === command ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="ollama-wizard-note">
            Después de una descarga, espera a que termine y vuelve a pulsar “Escanear modelos instalados”.
          </p>
          <div className="ollama-wizard-actions">
            <button type="button" className="btn-s btn-sm" onClick={() => setStep(2)}>Atrás</button>
            <button
              type="button"
              className="btn-p"
              onClick={() => setStep(4)}
              disabled={!selectedModel}
              title={!selectedModel ? 'Escanea y selecciona un modelo instalado primero' : undefined}
              data-testid="ollama-step3-continue"
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
            La verificación distingue servidor cerrado, permiso de red local, autorización de origen y modelos ausentes.
          </p>

          {!diagnostic && (
            <div className="ollama-wizard-connect-area">
              <button
                type="button"
                className="btn-p btn-lg"
                onClick={handleDiagnose}
                disabled={isChecking}
                data-testid="ollama-connect-btn"
              >
                {isChecking
                  ? <><Activity size={16} className="spinning" /> Verificando...</>
                  : <><Zap size={16} /> Solicitar permiso y conectar</>}
              </button>
              {errorDetail && (
                <div className="ollama-wizard-error">
                  <AlertCircle size={14} />
                  <span>{errorDetail}</span>
                </div>
              )}
            </div>
          )}

          {diagnostic && (
            <div className={`ollama-wizard-diagnostic ollama-wizard-diagnostic--${diagnostic.status === 'ready' ? 'success' : 'warning'}`}>
              <div className="ollama-wizard-diagnostic-header">
                {STATUS_INFO[diagnostic.status].icon}
                <div>
                  <strong style={{ color: STATUS_INFO[diagnostic.status].color }}>
                    {STATUS_INFO[diagnostic.status].title}
                  </strong>
                  <p className="ollama-wizard-diagnostic-msg">{diagnostic.message}</p>
                </div>
              </div>

              {diagnostic.details.selectedModel && (
                <div className="ollama-wizard-model-list" style={{ marginTop: '8px', marginBottom: '8px' }}>
                  <span className="ollama-wizard-model-label">Modelo activo:</span>
                  <code className="ollama-wizard-model-chip" style={{ background: 'var(--accent-bg, #e8f0fe)', fontWeight: 600 }}>
                    {diagnostic.details.selectedModel}
                  </code>
                </div>
              )}

              {diagnostic.details.modelsInstalled.length > 0 && (
                <div className="ollama-wizard-model-list">
                  <span className="ollama-wizard-model-label">Modelos instalados:</span>
                  {diagnostic.details.modelsInstalled.map(model => (
                    <code key={model} className="ollama-wizard-model-chip">{model}</code>
                  ))}
                </div>
              )}

              {diagnostic.status !== 'ready' && diagnostic.recommendedActions.length > 0 && (
                <div className="ollama-wizard-checklist">
                  <div className="ollama-wizard-checklist-title">
                    <Wrench size={12} />
                    <span>Acciones recomendadas:</span>
                  </div>
                  <ul>
                    {diagnostic.recommendedActions.map(action => <li key={action}>{action}</li>)}
                  </ul>
                </div>
              )}

              <div className="ollama-wizard-actions">
                <button type="button" className="btn-s btn-sm" onClick={() => setStep(3)}>
                  Volver a modelos
                </button>
                {diagnostic.status !== 'ready' && (
                  <button type="button" className="btn-s" onClick={handleDiagnose} disabled={isChecking}>
                    <Activity size={12} /> {isChecking ? 'Verificando...' : 'Volver a intentar'}
                  </button>
                )}
                {diagnostic.status === 'ready' && (
                  <div className="ollama-wizard-ready-confirm">
                    <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                    <span>Ollama y el modelo están listos para diagnóstico local.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ollama-wizard-footer">
        {onCancel && (
          <button type="button" className="btn-s btn-sm" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

export default OllamaSetupWizard;
