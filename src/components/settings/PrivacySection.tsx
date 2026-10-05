import React from 'react';
import type { ProviderChoice } from './ProvidersSection';
import { describeEndpointHost, isLocalLoopback } from '../../services/loopback';

interface PrivacySectionProps {
  activeProviderType: ProviderChoice;
  /** Configured Ollama endpoint; when omitted the copy states the rule only. */
  ollamaBaseUrl?: string;
}

const PROVIDER_PRIVACY_COPY: Record<ProviderChoice, { label: string; note: string }> = {
  chrome: {
    label: 'Chrome AI',
    note: 'Gemini Nano se ejecuta dentro del navegador. Ningún dato sale del dispositivo.',
  },
  ollama: {
    label: 'Ollama local',
    note: 'La inferencia ocurre en este equipo a través del servidor local de Ollama. AURA solo se conecta a localhost, 127.0.0.1 o ::1 y rechaza cualquier otra dirección antes de enviar nada, así que ningún dato sale del dispositivo.',
  },
};

const PrivacySection: React.FC<PrivacySectionProps> = ({ activeProviderType, ollamaBaseUrl }) => {
  const active = PROVIDER_PRIVACY_COPY[activeProviderType];
  const ollamaEndpointBlocked = activeProviderType === 'ollama'
    && typeof ollamaBaseUrl === 'string'
    && ollamaBaseUrl.trim().length > 0
    && !isLocalLoopback(ollamaBaseUrl);

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / Privacidad y datos</p>
        <h1 className="settings-section-h1">Privacidad y datos</h1>
        <p className="settings-section-lead">Qué procesa AURA en este equipo y qué podría salir de él.</p>
      </header>

      <section className="settings-workspace-section" data-testid="privacy-current">
        <h2 className="settings-section-title">Privacidad actual</h2>
        {ollamaEndpointBlocked ? (
          <p className="settings-resolution-status" data-testid="privacy-ollama-blocked">
            <strong>{active.label} · bloqueado.</strong> El endpoint configurado («{describeEndpointHost(ollamaBaseUrl!)}») no es de este equipo. AURA no envía datos ahí: el diagnóstico no se ejecuta hasta que el endpoint sea localhost, 127.0.0.1 o ::1.
          </p>
        ) : (
          <p className="settings-resolution-status">
            <strong>{active.label} · 100 % local.</strong> {active.note}
          </p>
        )}
      </section>

      <section className="settings-workspace-section">
        <h2 className="settings-section-title">Qué sale y qué se queda en tu navegador</h2>
        <dl className="settings-meta-list">
          <dt>Archivo CSV</dt>
          <dd>Se procesa en el navegador. AURA no lo sube a ningún servicio.</dd>
          <dt>Chrome AI</dt>
          <dd>{PROVIDER_PRIVACY_COPY.chrome.note}</dd>
          <dt>Ollama local</dt>
          <dd>{PROVIDER_PRIVACY_COPY.ollama.note}</dd>
          <dt>Proveedores cloud</dt>
          <dd>Implementación futura. Esta versión no envía evidencia a servicios externos ni pide API keys.</dd>
          <dt>Exportación</dt>
          <dd>Tú decides qué exportar. Nada se exporta sin tu acción explícita.</dd>
        </dl>
      </section>
    </>
  );
};

export default PrivacySection;
