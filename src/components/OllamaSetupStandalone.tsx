import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Server } from 'lucide-react';
import OllamaSetupWizard from './OllamaSetupWizard';
import type { OllamaLocalDiagnostic } from '../services/ollamaLocalBridge';

const safeReturnPath = (raw: string | null): string => {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
};

const OllamaSetupStandalone: React.FC = () => {
  const [readyMessage, setReadyMessage] = useState('');
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const returnPath = safeReturnPath(params.get('return'));
  const endpoint = localStorage.getItem('aura_ollama_endpoint') || 'http://127.0.0.1:11434';

  useEffect(() => {
    document.documentElement.dataset.casaberoTheme = 'editorial';
    document.title = 'AURA · Configurar Ollama local';
  }, []);

  const closeAndReturn = () => {
    localStorage.setItem('aura_ollama_setup_completed', 'true');

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'aura:ollama-setup-closed' }, window.location.origin);
      window.opener.focus();
      window.close();
      return;
    }

    window.location.assign(returnPath);
  };

  const handleReady = (diagnostic: OllamaLocalDiagnostic) => {
    const selectedModel = diagnostic.details.selectedModel;
    localStorage.setItem('aura_ollama_endpoint', diagnostic.details.endpoint);
    localStorage.setItem('aura_ollama_last_ready', diagnostic.details.checkedAt);
    localStorage.setItem('aura_ollama_setup_completed', 'true');
    if (selectedModel) localStorage.setItem('aura_ollama_model', selectedModel);

    setReadyMessage(selectedModel
      ? `Conexión verificada. ${selectedModel} quedó seleccionado en AURA.`
      : 'Conexión verificada. Ollama quedó disponible para AURA.');

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'aura:ollama-ready',
        endpoint: diagnostic.details.endpoint,
        model: selectedModel || null,
      }, window.location.origin);
    }
  };

  return (
    <div className="sys-root aura-system" data-casabero-theme="editorial">
      <main className="settings-workspace" data-testid="ollama-standalone-view">
        <div className="settings-workspace-header">
          <button type="button" className="settings-back-btn" onClick={closeAndReturn}>
            <ArrowLeft size={14} /> Cerrar y volver a AURA
          </button>
          <div>
            <p className="sec-eye">configuración local</p>
            <h1 className="sec-title">Ollama local</h1>
            <p className="settings-workspace-subtitle">
              El mismo asistente de AURA, en una pestaña separada y conectado con tu configuración principal.
            </p>
          </div>
          <span className="settings-active-provider-meta standalone-provider-meta">
            <Server size={13} /> navegador → localhost
          </span>
        </div>

        <div className="settings-workspace-body standalone-settings-body">
          {readyMessage && (
            <div className="settings-status-card settings-status-card--ok" role="status" data-testid="ollama-ready-message">
              <CheckCircle size={16} className="settings-status-icon" />
              <div>
                <strong>Ollama está listo</strong>
                <p>{readyMessage}</p>
              </div>
            </div>
          )}

          <section className="settings-workspace-section">
            <OllamaSetupWizard
              endpoint={endpoint}
              onReady={handleReady}
              onCancel={closeAndReturn}
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default OllamaSetupStandalone;
