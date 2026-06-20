import React, { useMemo, useState } from 'react';
import { FileJson, Lock, Unlock, AlertTriangle, CheckCircle, Clock, Zap, Eye, FileWarning, ChevronDown, ChevronRight, Copy, Hash } from 'lucide-react';
import { AIConfig, AuditReport, InputMode } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { computePromptHash } from '../services/llmAuditLog';

interface DiagnosisContractGuideProps {
  report: AuditReport;
  aiConfig: AIConfig;
  onInputModeChange?: (mode: InputMode) => void;
}

const INPUT_MODE_INFO: Record<InputMode, {
  label: string;
  description: string;
  recommendation: string;
  risks: string[];
}> = {
  smart_sample: {
    label: 'Smart Sample',
    description: 'Usa evidencia estructurada con anclaje semántico. Minimiza riesgo de alucinación.',
    recommendation: 'Recomendado',
    risks: ['Menor creatividad', 'Requiere reglas activadas'],
  },
  prompt_libre: {
    label: 'Prompt Libre',
    description: 'Exploración sin límites. Útil para pruebas. Mayor riesgo de inferencias no trazables.',
    recommendation: 'Experimental',
    risks: ['Mayor riesgo de alucinación', 'Respuestas no reproducibles', 'Sin evidencia estructurada'],
  },
  enhanced_registry: {
    label: 'Registro Extendido',
    description: 'Más contexto: columnas, tipos semánticos, estadísticas completas.',
    recommendation: 'Para casos complejos',
    risks: ['Más tokens', 'Mayor latencia'],
  },
  copy_paste_bad_samples: {
    label: 'Copy-Paste Bad Samples',
    description: 'Enfatiza valores problemáticos textuales. Modelo debe citarlos directamente.',
    recommendation: 'Para auditoría',
    risks: ['Menos contexto general', 'Requiere samples disponibles'],
  },
  recommended: {
    label: 'Recomendado',
    description: 'Modo completo con máximo contexto y evidencia. Combina registro + samples.',
    recommendation: 'Mejor calidad',
    risks: ['Mayor consumo de tokens', 'Mayor latencia'],
  },
};

const TRAFFIC_LIGHT_CONFIG = [
  { key: 'privacy', label: 'Privacidad', green: 'Datos permanecen localmente', yellow: 'Paquete enviado al proveedor', red: 'Dataset crudo en la nube' },
  { key: 'traceability', label: 'Trazabilidad', green: 'Reglas + columnas + samples', yellow: 'Solo columnas', red: 'Sin evidencia' },
  { key: 'hallucinationRisk', label: 'Riesgo de Alucinación', green: 'Bajo (anclado a evidencia)', yellow: 'Medio', red: 'Alto (libre)' },
  { key: 'latency', label: 'Latencia Esperada', green: '<2s local', yellow: '2-5s', red: '>5s o variable' },
  { key: 'cost', label: 'Costo Externo', green: 'Gratis (local)', yellow: 'Bajo', red: 'Alto (APIs cloud)' },
  { key: 'reproducibility', label: 'Reproducibilidad', green: 'Alta (determinista)', yellow: 'Media', red: 'Baja' },
];

const TRAFFIC_LIGHT_LEVELS = ['green', 'yellow', 'red'] as const;
type TrafficLightLevel = typeof TRAFFIC_LIGHT_LEVELS[number];

const TRAFFIC_LIGHT_COLORS: Record<TrafficLightLevel, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

export const DiagnosisContractGuide: React.FC<DiagnosisContractGuideProps> = ({
  report,
  aiConfig,
  onInputModeChange,
}) => {
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showWhatReceives, setShowWhatReceives] = useState(false);
  const [showWhatDoesNotReceive, setShowWhatDoesNotReceive] = useState(false);
  const [showWhatProduces, setShowWhatProduces] = useState(false);
  const [showUserControls, setShowUserControls] = useState(false);

  const smartSample = useMemo(() => buildSmartSample(report), [report]);
  const diagnosisPrompt = useMemo(
    () => buildAnalysisPrompt(report, aiConfig.promptContract, aiInputMode),
    [report, aiConfig.promptContract, aiInputMode]
  );
  const promptHash = useMemo(() => computePromptHash(diagnosisPrompt), [diagnosisPrompt]);

  const aiInputMode: InputMode = aiConfig.inputMode || 'smart_sample';
  const currentModeInfo = INPUT_MODE_INFO[aiInputMode];

  const inputSummary = useMemo(() => {
    const affectedColumns = new Set(report.issues.map((i) => i.column).filter(Boolean)).size;
    return {
      findings: report.issues.length,
      columns: Object.keys(report.columnStats).length,
      affectedColumns,
      sampleCount: report.issues.reduce((acc, i) => acc + i.sampleValues.length, 0),
    };
  }, [report]);

  const isCloudMode = aiConfig.providerType === 'cloud';

  const getTrafficLightLevel = (key: string): TrafficLightLevel => {
    if (aiConfig.providerType === 'chrome' || aiConfig.providerType === 'ollama' || aiConfig.providerType === 'webllm_experimental') {
      if (key === 'privacy') return 'green';
      if (key === 'cost') return 'green';
      if (key === 'hallucinationRisk' && aiInputMode === 'smart_sample') return 'green';
      if (key === 'hallucinationRisk' && aiInputMode === 'prompt_libre') return 'red';
      if (key === 'traceability' && aiInputMode !== 'prompt_libre') return 'green';
      if (key === 'reproducibility') return 'green';
      if (key === 'latency') return 'green';
    }
    if (isCloudMode) {
      if (key === 'privacy') return 'yellow';
      if (key === 'cost') return 'red';
      if (key === 'latency') return 'yellow';
    }
    if (aiInputMode === 'prompt_libre') {
      if (key === 'hallucinationRisk') return 'red';
      if (key === 'traceability') return 'red';
      if (key === 'reproducibility') return 'red';
    }
    if (aiInputMode === 'recommended' || aiInputMode === 'enhanced_registry') {
      if (key === 'latency') return 'yellow';
    }
    return 'yellow';
  };

  return (
    <div className="diagnosis-contract-guide" data-testid="diagnosis-contract-guide">
      <div className="contract-guide-header">
        <FileJson size={16} />
        <h3>Contrato de Diagnóstico</h3>
      </div>

      <p className="contract-guide-intro">
        AURA no le entrega el archivo completo al modelo. Le entrega un expediente compacto: columnas, reglas activadas, muestras y evidencias. El modelo interpreta, no reemplaza al motor determinista.
      </p>

      {isCloudMode && (
        <div className="contract-guide-cloud-warning">
          <AlertTriangle size={14} />
          <span>Modo Cloud activo: el paquete estructurado se envía al proveedor externo.</span>
        </div>
      )}

      <div className="contract-guide-sections">
        <details className="contract-guide-section" open={showWhatReceives} onToggle={() => setShowWhatReceives(!showWhatReceives)}>
          <summary className="contract-guide-section-summary">
            {showWhatReceives ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Qué recibe el modelo</span>
          </summary>
          {showWhatReceives && (
            <div className="contract-guide-section-content">
              <ul className="contract-list">
                <li><strong>Columnas:</strong> {inputSummary.columns} columnas con sus tipos inferidos y estadísticas</li>
                <li><strong>Estadísticas:</strong> nulos, únicos, valores top, IQR, ceros</li>
                <li><strong>Hallazgos:</strong> {inputSummary.findings} reglas activadas conseveridad y descripción</li>
                <li><strong>Muestras:</strong> {inputSummary.sampleCount} sample values de problemas detectados</li>
                <li><strong>Resumen del perfil:</strong> filas, columnas, score, delimitador</li>
              </ul>
            </div>
          )}
        </details>

        <details className="contract-guide-section" open={showWhatDoesNotReceive} onToggle={() => setShowWhatDoesNotReceive(!showWhatDoesNotReceive)}>
          <summary className="contract-guide-section-summary">
            {showWhatDoesNotReceive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Qué NO recibe el modelo</span>
          </summary>
          {showWhatDoesNotReceive && (
            <div className="contract-guide-section-content">
              <ul className="contract-list contract-list--negative">
                <li><FileWarning size={12} /> Dataset completo (archivo CSV/Parquet original)</li>
                <li><FileWarning size={12} /> Filas fuera del paquete estructurado</li>
                <li><FileWarning size={12} /> Datos fuera del perfil determinista</li>
                <li><FileWarning size={12} /> Rutas de archivo o nombres de archivo</li>
              </ul>
            </div>
          )}
        </details>

        <details className="contract-guide-section" open={showWhatProduces} onToggle={() => setShowWhatProduces(!showWhatProduces)}>
          <summary className="contract-guide-section-summary">
            {showWhatProduces ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Qué produce</span>
          </summary>
          {showWhatProduces && (
            <div className="contract-guide-section-content">
              <ul className="contract-list">
                <li><CheckCircle size={12} /> <strong>Causas probables:</strong> análisis de razones detrás de los hallazgos</li>
                <li><CheckCircle size={12} /> <strong>Prioridades:</strong> qué corregir primero según severidad</li>
                <li><CheckCircle size={12} /> <strong>Recomendaciones:</strong> acciones específicas y verificables</li>
                <li><CheckCircle size={12} /> <strong>Diagnóstico textual:</strong> explicación en español con evidencia</li>
                <li><CheckCircle size={12} /> <strong>Soporte para script:</strong> elementos para construir limpieza asistida</li>
              </ul>
            </div>
          )}
        </details>

        <details className="contract-guide-section" open={showUserControls} onToggle={() => setShowUserControls(!showUserControls)}>
          <summary className="contract-guide-section-summary">
            {showUserControls ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Qué контролирует el usuario</span>
          </summary>
          {showUserControls && (
            <div className="contract-guide-section-content">
              <ul className="contract-list">
                <li><strong>Proveedor:</strong> Chrome AI, Ollama, Cloud</li>
                <li><strong>Modo de entrada:</strong> tipo de evidencia enviada al modelo</li>
                <li><strong>Contrato de prompt:</strong> políticas de evidencia y objetivo</li>
                <li><strong>Nivel de evidencia:</strong> strict vs balanced</li>
                <li><strong>Exportación:</strong> PDF, JSON, script</li>
                <li><strong>Revisión humana:</strong> HITL en cada paso</li>
              </ul>
            </div>
          )}
        </details>
      </div>

      <div className="contract-guide-mode-selector">
        <h4>Modo de Entrada</h4>
        <div className="contract-guide-modes">
          {(Object.keys(INPUT_MODE_INFO) as InputMode[]).map((mode) => {
            const info = INPUT_MODE_INFO[mode];
            const isActive = aiInputMode === mode;
            return (
              <button
                key={mode}
                className={`contract-guide-mode-btn ${isActive ? 'active' : ''}`}
                onClick={() => onInputModeChange?.(mode)}
              >
                <span className="mode-label">{info.label}</span>
                {info.recommendation === 'Recomendado' && (
                  <span className="mode-badge mode-badge--recommended">✓ {info.recommendation}</span>
                )}
                {info.recommendation === 'Experimental' && (
                  <span className="mode-badge mode-badge--experimental">{info.recommendation}</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="contract-guide-mode-description">{currentModeInfo.description}</p>
        {currentModeInfo.risks.length > 0 && (
          <p className="contract-guide-mode-risks">
            <AlertTriangle size={12} /> {currentModeInfo.risks.join(' · ')}
          </p>
        )}
      </div>

      <div className="contract-guide-traffic-light">
        <h4>Semáforo de Configuración</h4>
        <div className="traffic-light-grid">
          {TRAFFIC_LIGHT_CONFIG.map((item) => {
            const level = getTrafficLightLevel(item.key);
            return (
              <div key={item.key} className="traffic-light-row">
                <span className="traffic-light-label">{item.label}</span>
                <div className="traffic-light-dots">
                  {TRAFFIC_LIGHT_LEVELS.map((l) => (
                    <span
                      key={l}
                      className={`traffic-light-dot ${l === level ? `traffic-light-dot--active traffic-light-dot--${l}` : ''}`}
                      style={l === level ? { backgroundColor: TRAFFIC_LIGHT_COLORS[l] } : undefined}
                    />
                  ))}
                </div>
                <span className="traffic-light-value" style={{ color: TRAFFIC_LIGHT_COLORS[level] }}>
                  {level === 'green' ? item.green : level === 'yellow' ? item.yellow : item.red}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="contract-guide-prompt-preview">
        <button
          className="contract-guide-prompt-toggle"
          onClick={() => setShowPromptPreview(!showPromptPreview)}
        >
          <FileJson size={12} />
          <span>Ver paquete que recibirá la IA</span>
          {showPromptPreview ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {showPromptPreview && (
          <div className="contract-guide-prompt-content">
            <div className="contract-guide-prompt-meta">
              <span className="prompt-meta-item">
                <Hash size={10} /> Hash: {promptHash.substring(0, 12)}...
              </span>
              <span className="prompt-meta-item">
                <FileJson size={10} /> Hallazgos: {inputSummary.findings}
              </span>
              <span className="prompt-meta-item">
                <Eye size={10} /> Columnas: {inputSummary.affectedColumns}
              </span>
            </div>

            {isCloudMode && (
              <div className="contract-guide-cloud-warning contract-guide-cloud-warning--small">
                <AlertTriangle size={12} />
                <span>Este paquete se enviará al proveedor cloud.</span>
              </div>
            )}

            <details className="prompt-preview-details">
              <summary>Ver prompt completo ({diagnosisPrompt.length} chars)</summary>
              <pre className="prompt-preview-content">{diagnosisPrompt}</pre>
            </details>

            <details className="prompt-preview-details">
              <summary>Ver smartSample JSON ({JSON.stringify(smartSample).length} chars)</summary>
              <pre className="prompt-preview-content">{JSON.stringify(smartSample, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>

      <div className="contract-guide-footer">
        <Lock size={12} />
        <p>AURA no reemplaza al motor determinista. El modelo interpreta la evidencia, pero las reglas y hallazgos son generados por algoritmos exactos.</p>
      </div>
    </div>
  );
};

export default DiagnosisContractGuide;
