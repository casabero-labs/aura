import React, { useState } from 'react';
import { FileJson, Lock, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { AIConfig, InputMode } from '../../types';
import { buildSmartSample, buildAnalysisPrompt } from '../../services/providers/prompts';
import { computePromptHash } from '../../services/llmAuditLog';

interface DiagnosisContractPanelProps {
  report: any;
  aiConfig: AIConfig;
  onInputModeChange: (mode: InputMode) => void;
}

const INPUT_MODES: { value: InputMode; label: string; badge?: string }[] = [
  { value: 'smart_sample', label: 'Smart', badge: '✓ Recomendado' },
  { value: 'prompt_libre', label: 'Libre', badge: 'Experimental' },
  { value: 'enhanced_registry', label: 'Extendido' },
  { value: 'copy_paste_bad_samples', label: 'Copy-Paste' },
  { value: 'recommended', label: 'Completo' },
];

const TRAFFIC_LIGHT_CONFIG = [
  { key: 'privacy', label: 'Privacidad' },
  { key: 'traceability', label: 'Trazabilidad' },
  { key: 'hallucinationRisk', label: 'Alucinación' },
  { key: 'latency', label: 'Latencia' },
  { key: 'cost', label: 'Costo' },
  { key: 'reproducibility', label: 'Reproducibilidad' },
];

export const DiagnosisContractPanel: React.FC<DiagnosisContractPanelProps> = ({
  report,
  aiConfig,
  onInputModeChange,
}) => {
  const [showFull, setShowFull] = useState(false);

  const aiInputMode: InputMode = aiConfig.inputMode || 'smart_sample';
  const isCloud = aiConfig.providerType === 'cloud';

  const getTrafficLightLevel = (key: string): 'green' | 'yellow' | 'red' => {
    if (aiConfig.providerType === 'chrome' || aiConfig.providerType === 'ollama') {
      if (key === 'privacy') return 'green';
      if (key === 'cost') return 'green';
      if (key === 'reproducibility') return 'green';
      if (key === 'hallucinationRisk' && aiInputMode === 'smart_sample') return 'green';
      if (key === 'hallucinationRisk' && aiInputMode === 'prompt_libre') return 'red';
      if (key === 'traceability' && aiInputMode !== 'prompt_libre') return 'green';
      if (key === 'latency') return 'green';
    }
    if (isCloud) {
      if (key === 'privacy') return 'yellow';
      if (key === 'cost') return 'red';
      if (key === 'latency') return 'yellow';
    }
    if (aiInputMode === 'prompt_libre') {
      if (key === 'hallucinationRisk') return 'red';
      if (key === 'traceability') return 'red';
      if (key === 'reproducibility') return 'red';
    }
    return 'yellow';
  };

  return (
    <div className="diagnosis-contract-panel">
      <div className="diagnosis-contract-intro">
        <FileJson size={14} />
        <span>El modelo recibe un expediente, no el archivo completo.</span>
      </div>

      <div className="diagnosis-three-column-grid">
        <div className="diagnosis-contract-col">
          <h4>Qué recibe</h4>
          <ul>
            <li>Columnas con tipos inferidos</li>
            <li>Estadísticas (nulos, únicos)</li>
            <li>Hallazgos del perfil</li>
            <li>Muestras de problemas</li>
          </ul>
        </div>

        <div className="diagnosis-contract-col">
          <h4>Qué NO recibe</h4>
          <ul>
            <li>Dataset completo</li>
            <li>Archivo original</li>
            <li>Filas fuera del paquete</li>
            <li>Rutas o nombres de archivo</li>
          </ul>
        </div>

        <div className="diagnosis-contract-col">
          <h4>Qué produce</h4>
          <ul>
            <li>Causas probables</li>
            <li>Prioridades de corrección</li>
            <li>Recomendaciones accionables</li>
            <li>Diagnóstico textual</li>
          </ul>
        </div>
      </div>

      {isCloud && (
        <div className="diagnosis-contract-warning">
          <AlertTriangle size={12} />
          <span>Modo Cloud activo: el paquete se envía al proveedor externo.</span>
        </div>
      )}

      <div className="diagnosis-contract-chips">
        {TRAFFIC_LIGHT_CONFIG.map((item) => {
          const level = getTrafficLightLevel(item.key);
          return (
            <span
              key={item.key}
              className={`diagnosis-contract-chip diagnosis-contract-chip--${level}`}
            >
              {level === 'green' && <CheckCircle size={10} />}
              {level === 'yellow' && <AlertTriangle size={10} />}
              {level === 'red' && <AlertTriangle size={10} />}
              {item.label}
            </span>
          );
        })}
      </div>

      <div className="diagnosis-input-mode-selector">
        <span className="diagnosis-input-mode-label">Modo de entrada:</span>
        <div className="segmented-control segmented-control--small">
          {INPUT_MODES.map((mode) => (
            <button
              key={mode.value}
              className={`segmented-control-btn ${aiInputMode === mode.value ? 'active' : ''}`}
              onClick={() => onInputModeChange(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-s diagnosis-contract-expand-btn"
        onClick={() => setShowFull(!showFull)}
      >
        {showFull ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {showFull ? 'Ocultar' : 'Ver'} explicación completa
      </button>

      {showFull && (
        <div className="diagnosis-contract-expanded">
          <p><strong>Proveedor:</strong> {aiConfig.providerType === 'chrome' ? 'Chrome AI (Gemini Nano)' : aiConfig.providerType === 'ollama' ? 'Ollama local' : 'Cloud'}</p>
          <p><strong>Modo:</strong> {aiInputMode}</p>
          <p><strong>Objetivo:</strong> Diagnosticar causas probables y producir una salida lista para generar un script Python/Pandas de limpieza.</p>
          <p className="diagnosis-contract-note">
            El modelo interpreta la evidencia estructurada. No reemplaza al motor determinista de reglas.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiagnosisContractPanel;
