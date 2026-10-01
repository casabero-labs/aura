import React from 'react';
import type { ProviderChoice } from './ProvidersSection';
import { api } from '../../services/api';

interface PrivacySectionProps {
  activeProviderType: ProviderChoice;
}

const PROVIDER_PRIVACY_COPY: Record<ProviderChoice, { label: string; note: string }> = {
  chrome: {
    label: 'Chrome AI',
    note: 'Gemini Nano se ejecuta dentro del navegador. Ningún dato sale del dispositivo.',
  },
  ollama: {
    label: 'Ollama local',
    note: 'La inferencia ocurre en este equipo a través del servidor local de Ollama. Ningún dato sale del dispositivo.',
  },
};

const PrivacySection: React.FC<PrivacySectionProps> = ({ activeProviderType }) => {
  const active = PROVIDER_PRIVACY_COPY[activeProviderType];

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / Privacidad y datos</p>
        <h1 className="settings-section-h1">Privacidad y datos</h1>
        <p className="settings-section-lead">Qué procesa AURA en este equipo y qué podría salir de él.</p>
      </header>

      <section className="settings-workspace-section" data-testid="privacy-current">
        <h2 className="settings-section-title">Privacidad actual</h2>
        <p className="settings-resolution-status">
          <strong>{active.label} · 100 % local.</strong> {active.note}
        </p>
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
          {api.available() && (
            <>
              <dt>Preferencias</dt>
              <dd data-testid="privacy-config-sync">Se sincronizan con la API de AURA configurada en este despliegue: proveedor, modelo y parámetros. Nunca el CSV ni sus filas.</dd>
            </>
          )}
          <dt>Exportación</dt>
          <dd>Tú decides qué exportar. Nada se exporta sin tu acción explícita.</dd>
        </dl>
      </section>
    </>
  );
};

export default PrivacySection;
