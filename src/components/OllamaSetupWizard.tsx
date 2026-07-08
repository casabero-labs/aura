import React, { useCallback, useEffect, useState } from 'react';
import {
  Server, Terminal, CheckCircle, AlertCircle, Activity, ExternalLink,
  ChevronDown, ChevronUp, Shield, Globe, HardDrive, Zap, Wrench, Lock, Info, Download,
} from 'lucide-react';
import {
  diagnoseOllamaLocal, fetchOllamaModels, isModelHeavy,
  OllamaLocalDiagnostic, OllamaLocalStatus, OllamaModelInfo,
  normalizeEndpoint, isLocalLoopback,
} from '../services/ollamaLocalBridge';
import { detectOS, detectBrowser, DesktopOS, BrowserFamily, PlatformInfo, getOSLabel } from '../services/platformDetection';

interface OllamaSetupWizardProps {
  endpoint?: string;
  onReady?: (diagnostic: OllamaLocalDiagnostic) => void;
  onCancel?: () => void;
}

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://aura.casabero.com';

const INSTRUCTIONS_WINDOWS = [
  '1. Cierra Ollama desde la bandeja del sistema.',
  '2. Abre Configuración → busca "Variables de entorno".',
  '3. Abre "Editar las variables de entorno de tu cuenta".',
  '4. En "Variables de usuario", pulsa "Nueva".',
  `5. Nombre: OLLAMA_ORIGINS`,
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
  `2. Ejecuta: sudo systemctl edit ollama.service`,
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

const STATUS_INFO: Record<OllamaLocalStatus, { icon: React.ReactNode; color: string; title: string }> = {
  not_configured: { icon: <Wrench size={16} />, color: 'var(--orange)', title: 'Falta configurar OLLAMA_ORIGINS' },
  permission_required: { icon: <Shield size={16} />, color: 'var(--blue)', title: 'Permiso de red local requerido' },
  permission_denied: { icon: <AlertCircle size={16} />, color: 'var(--error)', title: 'Permiso de red local denegado' },
  cors_blocked: { icon: <AlertCircle size={16} />, color: 'var(--error)', title: 'OLLAMA_ORIGINS no configurado' },
  server_unreachable: { icon: <Server size={16} />, color: 'var(--error)', title: 'Ollama no está iniciado' },
  timeout: { icon: <AlertCircle size={16} />, color: 'var(--orange)', title: 'Ollama no respondió a tiempo' },
  model_missing: { icon: <HardDrive size={16} />, color: 'var(--orange)', title: 'Modelo no instalado' },
  insecure_context: { icon: <Lock size={16} />, color: 'var(--error)', title: 'Contexto no seguro (HTTPS requerido)' },
  unsupported_browser: { icon: <Globe size={16} />, color: 'var(--error)', title: 'Navegador no compatible' },
  ready: { icon: <CheckCircle size={16} />, color: 'var(--success)', title: 'Ollama listo' },
  unknown_error: { icon: <AlertCircle size={16} />, color: 'var(--error)', title: 'Error desconocido' },
};

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

  const getInstructions = useCallback(() => {
    switch (currentOS) {
      case 'windows': return INSTRUCTIONS_WINDOWS;
      case 'macos': return INSTRUCTIONS_MACOS;
      case 'linux': return INSTRUCTIONS_LINUX;
      default: return INSTRUCTIONS_MACOS;
    }
  }, [currentOS]);

  const handleScanModels = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const ep = normalizeEndpoint(endpoint);
      const models = await fetchOllamaModels(ep);
      setInstalledModels(models);
      if (models.length === 0) {
        setScanError('No se encontraron modelos instalados. Descarga uno para continuar.');
      }
    } catch (e: any) {
      setScanError(e.message || 'Error al escanear modelos');
    } finally {
      setIsScanning(false);
    }
  }, [endpoint]);

  const handleDiagnose = useCallback(async () => {
    setIsChecking(true);
    setErrorDetail(null);
    try {
      const result = await diagnoseOllamaLocal(endpoint, selectedModel || undefined);
      setDiagnostic(result);
      if (result.status === 'ready') {
        onReady?.(result);
      }
    } catch (e: any) {
      setErrorDetail(e.message || 'Error desconocido');
    } finally {
      setIsChecking(false);
    }
  }, [endpoint, selectedModel, onReady]);

  const totalSteps = 5;

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

      <div className="ollama-wizard-steps">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`ollama-wizard-step-dot ${i === step ? 'ollama-wizard-step-dot--active' : ''} ${i < step ? 'ollama-wizard-step-dot--done' : ''}`}
          />
        ))}
      </div>

      {/* Step 0: Privacy & Architecture */}
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
            <button className="btn-p" onClick={() => setStep(1)}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 1: OS Detection */}
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
            <strong>Navegador: {platform.browser === 'chrome' ? 'Chrome (recomendado)' :
              platform.browser === 'edge' ? 'Edge (compatible)' :
              platform.browser === 'firefox' ? 'Firefox (puede requerir ajustes)' :
              platform.browser === 'safari' ? 'Safari (no compatible con loopback)' : 'Otro'}</strong>
          </div>
          {platform.browser !== 'chrome' && platform.browser !== 'edge' && (
            <p className="ollama-wizard-warning">
              Chrome o Edge son recomendados para la conexión con Ollama local.
            </p>
          )}
          <div className="ollama-wizard-actions">
            <button className="btn-s btn-sm" onClick={() => setStep(0)}>Atrás</button>
            <button className="btn-p" onClick={() => setStep(2)}>Continuar</button>
          </div>
        </div>
      )}

      {/* Step 2: OLLAMA_ORIGINS Instructions */}
      {step === 2 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Wrench size={14} />
            <strong>Configurar OLLAMA_ORIGINS — {osLabel}</strong>
          </div>
          <div className="ollama-wizard-origin-box">
            <code>OLLAMA_ORIGINS="{ORIGIN}"</code>
          </div>
          <div className="ollama-wizard-instructions">
            {getInstructions().map((line, i) => (
              <p key={i} className={line.startsWith('O') || line.startsWith('sudo') || line.startsWith('setx') || line.startsWith('launchctl') || line.startsWith('[') || line.startsWith('Environment') ? 'ollama-wizard-instruction-cmd' : 'ollama-wizard-instruction-step'}>
                {line || '\u00A0'}
              </p>
            ))}
          </div>
          {currentOS === 'windows' && (
            <div className="ollama-wizard-subsection">
              <strong>PowerShell:</strong>
              <div className="ollama-wizard-code-block">
                <code>{PS_WINDOWS}</code>
              </div>
            </div>
          )}
          <p className="ollama-wizard-note">
            El cambio aplica a procesos nuevos. Cierra Ollama completamente y ábrelo otra vez.
          </p>
          <div className="ollama-wizard-actions">
            <button className="btn-s btn-sm" onClick={() => setStep(1)}>Atrás</button>
            <button className="btn-p" onClick={() => setStep(3)}>Ya configuré OLLAMA_ORIGINS</button>
          </div>
        </div>
      )}

      {/* Step 3: Model Selection */}
      {step === 3 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Zap size={14} />
            <strong>Seleccionar modelo</strong>
          </div>
          <p className="ollama-wizard-text">
            Escanea los modelos instalados en Ollama o descarga uno nuevo.
            {selectedModel && (
              <span style={{ display: 'block', marginTop: '8px', color: 'var(--success)', fontWeight: 600 }}>
                Modelo seleccionado: {selectedModel}
              </span>
            )}
          </p>

          {installedModels.length === 0 && !scanError && !isScanning && (
            <div className="ollama-wizard-connect-area">
              <button
                className="btn-p"
                onClick={handleScanModels}
                disabled={isScanning}
                data-testid="ollama-scan-btn"
              >
                {isScanning ? (
                  <><Activity size={16} className="spinning" /> Escaneando...</>
                ) : (
                  <><Activity size={16} /> Escanear modelos instalados</>
                )}
              </button>
            </div>
          )}

          {isScanning && (
            <div className="ollama-wizard-diagnostic ollama-wizard-diagnostic--warning" style={{ marginTop: '12px' }}>
              <div className="ollama-wizard-diagnostic-header">
                <Activity size={16} className="spinning" />
                <span>Escaneando modelos en Ollama...</span>
              </div>
            </div>
          )}

          {scanError && installedModels.length === 0 && (
            <div className="ollama-wizard-diagnostic ollama-wizard-diagnostic--warning" style={{ marginTop: '12px' }}>
              <div className="ollama-wizard-diagnostic-header">
                <AlertCircle size={16} style={{ color: 'var(--orange)' }} />
                <span>{scanError}</span>
              </div>
            </div>
          )}

          {installedModels.length > 0 && (
            <div className="ollama-wizard-model-list" style={{ marginTop: '12px' }}>
              <span className="ollama-wizard-model-label">Modelos instalados:</span>
              {installedModels.map(m => {
                const isHeavy = isModelHeavy(m.size);
                const sizeGB = (m.size / (1024 * 1024 * 1024)).toFixed(1);
                const isSelected = selectedModel === m.name;
                return (
                  <div
                    key={m.name}
                    className={`ollama-wizard-model-chip ${isSelected ? 'ollama-wizard-model-chip--selected' : ''}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', marginBottom: '8px',
                      border: isSelected ? '2px solid var(--success)' : '1px solid var(--border)',
                      borderRadius: '6px', cursor: 'pointer',
                      background: isSelected ? 'var(--surface-success, #f0faf0)' : 'var(--surface1)',
                    }}
                    onClick={() => setSelectedModel(m.name)}
                    data-testid={`ollama-model-${m.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                        {sizeGB} GB{isHeavy && ' · Modelo pesado'}
                      </div>
                    </div>
                    {isHeavy && (
                      <span
                        style={{ fontSize: '10px', color: 'var(--orange)', fontWeight: 600, whiteSpace: 'nowrap', padding: '2px 6px', borderRadius: '4px', background: 'var(--warning-bg, #fff3cd)' }}
                        title="Este modelo pesa más de 10 GB. Puede consumir mucha memoria RAM/VRAM."
                      >
                        {'>'}10 GB
                      </span>
                    )}
                    {isSelected && (
                      <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {installedModels.length > 0 && !selectedModel && (
            <p className="ollama-wizard-note" style={{ marginTop: '8px' }}>
              Selecciona un modelo de la lista para usarlo en el diagnóstico.
            </p>
          )}

          <div className="ollama-wizard-section-header" style={{ marginTop: 'var(--space-md)' }}>
            <Download size={14} />
            <strong>Descargar modelo recomendado</strong>
          </div>
          <p className="ollama-wizard-text">
            AURA funciona mejor con modelos de ~3B parámetros para diagnóstico local rápido.
          </p>
          <div className="ollama-wizard-code-block" style={{ marginBottom: '8px' }}>
            <code>ollama pull qwen2.5:3b</code>
          </div>
          <p className="ollama-wizard-text" style={{ fontSize: '12px', color: 'var(--ink3)' }}>
            Alternativa más ligera:
          </p>
          <div className="ollama-wizard-code-block">
            <code>ollama pull gemma2:2b</code>
          </div>
          <p className="ollama-wizard-note">
            Después de descargar, pulsa "Escanear modelos instalados" para detectarlo.
          </p>
          <div className="ollama-wizard-actions">
            <button className="btn-s btn-sm" onClick={() => setStep(2)}>Atrás</button>
            <button
              className="btn-p"
              onClick={() => setStep(4)}
              disabled={!selectedModel}
              title={!selectedModel ? 'Selecciona un modelo instalado primero' : undefined}
              data-testid="ollama-step3-continue"
            >
              {selectedModel ? `Usar ${selectedModel}` : 'Selecciona un modelo'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Connect & Diagnose */}
      {step === 4 && (
        <div className="ollama-wizard-section">
          <div className="ollama-wizard-section-header">
            <Activity size={14} />
            <strong>Verificar conexión</strong>
          </div>
          <p className="ollama-wizard-text">
            Al pulsar "Conectar", el navegador puede pedir permiso para acceder a la red local.
          </p>

          {!diagnostic && (
            <div className="ollama-wizard-connect-area">
              <button
                className="btn-p btn-lg"
                onClick={handleDiagnose}
                disabled={isChecking}
                data-testid="ollama-connect-btn"
              >
                {isChecking ? (
                  <><Activity size={16} className="spinning" /> Verificando...</>
                ) : (
                  <><Zap size={16} /> Solicitar permiso y conectar</>
                )}
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
                  {diagnostic.details.selectedModelSize != null && isModelHeavy(diagnostic.details.selectedModelSize) && (
                    <span
                      style={{ fontSize: '11px', color: 'var(--orange)', marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', background: 'var(--warning-bg, #fff3cd)' }}
                      title="Modelo pesado: puede consumir mucha memoria RAM/VRAM"
                    >
                      {'>'}10 GB — modelo pesado
                    </span>
                  )}
                </div>
              )}

              {diagnostic.details.modelsInstalled.length > 0 && (
                <div className="ollama-wizard-model-list">
                  <span className="ollama-wizard-model-label">Modelos instalados:</span>
                  {diagnostic.details.modelsInstalled.map(m => (
                    <code key={m} className="ollama-wizard-model-chip">{m}</code>
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
                    {diagnostic.recommendedActions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="ollama-wizard-actions">
                {diagnostic.status !== 'ready' && (
                  <button className="btn-s" onClick={handleDiagnose} disabled={isChecking}>
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
          <button className="btn-s btn-sm" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

export default OllamaSetupWizard;
