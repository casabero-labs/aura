import React from 'react';
import { Cloud, Server, Shield } from 'lucide-react';

type ProviderChoice = 'chrome' | 'ollama' | 'cloud';

interface PrivacySectionProps {
  activeProviderType: ProviderChoice;
  apiKeyPresent: boolean;
}

const PROVIDER_PRIVACY_COPY: Record<ProviderChoice, { label: string; Icon: typeof Shield; note: string }> = {
  chrome: {
    label: 'Chrome AI',
    Icon: Shield,
    note: 'Ningún dato sale del dispositivo mientras este modo esté activo.',
  },
  ollama: {
    label: 'Ollama local',
    Icon: Server,
    note: 'La inferencia ocurre en tu máquina vía servidor local. Ningún dato sale del dispositivo.',
  },
  cloud: {
    label: 'Cloud',
    Icon: Cloud,
    note: 'Se envía un paquete estructurado (columnas, estadísticas, hallazgos) al proveedor. No se envía el archivo CSV completo.',
  },
};

const PrivacySection: React.FC<PrivacySectionProps> = ({ activeProviderType, apiKeyPresent }) => {
  const active = PROVIDER_PRIVACY_COPY[activeProviderType];
  const ActiveIcon = active.Icon;

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / Privacidad y datos</p>
        <h1 className="settings-section-h1">Privacidad y datos</h1>
        <p className="settings-section-lead">Controla cómo AURA procesa, almacena y transmite la información.</p>
      </header>

      <section className="settings-workspace-section">
        <p className="settings-section-desc">Privacidad actual</p>
        <div className="settings-active-provider-card">
          <div>
            <div className="settings-active-provider-title">
              <span className="settings-active-provider-icon"><ActiveIcon size={18} /></span>
              <div>
                <strong>{active.label}</strong>
                <span className="settings-active-provider-status">
                  {activeProviderType === 'cloud' ? 'Puede salir del dispositivo' : '100 % local'}
                </span>
              </div>
            </div>
            <p>{active.note}</p>
          </div>
        </div>
      </section>

      <section className="settings-workspace-section">
        <h2 className="settings-section-title">Qué sale y qué se queda en tu navegador</h2>
        <ul className="settings-privacy-list">
          <li><strong>Chrome AI:</strong> Gemini Nano se ejecuta en el navegador. Ningún dato sale de tu dispositivo mientras este modo esté activo.</li>
          <li><strong>Ollama local:</strong> La inferencia ocurre en tu máquina vía servidor local.</li>
          <li><strong>Cloud:</strong> Se envía un paquete estructurado al proveedor. No se envía el archivo CSV completo.</li>
          <li><strong>API keys:</strong> Permanecen solo en esta sesión del navegador ({apiKeyPresent ? 'clave presente' : 'sin clave guardada'}); no se guardan en almacenamiento persistente, sync ni exportaciones.</li>
          <li><strong>Exportación:</strong> Tú decides qué exportar. Nada se exporta sin tu acción explícita.</li>
        </ul>
      </section>
    </>
  );
};

export default PrivacySection;
