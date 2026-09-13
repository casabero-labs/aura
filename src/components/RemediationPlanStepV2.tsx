/**
 * Remediation Plan Step v2 — Deterministic, no AI.
 *
 * This component does NOT import or evaluate any AI functions:
 * - buildScriptPrompt
 * - buildDiagnosisSummaryPrompt
 * - extractPythonScript
 * - buildDeterministicCleaningScript
 * - aiProvider.generateText
 *
 * The v2 path is completely isolated from AI imports at the module level.
 */
import React, { useCallback, useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, AlertTriangle, Ban } from 'lucide-react';
import { AuditReport } from '../types';
import {
  buildRemediationPlanV2,
  validateRemediationPlanV2,
  approveRemediationActionV2,
  rejectRemediationActionV2,
  resetRemediationActionV2,
} from '../contracts/llm';
import type { DiagnosisExecutionResult, RemediationActionV2, RemediationPlanV2 } from '../contracts/llm';

const ACTION_LABELS: Record<RemediationActionV2['actionType'], string> = {
  trim_whitespace: 'Limpiar espacios del texto',
  drop_exact_duplicates: 'Eliminar filas duplicadas exactas',
  normalize_placeholders: 'Normalizar valores marcadores',
  normalize_casing: 'Normalizar mayúsculas y minúsculas',
  convert_disguised_numbers: 'Convertir números almacenados como texto',
  requires_human_review: 'Revisar antes de corregir',
};

const RULE_LABELS: Record<string, string> = {
  'rule:exact-duplicates': 'Filas duplicadas',
  'rule:null-values': 'Valores nulos',
  'rule:mojibake': 'Codificación de texto dañada',
  'rule:toxic-placeholders': 'Valores marcadores',
  'rule:extreme-outliers': 'Valores atípicos extremos',
  'rule:impossible-negatives': 'Valores negativos imposibles',
  'rule:invalid-email': 'Formato de correo inválido',
  'rule:mixed-date-formats': 'Formatos de fecha mixtos',
  'rule:pii-detected': 'Datos sensibles (PII)',
};

function getRuleLabel(ruleId: string): string {
  return RULE_LABELS[ruleId] ?? ruleId.replace(/^rule:/, '').replaceAll('-', ' ');
}

interface RemediationPlanStepV2Props {
  report: AuditReport;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  remediationPlan?: RemediationPlanV2 | null;
  onRemediationPlanChange?: (plan: RemediationPlanV2) => void;
  onContinue: () => void;
  continueLabel?: string;
  onContinueWithPlan?: (plan: RemediationPlanV2) => void;
}

const RemediationPlanStepV2: React.FC<RemediationPlanStepV2Props> = ({
  report,
  structuredDiagnosis,
  remediationPlan,
  onRemediationPlanChange,
  onContinue,
  continueLabel,
  onContinueWithPlan,
}) => {
  const [v2Plan, setV2Plan] = useState<RemediationPlanV2 | null>(remediationPlan ?? null);
  const [v2PlanError, setV2PlanError] = useState<string | null>(null);

  useEffect(() => {
    if (remediationPlan) {
      // Restored plan — validate against current structuredDiagnosis
      if (!structuredDiagnosis?.remediationContext) {
        setV2PlanError('No remediationContext available — cannot restore plan');
        return;
      }
      const validation = validateRemediationPlanV2(remediationPlan, structuredDiagnosis);
      if (!validation.valid) {
        setV2PlanError(`Restored plan invalid: ${validation.errors.map(e => e.message).join('; ')}`);
        setV2Plan(null);
        return;
      }
      setV2Plan(remediationPlan);
      setV2PlanError(null);
      return;
    }

    // Build new plan
    if (!structuredDiagnosis?.remediationContext) {
      setV2PlanError('remediationContext not available in structuredDiagnosis');
      return;
    }
    try {
      const plan = buildRemediationPlanV2(structuredDiagnosis);
      const validation = validateRemediationPlanV2(plan, structuredDiagnosis);
      if (!validation.valid) {
        setV2PlanError(`Plan validation failed: ${validation.errors.map(e => e.message).join('; ')}`);
        return;
      }
      setV2Plan(plan);
      setV2PlanError(null);
      onRemediationPlanChange?.(plan);
    } catch (e) {
      setV2PlanError(`Error building remediation plan: ${(e as Error).message}`);
    }
  }, [structuredDiagnosis, remediationPlan]);

  const handleApprove = useCallback((actionId: string) => {
    if (!v2Plan) return;
    const result = approveRemediationActionV2(v2Plan, actionId);
    if (result.success) {
      setV2Plan(result.plan);
      onRemediationPlanChange?.(result.plan);
    }
  }, [v2Plan, onRemediationPlanChange]);

  const handleReject = useCallback((actionId: string) => {
    if (!v2Plan) return;
    const result = rejectRemediationActionV2(v2Plan, actionId);
    if (result.success) {
      setV2Plan(result.plan);
      onRemediationPlanChange?.(result.plan);
    }
  }, [v2Plan, onRemediationPlanChange]);

  const handleReset = useCallback((actionId: string) => {
    if (!v2Plan) return;
    const result = resetRemediationActionV2(v2Plan, actionId);
    if (result.success) {
      setV2Plan(result.plan);
      onRemediationPlanChange?.(result.plan);
    }
  }, [v2Plan, onRemediationPlanChange]);

  const columnById = new Map(
    (structuredDiagnosis?.remediationContext?.columns ?? []).map(column => [column.columnId, column]),
  );

  if (v2PlanError) {
    return (
      <section className="section editorial-workbench" data-testid="remediation-stage">
        <header className="section-header">
          <div>
            <p className="sec-eye">remediación estructurada v2</p>
            <h2 className="sec-title">Plan de remediación determinista</h2>
          </div>
        </header>
        <div className="provider-error-notice" style={{ marginBottom: 'var(--space-md)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
          <span>{v2PlanError}</span>
        </div>
      </section>
    );
  }

  if (!v2Plan) {
    return (
      <section className="section editorial-workbench" data-testid="remediation-stage">
        <header className="section-header">
          <div>
            <p className="sec-eye">remediación estructurada v2</p>
            <h2 className="sec-title">Plan de remediación determinista</h2>
          </div>
        </header>
        <p className="section-note">Construyendo plan de remediación determinista...</p>
      </section>
    );
  }

  return (
    <section className="section editorial-workbench" data-testid="remediation-stage">
      <header className="section-header">
        <div>
          <p className="sec-eye">remediación estructurada v2</p>
          <h2 className="sec-title">Plan de remediación determinista</h2>
        </div>
      </header>
      <p className="section-note">
        Plan estructurado listo. La generación determinista del script se realizará en la siguiente fase.
      </p>

      <div className="stage-decision-summary" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="stage-summary-item">
          <span className="stage-summary-label">acciones</span>
          <strong className="stage-summary-value">{v2Plan.plan.length}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">auto-safe</span>
          <strong className="stage-summary-value">{v2Plan.plan.filter(a => a.actionability === 'auto_safe').length}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">review</span>
          <strong className="stage-summary-value">{v2Plan.plan.filter(a => a.actionability === 'review_only').length}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">exclusiones</span>
          <strong className="stage-summary-value">{v2Plan.exclusions.length}</strong>
        </div>
      </div>

      {v2Plan.plan.map((action, i) => {
        const column = action.columnId ? columnById.get(action.columnId) : null;
        const columnLabel = column
          ? `${column.name}${column.isDuplicate ? ` (posición ${column.position + 1})` : ''}`
          : action.columnId
            ? 'Columna no identificada'
            : 'Todo el dataset';
        const evidenceLabel = action.evidenceRefs.length === 1 ? '1 evidencia' : `${action.evidenceRefs.length} evidencias`;
        const ActionabilityIcon = action.actionability === 'auto_safe' ? ShieldCheck : action.actionability === 'review_only' ? AlertTriangle : Ban;
        const actionabilityLabel = action.actionability === 'auto_safe'
          ? 'Corrección automática disponible'
          : action.actionability === 'review_only'
            ? 'Revisión humana requerida'
            : 'Acción no disponible';

        return (
        <div key={action.actionId} className="stage-result remediation-action" style={{ marginBottom: '12px' }} data-testid={`remediation-action-${i}`}>
          <div className="remediation-action__layout">
            <div className="remediation-action__content">
              <p className="remediation-action__scope">
                {action.columnId ? 'Columna' : 'Alcance'}
              </p>
              <h4 className="remediation-action__title">
                {i + 1}. {ACTION_LABELS[action.actionType]}
              </h4>
              <p className="remediation-action__target" data-testid={`remediation-action-target-${i}`}>
                <strong>{columnLabel}</strong>
                <span aria-hidden="true"> · </span>
                <span>Problema: {getRuleLabel(action.ruleId)}</span>
              </p>
              <div className="remediation-action__status">
                <ActionabilityIcon size={13} aria-hidden="true" />
                <span>{actionabilityLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{evidenceLabel}</span>
              </div>
              <details className="remediation-action__technical">
                <summary>Antes y después propuesto</summary>
                <dl>
                  <div><dt>Acción</dt><dd>{action.actionType}</dd></div>
                  <div><dt>Regla</dt><dd>{action.ruleId}</dd></div>
                  {action.columnId && <div><dt>ID de columna</dt><dd>{action.columnId}</dd></div>}
                  <div><dt>ID de acción</dt><dd>{action.actionId}</dd></div>
                  <div>
                    <dt>Valores observados</dt>
                    <dd>{((report.issues ?? []).find(issue => issue.ruleId === action.ruleId && (!column || issue.column === column.name))?.sampleValues ?? [])
                      .slice(0, 4).map(value => String(value ?? 'vacío')).join(', ') || 'Sin muestra en el perfil'}</dd>
                  </div>
                  <div>
                    <dt>Alcance</dt>
                    <dd>{columnLabel} · {evidenceLabel}</dd>
                  </div>
                </dl>
              </details>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {action.approvalStatus === 'pending' && (
                <>
                  <button className="btn-s btn-sm remediation-action__approve" onClick={() => handleApprove(action.actionId)}>
                    <CheckCircle2 size={12} /> Aprobar
                  </button>
                  <button className="btn-s btn-sm remediation-action__reject" onClick={() => handleReject(action.actionId)}>
                    <AlertTriangle size={12} /> {action.actionType === 'normalize_placeholders' ? 'Conservar como válido' : 'Rechazar'}
                  </button>
                </>
              )}
              {action.approvalStatus === 'approved' && (
                <button className="btn-s btn-sm remediation-action__approved" onClick={() => handleReset(action.actionId)}>
                  <ShieldCheck size={12} /> Aprobado
                </button>
              )}
              {action.approvalStatus === 'rejected' && (
                <button className="btn-s btn-sm remediation-action__rejected" onClick={() => handleReset(action.actionId)}>
                  <Ban size={12} /> Rechazado
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })}

      {!v2Plan.plan.some(action => action.approvalStatus === 'approved') && (
        <div className="context-guide" role="status" data-testid="remediation-close-without-changes">
          <div>
            <p className="guide-title">No hay acciones aprobadas</p>
            <p className="guide-desc">Cerrar sin cambios es un resultado válido. Puedes exportar el informe con el dataset intacto.</p>
          </div>
          <button className="btn-p btn-sm" onClick={onContinue}>Cerrar sin cambios</button>
        </div>
      )}

      {v2Plan.exclusions.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)', padding: '10px', background: 'var(--surface2)', borderRadius: '6px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Exclusiones (not_actionable)</h4>
          {v2Plan.exclusions.map(ex => (
            <div key={ex.issueId} style={{ fontSize: '11px', color: 'var(--ink3)' }}>
              {ex.issueId}: {ex.reason}
            </div>
          ))}
        </div>
      )}

      <div className="evidence-options" data-testid="primary-stage-action" style={{ marginTop: 'var(--space-lg)' }}>
        <button
          className="btn-p btn-sm"
          disabled={!v2Plan}
          onClick={() => {
            if (onContinueWithPlan && v2Plan) {
              onContinueWithPlan(v2Plan);
            } else {
              onContinue();
            }
          }}
        >
          {continueLabel ?? 'Continuar a revisión'} <ArrowRight size={12} />
        </button>
      </div>
    </section>
  );
};

export default RemediationPlanStepV2;
