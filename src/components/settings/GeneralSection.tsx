import React from 'react';

interface GeneralSectionProps {
  theme: 'dark' | 'light';
}

const GeneralSection: React.FC<GeneralSectionProps> = ({ theme }) => {
  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / General</p>
        <h1 className="settings-section-h1">General</h1>
        <p className="settings-section-lead">Ajusta la apariencia y las preferencias generales de AURA.</p>
      </header>

      <section className="settings-workspace-section">
        <h2 className="settings-section-title">Apariencia</h2>
        <p className="settings-section-desc">
          Tema actual: <strong>{theme === 'dark' ? 'oscuro' : 'claro'}</strong>. El interruptor está en la barra de navegación superior, junto a Ayuda.
        </p>
      </section>
    </>
  );
};

export default GeneralSection;
