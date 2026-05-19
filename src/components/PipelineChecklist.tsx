/**
 * PipelineChecklist — Transparencia total del flujo AURA
 *
 * Muestra cada operación del pipeline como un checklist expandible.
 * Nada ocurre en background. El usuario ve exactamente qué datos
 * recibe cada capa, qué produce, y qué métricas genera.
 *
 * Inspirado en: AutoDCWorkflow (EMNLP 2025) — 3 dimensiones de evaluación,
 * Long et al. (ICLR 2026) — copy-paste reduce alucinaciones,
 * AD-LLM (Yang et al. 2024) — benchmark multi-dimensional.
 */

import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle,
  AlertCircle, Clock, Cpu, Database, FileText,
  Scissors, Brain, ShieldCheck, Loader2, Play
} from 'lucide-react';
import {
  AuditReport, AuditExecutionEvidence, AIConfig, ProviderMetrics,
  BenchmarkResult, ScriptValidationResult, HealthDelta
} from '../types';
import { buildSmartSample } from '../services/providers/prompts';

export type ChecklistStepStatus = 'pending' | 'running' | 'done' | 'warning' | 'error';

export interface ChecklistStep {
  id: string;
  layer: string;           // "capa 0", "capa 1", "capa 2", etc.
  label: string;           // "CSV parsing", "Motor determinista", etc.
  status: ChecklistStepStatus;
  icon: React.ReactNode;
  /** Qué datos recibió esta etapa */
  input?: {
    label: string;
    detail: string;
  }[];
  /** Qué produjo esta etapa */
  output?: {
    label: string;
    detail: string;
  }[];
  /** Métricas de esta etapa */
  metrics?: {
    label: string;
    value: string;
  }[];
  /** Detalle técnico expandible (el prompt real, columnas enviadas, etc.) */
  technicalDetail?: {
    title: string;
    content: string;
  }[];
  durationMs?: number;
  warning?: string;
  error?: string;
}

interface PipelineChecklistProps {
  /** Pasos del checklist */
  steps: ChecklistStep[];
  /** Fases colapsadas/expandidas */
  onToggle?: (stepId: string) => void;
  expandedSteps?: Set<string>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const statusConfig = (status: ChecklistStepStatus) => {
  switch (status) {
    case 'done':     return { color: 'var(--green)',  icon: <CheckCircle2 size={14} /> };
    case 'running':  return { color: 'var(--blue)',   icon: <Loader2 size={14} className="spin" /> };
    case 'warning':  return { color: 'var(--orange)', icon: <AlertCircle size={14} /> };
    case 'error':    return { color: 'var(--red)',    icon: <AlertCircle size={14} /> };
    default:         return { color: 'var(--ink2)',  icon: <Circle size={14} /> };
  }
};

const LayerBadge: React.FC<{ layer: string }> = ({ layer }) => (
  <span className="checklist-layer-badge">{layer}</span>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="checklist-section-label">{children}</p>
);

// ── Step component ────────────────────────────────────────────────────────────

const ChecklistItem: React.FC<{
  step: ChecklistStep;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ step, isExpanded, onToggle }) => {
  const { color, icon } = statusConfig(step.status);

  return (
    <div className={`checklist-item checklist-item--${step.status}`}>
      <button className="checklist-item-header" onClick={onToggle} aria-expanded={isExpanded}>
        <span className="checklist-item-icon" style={{ color }}>{icon}</span>
        <span className="checklist-item-label">{step.label}</span>
        <LayerBadge layer={step.layer} />
        {step.durationMs != null && (
          <span className="checklist-item-duration">
            <Clock size={10} /> {step.durationMs}ms
          </span>
        )}
        <span className="checklist-item-chevron">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {isExpanded && (
        <div className="checklist-item-body">
          {step.warning && (
            <div className="checklist-warning">
              <AlertCircle size={12} /> {step.warning}
            </div>
          )}
          {step.error && (
            <div className="checklist-error">
              <AlertCircle size={12} /> {step.error}
            </div>
          )}

          {step.input && step.input.length > 0 && (
            <div className="checklist-section">
              <SectionLabel>▸ Datos recibidos por esta etapa</SectionLabel>
              <table className="checklist-table">
                <tbody>
                  {step.input.map((row, i) => (
                    <tr key={i}>
                      <td className="checklist-table-key">{row.label}</td>
                      <td className="checklist-table-val"><code>{row.detail}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {step.output && step.output.length > 0 && (
            <div className="checklist-section">
              <SectionLabel>▸ Datos producidos por esta etapa</SectionLabel>
              <table className="checklist-table">
                <tbody>
                  {step.output.map((row, i) => (
                    <tr key={i}>
                      <td className="checklist-table-key">{row.label}</td>
                      <td className="checklist-table-val"><code>{row.detail}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {step.metrics && step.metrics.length > 0 && (
            <div className="checklist-section">
              <SectionLabel>▸ Métricas</SectionLabel>
              <div className="checklist-metrics-grid">
                {step.metrics.map((m, i) => (
                  <div key={i} className="checklist-metric-chip">
                    <span className="checklist-metric-val">{m.value}</span>
                    <span className="checklist-metric-lbl">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.technicalDetail && step.technicalDetail.length > 0 && (
            <div className="checklist-section">
              <SectionLabel>▸ Detalle técnico</SectionLabel>
              {step.technicalDetail.map((td, i) => (
                <details key={i} className="checklist-technical-details">
                  <summary>{td.title}</summary>
                  <pre className="checklist-technical-content">{td.content}</pre>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Factories para construir pasos desde el estado del pipeline ───────────────

export function buildCsvParsingStep(
  fileName: string, fileSize: number, rows: number, cols: number,
  delimiter: string, durationMs: number, truncated: boolean
): ChecklistStep {
  return {
    id: 'csv-parsing',
    layer: 'capa 0',
    label: 'Lectura y parsing del archivo CSV',
    status: 'done',
    icon: <Database size={14} />,
    durationMs: durationMs,
    input: [
      { label: 'archivo', detail: fileName },
      { label: 'tamaño', detail: `${(fileSize / 1024).toFixed(1)} KB` },
      { label: 'delimiter detectado', detail: delimiter === ',' ? 'coma (,)' : ` "${delimiter}"` },
    ],
    output: [
      { label: 'filas leídas', detail: String(rows) },
      { label: 'columnas detectadas', detail: String(cols) },
      { label: 'truncado', detail: truncated ? 'sí (límite 50 000 filas)' : 'no' },
    ],
    metrics: [
      { label: 'filas', value: String(rows) },
      { label: 'columnas', value: String(cols) },
      { label: 'parse', value: `${durationMs}ms` },
    ],
  };
}

export function buildDeterministicAuditStep(
  report: AuditReport,
  evidence: AuditExecutionEvidence,
  durationMs: number
): ChecklistStep {
  const cols = Object.values(report.columnStats);
  const withIqr = cols.filter(c => c.iqr && c.iqr > 0).length;
  const semanticTypes = cols.filter(c => c.semanticType).map(c => c.semanticType as string);
  const issuesBySeverity = {
    critical: report.issues.filter(i => i.severity === 'critical').length,
    warning:  report.issues.filter(i => i.severity === 'warning').length,
    info:     report.issues.filter(i => i.severity === 'info').length,
  };

  return {
    id: 'deterministic-audit',
    layer: 'capa 1',
    label: 'Motor determinista — auditoría basada en reglas',
    status: issuesBySeverity.critical > 0 ? 'warning' : 'done',
    icon: <Cpu size={14} />,
    durationMs,
    warning: issuesBySeverity.critical > 0
      ? `${issuesBySeverity.critical} issues críticos detectados`
      : undefined,
    input: [
      { label: 'filas procesadas', detail: String(report.rowCount) },
      { label: 'columnas analizadas', detail: String(report.colCount) },
      { label: 'delimiter', detail: report.delimiterDetected },
    ],
    output: [
      { label: 'score de calidad', detail: `${report.score}/100` },
      { label: 'total issues', detail: String(report.issues.length) },
      { label: 'críticos / warn / info', detail: `${issuesBySeverity.critical} / ${issuesBySeverity.warning} / ${issuesBySeverity.info}` },
      { label: 'columnas con IQR', detail: String(withIqr) },
      { label: 'tipos semánticos detectados', detail: semanticTypes.length > 0 ? [...new Set(semanticTypes)].join(', ') : 'ninguno' },
      { label: 'filas duplicadas', detail: String(report.duplicateRows) },
    ],
    metrics: [
      { label: 'score', value: `${report.score}%` },
      { label: 'issues', value: String(report.issues.length) },
      { label: 'duplicados', value: String(report.duplicateRows) },
      { label: 'audit', value: `${durationMs}ms` },
    ],
    technicalDetail: [
      {
        title: 'Reglas activadas en esta ejecución',
        content: report.issues.length > 0
          ? report.issues.map(i => `[${i.severity.toUpperCase()}] ${i.ruleName}${i.column ? ` (${i.column})` : ''}: ${i.description}`).join('\n')
          : 'Ninguna regla activada — dataset sin anomalías detectadas.'
      },
      {
        title: 'Estadísticas por columna',
        content: cols.map(c =>
          `${c.name}: tipo=${c.inferredType}${c.semanticType ? ` (semántico: ${c.semanticType})` : ''} | nulos=${c.nullCount} | únicos=${c.uniqueCount}${c.iqr ? ` | IQR=${c.iqr.toFixed(2)}` : ''}`
        ).join('\n')
      },
      {
        title: 'JSON enviado a la Capa 2 (Smart Sample)',
        content: JSON.stringify(buildSmartSample(report), null, 2)
      },
    ],
  };
}

export function buildLLMAnalysisStep(
  config: AIConfig,
  metrics: ProviderMetrics | null,
  inputMode: 'smart_sample' | 'prompt_libre',
  hallucinatedColumns: string[],
  unsupportedClaims: number,
  jsonCompliance: boolean,
  status: ChecklistStepStatus,
  smartSamplePayload?: string,
  promptLibrePayload?: string,
  error?: string,
): ChecklistStep {
  const step: ChecklistStep = {
    id: 'llm-analysis',
    layer: 'capa 2',
    label: `Análisis IA — ${inputMode === 'smart_sample' ? 'Smart Sample (anclado)' : 'Prompt Libre (sin ancla)'}`,
    status,
    icon: <Brain size={14} />,
    error,
    input: [
      { label: 'modo', detail: inputMode === 'smart_sample' ? 'Smart Sample — JSON anclado a datos reales' : 'Prompt Libre — solo esquema, sin evidencia' },
      { label: 'proveedor', detail: config.providerType === 'cloud' ? (config.cloudProvider ?? 'cloud') : config.providerType },
      { label: 'modelo', detail: config.model },
      { label: 'temperatura', detail: String(config.temperature) },
    ],
    output: [],
    metrics: [],
  };

  if (metrics) {
    step.durationMs = metrics.latencyMs;
    step.metrics = [
      { label: 'latencia', value: `${metrics.latencyMs}ms` },
      { label: 'tokens', value: String(metrics.tokensGenerated) },
      { label: 'tokens/s', value: `${(metrics.tokensGenerated / (metrics.latencyMs / 1000)).toFixed(1)}` },
    ];
    step.output!.push(
      { label: 'tokens generados', detail: String(metrics.tokensGenerated) },
      { label: 'json válido', detail: jsonCompliance ? 'sí' : 'no' },
    );
  }

  if (hallucinatedColumns.length > 0) {
    step.output!.push({
      label: '⚠ columnas alucinadas',
      detail: hallucinatedColumns.join(', '),
    });
    if (step.status === 'done') step.status = 'warning';
  }

  if (unsupportedClaims > 0) {
    step.output!.push({
      label: '⚠ afirmaciones sin soporte',
      detail: String(unsupportedClaims),
    });
  }

  // Qué se envió al LLM (esto es la carta abierta — el usuario ve exactamente el prompt)
  if (inputMode === 'smart_sample' && smartSamplePayload) {
    step.technicalDetail = [
      {
        title: '📄 Smart Sample — JSON exacto enviado al LLM (muestra truncada)',
        content: smartSamplePayload.length > 2000
          ? smartSamplePayload.slice(0, 2000) + '\n… [truncado para visualización]'
          : smartSamplePayload,
      },
    ];
  } else if (inputMode === 'prompt_libre' && promptLibrePayload) {
    step.technicalDetail = [
      {
        title: '📄 Prompt Libre — texto exacto enviado al LLM',
        content: promptLibrePayload,
      },
    ];
  }

  return step;
}

export function buildScriptGenerationStep(
  hasScript: boolean,
  scriptLines: number,
  validation: ScriptValidationResult | null,
  tokenCount: number,
  status: ChecklistStepStatus,
  scriptPreview?: string,
  error?: string,
): ChecklistStep {
  return {
    id: 'script-generation',
    layer: 'capa 2',
    label: 'Generación de script Python/Pandas',
    status,
    icon: <Scissors size={14} />,
    error,
    input: [
      { label: 'script generado', detail: hasScript ? `sí — ${scriptLines} líneas` : 'no' },
    ],
    output: [
      { label: 'script Pandas', detail: hasScript ? `${scriptLines} líneas` : 'ninguno' },
      ...(validation ? [
        { label: 'columnas válidas', detail: validation.invalidColumns.length === 0 ? 'todas válidas' : `inválidas: ${validation.invalidColumns.join(', ')}` },
        { label: 'operaciones destructivas', detail: validation.destructiveOperations.length === 0 ? 'ninguna' : validation.destructiveOperations.join(', ') },
        { label: 'requiere revisión humana', detail: validation.requiresHumanReview ? 'sí' : 'no' },
      ] : []),
    ],
    metrics: [
      { label: 'líneas', value: String(scriptLines) },
      { label: 'tokens', value: String(tokenCount) },
    ],
    ...(scriptPreview ? {
      technicalDetail: [{
        title: '🐍 Script Python generado (muestra)',
        content: scriptPreview.length > 1500 ? scriptPreview.slice(0, 1500) + '\n…' : scriptPreview,
      }]
    } : {}),
  };
}

export function buildHITLReviewStep(
  hasApproval: boolean,
  healthDelta: HealthDelta | null,
  scriptApproved: string,
  status: ChecklistStepStatus,
): ChecklistStep {
  return {
    id: 'hitl-review',
    layer: 'capa 3',
    label: 'Revisión humana — HITL',
    status: hasApproval ? 'done' : 'pending',
    icon: <ShieldCheck size={14} />,
    input: [
      { label: 'script presentado', detail: scriptApproved ? `${scriptApproved.split('\n').length} líneas` : 'ninguno' },
      { label: 'revisión humana', detail: hasApproval ? 'aprobado' : 'pendiente' },
    ],
    output: hasApproval && healthDelta ? [
      { label: 'score antes → después', detail: `${healthDelta.beforeScore} → ${healthDelta.afterScore} (Δ${healthDelta.scoreDelta >= 0 ? '+' : ''}${healthDelta.scoreDelta})` },
      { label: 'issues antes → después', detail: `${healthDelta.beforeIssueCount} → ${healthDelta.afterIssueCount}` },
      { label: 'reglas corregidas', detail: healthDelta.correctedRules.join(', ') || 'ninguna' },
      { label: 'reglas sin cambio', detail: healthDelta.unchangedRules.join(', ') || 'ninguna' },
    ] : [],
    metrics: healthDelta ? [
      { label: 'Δ score', value: `${healthDelta.scoreDelta >= 0 ? '+' : ''}${healthDelta.scoreDelta}` },
      { label: 'Δ issues', value: `${healthDelta.issueDelta >= 0 ? '+' : ''}${healthDelta.issueDelta}` },
    ] : [],
  };
}

// ── Main component ────────────────────────────────────────────────────────────

const PipelineChecklist: React.FC<PipelineChecklistProps> = ({
  steps,
  expandedSteps = new Set(),
  onToggle,
}) => {
  const [localExpanded, setLocalExpanded] = useState<Set<string>>(new Set(['csv-parsing', 'deterministic-audit']));

  const isExpanded = (id: string) => localExpanded.has(id) || expandedSteps.has(id);

  const handleToggle = (id: string) => {
    setLocalExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onToggle?.(id);
  };

  const doneCount = steps.filter(s => s.status === 'done').length;
  const runningCount = steps.filter(s => s.status === 'running').length;

  return (
    <section className="pipeline-checklist" aria-label="Transparencia del pipeline — todas las operaciones visibles">
      <div className="checklist-header">
        <div className="checklist-header-left">
          <p className="sec-eye">carta abierta</p>
          <h2 className="sec-title">Transparencia total del proceso.</h2>
        </div>
        <div className="checklist-progress-summary">
          <span className="checklist-progress-done">{doneCount} etapas completadas</span>
          {runningCount > 0 && <span className="checklist-progress-running">{runningCount} en curso</span>}
          <span className="checklist-progress-total">/{steps.length} total</span>
        </div>
      </div>

      <p className="checklist-intro">
        Cada etapa del pipeline AURA opera en modo transparente. Abajo se muestra exactamente qué recibe cada capa,
        qué produce, y qué métricas genera. Nada ocurre en segundo plano. Este registro es reproducible
        y auditável.
      </p>

      <div className="checklist-body">
        {steps.map(step => (
          <ChecklistItem
            key={step.id}
            step={step}
            isExpanded={isExpanded(step.id)}
            onToggle={() => handleToggle(step.id)}
          />
        ))}
      </div>
    </section>
  );
};

export default PipelineChecklist;
