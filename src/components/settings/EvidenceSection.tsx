import React, { useState } from 'react';
import { CheckCircle, Info } from 'lucide-react';
import type { InputMode } from '../../types';

interface InputModeOption {
  value: InputMode;
  label: string;
  summary: string;
  feature: string;
  whenToUse: string;
  includes: string;
  advantage: string;
  limitation: string;
  recommended?: boolean;
}

export const INPUT_MODE_OPTIONS: InputModeOption[] = [
  {
    value: 'prompt_libre',
    label: 'Contexto mínimo',
    summary: 'Resumen físico, esquema y registro mínimo de reglas activadas.',
    feature: 'Sin muestras observadas.',
    whenToUse: 'Pruebas rápidas, baseline experimental o comprobación básica.',
    includes: 'Resumen físico, esquema y registro mínimo de hallazgos y reglas.',
    advantage: 'Menor consumo de contexto y respuesta más rápida.',
    limitation: 'Menos contexto: mayor riesgo de respuestas genéricas y menor trazabilidad.',
  },
  {
    value: 'smart_sample',
    label: 'Evidencia equilibrada',
    summary: 'Resumen, esquema, estadísticas, reglas activadas y muestras limitadas.',
    feature: 'Recomendado para la mayoría de datasets.',
    whenToUse: 'Diagnóstico normal de la mayoría de datasets.',
    includes: 'Resumen, esquema, estadísticas, reglas activadas y muestras limitadas.',
    advantage: 'Mejor equilibrio entre contexto, claridad, latencia y privacidad.',
    limitation: 'No incorpora todos los manifiestos y controles avanzados.',
    recommended: true,
  },
  {
    value: 'recommended',
    label: 'Evidencia completa',
    summary: 'Registro completo, políticas, manifiestos y anclajes exactos a muestras.',
    feature: 'Máxima trazabilidad y contexto.',
    whenToUse: 'Datasets complejos, informe final, revisión técnica detallada o máxima trazabilidad.',
    includes: 'Registro completo, políticas de acción, autorizaciones, manifiestos y anclajes exactos a muestras.',
    advantage: 'Máxima trazabilidad y contexto.',
    limitation: 'Usa más tokens/contexto y puede tardar más.',
  },
];

const LEGACY_INPUT_MODES: ReadonlySet<InputMode> = new Set<InputMode>([
  'enhanced_registry',
  'copy_paste_bad_samples',
]);

export const migrateLegacyInputMode = (mode: InputMode | undefined): InputMode => {
  if (mode && LEGACY_INPUT_MODES.has(mode)) return 'recommended';
  if (mode === 'prompt_libre' || mode === 'smart_sample' || mode === 'recommended') return mode;
  return 'smart_sample';
};

interface EvidenceSectionProps {
  inputMode: InputMode | undefined;
  onChange: (mode: InputMode) => void;
}

const EvidenceSection: React.FC<EvidenceSectionProps> = ({ inputMode, onChange }) => {
  const [expanded, setExpanded] = useState<InputMode | null>(null);
  const activeInputMode = migrateLegacyInputMode(inputMode);
  const activeOption = INPUT_MODE_OPTIONS.find(option => option.value === activeInputMode) || INPUT_MODE_OPTIONS[1];

  return (
    <>
      <header className="settings-section-header">
        <p className="settings-section-breadcrumb">Configuración / Evidencia</p>
        <h1 className="settings-section-h1">Evidencia</h1>
        <p className="settings-section-lead">Define cuánta información técnica recibe el modelo durante el diagnóstico.</p>
      </header>

      <section className="settings-workspace-section" data-testid="evidence-modes-section">
        <p className="settings-section-desc">
          No estás eligiendo el modelo, sino cuánta evidencia técnica recibe durante el diagnóstico.
          El CSV original no cambia y el motor determinista es el mismo en los tres casos.
        </p>
        <div className="settings-evidence-list" role="radiogroup" aria-label="Cantidad de evidencia que recibe el modelo">
          {INPUT_MODE_OPTIONS.map(option => {
            const isActive = activeInputMode === option.value;
            const isExpanded = expanded === option.value;
            return (
              <div key={option.value} className={`settings-evidence-option ${isActive ? 'settings-evidence-option--active' : ''}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onChange(option.value)}
                  className="settings-evidence-option-main"
                  data-testid={`evidence-mode-${option.value}`}
                >
                  <span className="settings-evidence-option-mark" aria-hidden="true">
                    {isActive ? <CheckCircle size={16} /> : <span className="settings-evidence-option-dot" />}
                  </span>
                  <span className="settings-evidence-option-body">
                    <span className="settings-evidence-option-head">
                      <strong>{option.label}</strong>
                      {option.recommended && (
                        <span className="settings-evidence-option-badge" data-testid={`evidence-mode-badge-${option.value}`}>
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="settings-evidence-option-summary">{option.summary}</span>
                    <span className="settings-evidence-option-feature">{option.feature}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="settings-evidence-option-toggle"
                  onClick={() => setExpanded(isExpanded ? null : option.value)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                </button>
                {isExpanded && (
                  <ul className="settings-evidence-option-details">
                    <li><strong>Cuándo:</strong> {option.whenToUse}</li>
                    <li><strong>Incluye:</strong> {option.includes}</li>
                    <li><strong>Ventaja:</strong> {option.advantage}</li>
                    <li><strong>Limitación:</strong> {option.limitation}</li>
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <p className="settings-input-mode-desc" data-testid="evidence-mode-active-desc">
          <Info size={13} /> <strong>{activeOption.label}.</strong> {activeOption.summary}
        </p>
      </section>
    </>
  );
};

export default EvidenceSection;
