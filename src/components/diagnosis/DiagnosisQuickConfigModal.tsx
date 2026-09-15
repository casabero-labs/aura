import React, { useEffect, useRef, useState } from 'react';
import type { InputMode } from '../../types';
import UtilityDrawer from '../UtilityDrawer';

export interface DiagnosisQuickConfigModel {
  id: string;
  name: string;
  disabled?: boolean;
}

interface DiagnosisQuickConfigModalProps {
  model: string;
  inputMode: InputMode;
  models: readonly DiagnosisQuickConfigModel[];
  onClose: () => void;
  onSave: (selection: { model: string; inputMode: InputMode }) => void;
}

export const DIAGNOSIS_INPUT_MODE_OPTIONS: ReadonlyArray<{
  value: Extract<InputMode, 'prompt_libre' | 'smart_sample' | 'recommended'>;
  label: string;
  description: string;
}> = [
  {
    value: 'prompt_libre',
    label: 'Contexto mínimo',
    description: 'Resumen, esquema y registro mínimo. Sin muestras observadas.',
  },
  {
    value: 'smart_sample',
    label: 'Evidencia equilibrada',
    description: 'Añade estadísticas, reglas activadas y muestras limitadas.',
  },
  {
    value: 'recommended',
    label: 'Evidencia completa',
    description: 'Añade políticas, manifiestos y anclajes exactos.',
  },
] as const;

export const normalizeDiagnosisInputMode = (
  inputMode: InputMode | undefined,
): Extract<InputMode, 'prompt_libre' | 'smart_sample' | 'recommended'> => {
  if (inputMode === 'prompt_libre' || inputMode === 'recommended') return inputMode;
  return 'smart_sample';
};

export const diagnosisInputModeLabel = (inputMode: InputMode | undefined): string =>
  DIAGNOSIS_INPUT_MODE_OPTIONS.find((option) => option.value === normalizeDiagnosisInputMode(inputMode))?.label
  ?? 'Evidencia equilibrada';

export const DiagnosisQuickConfigModal: React.FC<DiagnosisQuickConfigModalProps> = ({
  model,
  inputMode,
  models,
  onClose,
  onSave,
}) => {
  const [draftModel, setDraftModel] = useState(model);
  const [draftInputMode, setDraftInputMode] = useState(normalizeDiagnosisInputMode(inputMode));
  const dialogRef = useRef<HTMLFormElement>(null);
  const modelSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    modelSelectRef.current?.focus();
  }, []);

  return (
    <UtilityDrawer title="Modelo y evidencia" onClose={onClose}>
      <form
        ref={dialogRef}
        className="diagnosis-quick-config-modal"
        data-testid="diagnosis-quick-config-modal"
        aria-labelledby="diagnosis-quick-config-title"
        aria-describedby="diagnosis-quick-config-description"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ model: draftModel, inputMode: draftInputMode });
        }}
      >
        <div className="diagnosis-quick-config-header">
          <div>
            <p className="diagnosis-quick-config-eyebrow">Configuración del diagnóstico</p>
            <h2 id="diagnosis-quick-config-title">Modelo y evidencia</h2>
          </div>
        </div>

        <div className="diagnosis-quick-config-body">
          <p id="diagnosis-quick-config-description" className="diagnosis-quick-config-description">
            Estos dos valores se aplicarán al siguiente diagnóstico. El perfil determinista no cambia.
          </p>

          <div className="input-group">
            <label className="input-group__label" htmlFor="diagnosis-quick-model">Modelo activo</label>
            <select
              id="diagnosis-quick-model"
              ref={modelSelectRef}
              value={draftModel}
              onChange={(event) => setDraftModel(event.target.value)}
              data-testid="diagnosis-quick-model"
            >
              {models.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={entry.disabled}>{entry.name}</option>
              ))}
            </select>
          </div>

          <fieldset className="diagnosis-quick-mode-fieldset">
            <legend>Método de entrada</legend>
            {DIAGNOSIS_INPUT_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`diagnosis-quick-mode-option ${draftInputMode === option.value ? 'diagnosis-quick-mode-option--active' : ''}`}
              >
                <input
                  type="radio"
                  name="diagnosis-input-mode"
                  value={option.value}
                  checked={draftInputMode === option.value}
                  onChange={() => setDraftInputMode(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="diagnosis-quick-config-footer">
          <button type="button" className="btn-s" onClick={onClose}>Cancelar</button>
          <button
            type="submit"
            className="btn-p"
            disabled={!models.some((entry) => entry.id === draftModel && !entry.disabled)}
          >
            Aplicar configuración
          </button>
        </div>
      </form>
    </UtilityDrawer>
  );
};

export default DiagnosisQuickConfigModal;
