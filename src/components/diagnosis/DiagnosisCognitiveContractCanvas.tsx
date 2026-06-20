import React, { useState } from 'react';
import { FileCode2, AlertTriangle, CheckCircle, ChevronRight, ArrowRight } from 'lucide-react';
import { AIConfig, InputMode } from '../../types';

interface DiagnosisCognitiveContractCanvasProps {
  aiConfig: AIConfig;
  onInputModeChange: (mode: InputMode) => void;
  onOpenTechnicalEvidence?: () => void;
}

interface InputModeConfig {
  value: InputMode;
  label: string;
  badge?: string;
  description: string;
  whenToUse: string;
  warning?: string;
}

const INPUT_MODE_CONFIGS: Record<InputMode, InputModeConfig> = {
  smart_sample: {
    value: 'smart_sample',
    label: 'Smart Sample',
    badge: 'Recomendado',
    description: 'Usa evidencia estructurada del perfil: columnas, estadísticas, reglas activadas y muestras limitadas.',
    whenToUse: 'Diagnóstico general con buen equilibrio entre privacidad, trazabilidad y latencia.',
  },
  prompt_libre: {
    value: 'prompt_libre',
    label: 'Prompt Libre',
    badge: 'Experimental',
    description: 'Entrega solo contexto mínimo: columnas, filas, columnas totales y score.',
    whenToUse: 'Pruebas rápidas o comparación del comportamiento del modelo.',
    warning: 'Mayor riesgo de respuestas no trazables porque no recibe reglas ni bad samples.',
  },
  enhanced_registry: {
    value: 'enhanced_registry',
    label: 'Registro Extendido',
    description: 'Entrega un registro técnico más completo: tipos semánticos, frecuencias, IQR, ceros, cardinalidad y reglas con porcentajes afectados.',
    whenToUse: 'Datasets complejos o cuando el diagnóstico necesita más profundidad.',
  },
  copy_paste_bad_samples: {
    value: 'copy_paste_bad_samples',
    label: 'Copy-Paste',
    description: 'Entrega valores problemáticos reales detectados por AURA y fuerza al modelo a citarlos textualmente.',
    whenToUse: 'Auditoría, trazabilidad o pruebas de fidelidad del modelo.',
  },
  recommended: {
    value: 'recommended',
    label: 'Completo',
    badge: 'Máxima evidencia',
    description: 'Combina registro extendido y bad samples.',
    whenToUse: 'Informe final, anexos académicos o validación detallada.',
    warning: 'Más contexto implica más tokens y mayor latencia.',
  },
};

const MODE_CONTENT: Record<InputMode, {
  receives: string[];
  doesNotReceive: string[];
  affectsDiagnosis: string[];
}> = {
  smart_sample: {
    receives: ['Columnas con tipos inferidos', 'Estadísticas básicas', 'Reglas activadas', 'Muestras limitadas'],
    doesNotReceive: ['Dataset completo', 'Todas las filas', 'Tipos semánticos avanzados', 'Frecuencias detalladas'],
    affectsDiagnosis: ['Equilibrio entre profundidad y latencia', 'Trazabilidad alta por anclaje a reglas', 'Riesgo bajo de alucinación'],
  },
  prompt_libre: {
    receives: ['Columnas disponibles', 'Contexto mínimo: filas, score', 'Ninguna regla ni muestra'],
    doesNotReceive: ['Reglas activadas', 'Bad samples', 'Estadísticas detalladas', 'Estructura del perfil'],
    affectsDiagnosis: ['Exploración creativa', 'Mayor riesgo de inferencias no trazables', 'Menor reproducibilidad'],
  },
  enhanced_registry: {
    receives: ['Registro técnico completo', 'Tipos semánticos', 'Frecuencias e IQR', 'Reglas con porcentajes'],
    doesNotReceive: ['Dataset completo', 'Todas las filas', 'Valores problemáticos', 'Bad samples'],
    affectsDiagnosis: ['Mayor profundidad', 'Más tokens consumidos', 'Latencia moderada-alta'],
  },
  copy_paste_bad_samples: {
    receives: ['Bad samples textuales', 'Reglas asociadas', 'Valores problemáticos', 'Forzado de citación'],
    doesNotReceive: ['Dataset completo', 'Estadísticas generales', 'Tipos semánticos', 'Frecuencias detalladas'],
    affectsDiagnosis: ['Máxima trazabilidad', 'Modelo debe citar evidencia real', 'Fidelidad al perfil'],
  },
  recommended: {
    receives: ['Registro completo', 'Bad samples', 'Tipos semánticos', 'Estadísticas detalladas'],
    doesNotReceive: ['Dataset completo', 'Todas las filas', 'Rutas o nombres de archivo'],
    affectsDiagnosis: ['Máxima evidencia', 'Mayor latencia', 'Informe completo para anexos'],
  },
};

interface ImpactLevel {
  level: 'high' | 'medium' | 'low';
  label: string;
}

const IMPACT_LABELS: Record<string, string> = {
  privacy: 'Privacidad',
  traceability: 'Trazabilidad',
  hallucination: 'Alucinación',
  latency: 'Latencia',
  depth: 'Profundidad',
  reproducibility: 'Reproducibilidad',
};

const IMPACT_CHIPS: Record<InputMode, Record<string, ImpactLevel>> = {
  smart_sample: {
    privacy: { level: 'high', label: 'Alta' },
    traceability: { level: 'high', label: 'Alta' },
    hallucination: { level: 'low', label: 'Bajo' },
    latency: { level: 'low', label: 'Baja' },
    depth: { level: 'medium', label: 'Media' },
    reproducibility: { level: 'high', label: 'Alta' },
  },
  prompt_libre: {
    privacy: { level: 'medium', label: 'Media' },
    traceability: { level: 'low', label: 'Baja' },
    hallucination: { level: 'high', label: 'Alto' },
    latency: { level: 'low', label: 'Baja' },
    depth: { level: 'low', label: 'Baja' },
    reproducibility: { level: 'low', label: 'Baja' },
  },
  enhanced_registry: {
    privacy: { level: 'medium', label: 'Media' },
    traceability: { level: 'high', label: 'Alta' },
    hallucination: { level: 'medium', label: 'Medio' },
    latency: { level: 'medium', label: 'Media' },
    depth: { level: 'high', label: 'Alta' },
    reproducibility: { level: 'medium', label: 'Media' },
  },
  copy_paste_bad_samples: {
    privacy: { level: 'high', label: 'Alta' },
    traceability: { level: 'high', label: 'Alta' },
    hallucination: { level: 'medium', label: 'Medio' },
    latency: { level: 'medium', label: 'Media' },
    depth: { level: 'medium', label: 'Media' },
    reproducibility: { level: 'high', label: 'Alta' },
  },
  recommended: {
    privacy: { level: 'medium', label: 'Media' },
    traceability: { level: 'high', label: 'Alta' },
    hallucination: { level: 'low', label: 'Bajo' },
    latency: { level: 'high', label: 'Alta' },
    depth: { level: 'high', label: 'Alta' },
    reproducibility: { level: 'high', label: 'Alta' },
  },
};

const SEGMENTED_OPTIONS: { value: InputMode; label: string }[] = [
  { value: 'smart_sample', label: 'Smart' },
  { value: 'prompt_libre', label: 'Libre' },
  { value: 'enhanced_registry', label: 'Extendido' },
  { value: 'copy_paste_bad_samples', label: 'Copy' },
  { value: 'recommended', label: 'Completo' },
];

export const DiagnosisCognitiveContractCanvas: React.FC<DiagnosisCognitiveContractCanvasProps> = ({
  aiConfig,
  onInputModeChange,
  onOpenTechnicalEvidence,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeMode: InputMode = aiConfig.inputMode || 'smart_sample';
  const config = INPUT_MODE_CONFIGS[activeMode];
  const content = MODE_CONTENT[activeMode];
  const impacts = IMPACT_CHIPS[activeMode];

  return (
    <div className="diagnosis-contract-canvas">
      <div className="contract-canvas-header">
        <div className="contract-canvas-eyebrow">MÉTODO DE ENTRADA</div>
        <h3 className="contract-canvas-title">Cómo recibirá evidencia la IA</h3>
        <p className="contract-canvas-intro">
          El método de entrada define qué evidencia recibirá el modelo y qué tan trazable será el diagnóstico.
        </p>
      </div>

      <div className="contract-canvas-segmented">
        <div className="segmented-control" role="group" aria-label="Método de entrada">
          {SEGMENTED_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`segmented-control-btn ${activeMode === option.value ? 'active' : ''}`}
              onClick={() => onInputModeChange(option.value)}
              aria-pressed={activeMode === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="contract-canvas-mode-card">
        <div className="contract-mode-card-header">
          <span className="contract-mode-card-name">{config.label}</span>
          {config.badge && (
            <span className={`contract-mode-badge ${config.badge === 'Experimental' ? 'contract-mode-badge--warning' : 'contract-mode-badge--success'}`}>
              {config.badge}
            </span>
          )}
        </div>
        <p className="contract-mode-card-desc">{config.description}</p>
        <p className="contract-mode-card-when">Cuándo usar: {config.whenToUse}</p>
        {config.warning && (
          <div className="contract-mode-card-warning">
            <AlertTriangle size={12} />
            <span>{config.warning}</span>
          </div>
        )}
      </div>

      <div className="contract-canvas-grid">
        <div className="contract-canvas-col">
          <h4>Qué recibe la IA</h4>
          <ul>
            {content.receives.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="contract-canvas-col">
          <h4>Qué NO recibe</h4>
          <ul>
            {content.doesNotReceive.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="contract-canvas-col">
          <h4>Cómo afecta el diagnóstico</h4>
          <ul>
            {content.affectsDiagnosis.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="contract-canvas-impact-strip">
        {Object.entries(impacts).map(([key, impact]) => (
          <div key={key} className={`contract-canvas-impact-chip contract-canvas-impact-chip--${impact.level}`}>
            <span className="contract-impact-label">{IMPACT_LABELS[key] || key}</span>
            <span className="contract-impact-value">{impact.label}</span>
          </div>
        ))}
      </div>

      <div className="contract-canvas-pipeline">
        <div className="contract-pipeline-step">
          <span className="contract-pipeline-label">Perfil determinista</span>
        </div>
        <ArrowRight size={14} className="contract-pipeline-arrow" />
        <div className="contract-pipeline-step">
          <span className="contract-pipeline-label">Expediente estructurado</span>
        </div>
        <ArrowRight size={14} className="contract-pipeline-arrow" />
        <div className="contract-pipeline-step">
          <span className="contract-pipeline-label">IA interpreta</span>
        </div>
        <ArrowRight size={14} className="contract-pipeline-arrow" />
        <div className="contract-pipeline-step">
          <span className="contract-pipeline-label">Diagnóstico</span>
        </div>
      </div>
      <p className="contract-canvas-pipeline-note">
        AURA no entrega el CSV crudo. El modelo interpreta un expediente derivado del perfil determinista.
      </p>

      <button
        className="btn-s contract-canvas-evidence-btn"
        onClick={onOpenTechnicalEvidence}
      >
        <FileCode2 size={14} />
        Ver expediente técnico
      </button>
    </div>
  );
};

export default DiagnosisCognitiveContractCanvas;
