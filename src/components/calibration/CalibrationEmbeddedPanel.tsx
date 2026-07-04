import React, { useMemo, useState } from 'react';
import { AIConfig, AuditReport, BenchmarkResult, InputMode } from '../../types';
import { runBenchmarkForConfig } from '../../services/benchmarkService';

type CalibrationInputMode = Extract<InputMode, 'smart_sample' | 'prompt_libre'>;

export interface CalibrationEmbeddedPanelProps {
  report: AuditReport;
  aiConfig: AIConfig;
  results: BenchmarkResult[];
  onResult: (result: BenchmarkResult) => void;
  onContinueStandardFlow: () => void;
  onClose: () => void;
  onLog?: (stage: string, message: string) => void;
}

const evidenceLabel: Record<BenchmarkResult['evidenceStatus'], string> = {
  planned: 'Planificada',
  attempted_failed: 'Intento no válido',
  preliminary_valid: 'Preliminar',
  formal_valid: 'Formal',
};

const statusLabel: Record<BenchmarkResult['status'], string> = {
  pending: 'Pendiente',
  running: 'Ejecutando',
  completed: 'Completada',
  error: 'Error',
  unavailable: 'No disponible',
};

const CalibrationEmbeddedPanel: React.FC<CalibrationEmbeddedPanelProps> = ({
  report,
  aiConfig,
  results,
  onResult,
  onContinueStandardFlow,
  onClose,
  onLog,
}) => {
  const initialInputMode: CalibrationInputMode =
    aiConfig.inputMode === 'prompt_libre' ? 'prompt_libre' : 'smart_sample';
  const [inputMode, setInputMode] = useState<CalibrationInputMode>(initialInputMode);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<BenchmarkResult | null>(null);
  const [unexpectedError, setUnexpectedError] = useState<string | null>(null);

  const visibleResult = useMemo(
    () => lastResult ?? results[0] ?? null,
    [lastResult, results],
  );

  const runComparison = async () => {
    setIsRunning(true);
    setUnexpectedError(null);
    onLog?.(
      'calibration.run.start',
      `${aiConfig.providerType} :: ${aiConfig.model} :: ${inputMode}`,
    );

    try {
      const result = await runBenchmarkForConfig(report, aiConfig, inputMode, (event) => {
        onLog?.(event.stage, `${aiConfig.providerType} :: ${inputMode}`);
      });
      setLastResult(result);
      onResult(result);
      onLog?.(
        result.status === 'completed' ? 'calibration.run.completed' : 'calibration.run.closed',
        `${result.providerType} :: ${result.evidenceStatus}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible completar la comparación.';
      setUnexpectedError(message);
      onLog?.('calibration.run.error', message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="section" data-testid="calibration-embedded-panel">
      <div className="section-header">
        <div>
          <p className="sec-eye">experimental · opt-in</p>
          <h2 className="sec-title">Calibración dentro del flujo</h2>
        </div>
      </div>

      <p className="section-note">
        Compara una configuración sobre el perfil actual sin abandonar el pipeline. El resultado es preliminar salvo
        que la evidencia tenga una clasificación formal explícita.
      </p>

      <div className="companion-note">
        <p>
          Esta comparación no corrige el dataset ni reemplaza la revisión humana. Puedes continuar al diagnóstico
          normal en cualquier momento.
        </p>
      </div>

      <div className="stage-actions" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className="btn-p btn-sm" onClick={onContinueStandardFlow}>
          Continuar diagnóstico normal
        </button>
        <button className="btn-s btn-sm" onClick={onClose} disabled={isRunning}>
          Cerrar calibración
        </button>
      </div>

      <div className="stage-decision-summary" aria-label="Configuración de calibración">
        <div className="stage-summary-item">
          <span className="stage-summary-label">Proveedor</span>
          <strong>{aiConfig.providerType}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Modelo</span>
          <strong>{aiConfig.model}</strong>
        </div>
        <label className="stage-summary-item" style={{ minWidth: 220 }}>
          <span className="stage-summary-label">Modo de entrada</span>
          <select
            className="benchmark-select"
            value={inputMode}
            disabled={isRunning}
            onChange={(event) => setInputMode(event.target.value as CalibrationInputMode)}
          >
            <option value="smart_sample">Muestra estructurada</option>
            <option value="prompt_libre">Prompt libre controlado</option>
          </select>
        </label>
      </div>

      <button className="btn-s btn-sm" onClick={runComparison} disabled={isRunning}>
        {isRunning ? 'Ejecutando comparación…' : 'Ejecutar comparación preliminar'}
      </button>

      <div aria-live="polite">
        {unexpectedError && (
          <div className="provider-unavailable-notice" role="alert">
            <div className="provider-unavailable-header">
              <strong>No fue posible completar la comparación</strong>
            </div>
            <p>{unexpectedError}</p>
          </div>
        )}

        {visibleResult && (
          <div className="stage-result" data-testid="calibration-result">
            <p className="stage-result-title">Último resultado guardado</p>
            <div className="stage-decision-summary">
              <div className="stage-summary-item">
                <span className="stage-summary-label">Estado</span>
                <strong>{statusLabel[visibleResult.status]}</strong>
              </div>
              <div className="stage-summary-item">
                <span className="stage-summary-label">Evidencia</span>
                <strong>{evidenceLabel[visibleResult.evidenceStatus]}</strong>
              </div>
              <div className="stage-summary-item">
                <span className="stage-summary-label">Candidato</span>
                <strong>{visibleResult.model}</strong>
              </div>
            </div>
            {visibleResult.error && <p className="section-note">{visibleResult.error}</p>}
            {results.length > 1 && (
              <p className="section-note">{results.length} resultados conservados en esta sesión.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default CalibrationEmbeddedPanel;
