/**
 * Script Generation Step — V2 only.
 *
 * A remediation script can only be built from a validated structured (V2)
 * diagnosis: RemediationPlanStepV2 is deterministic and never calls a model.
 *
 * The historical V1 path (LegacyScriptGenerationStepV1) was removed: it sent
 * a free-text prompt with raw `sample_values` / `top_values` to
 * `aiProvider.generateText`, bypassing the V2 privacy policy redaction.
 * Without a structured diagnosis this step now explains what is missing and
 * sends nothing to any model.
 *
 * IMPORTANT: this module must NEVER import or call:
 * - buildScriptPrompt
 * - buildDiagnosisSummaryPrompt
 * - extractPythonScript
 * - buildDeterministicCleaningScript
 * - aiProvider.generateText
 */
import React from 'react';
import RemediationPlanStepV2 from './RemediationPlanStepV2';
import type { AuditReport, AIProvider, ProviderMetrics, ScriptValidationResult } from '../types';
import type { DiagnosisExecutionResult, RemediationPlanV2 } from '../contracts/llm';

interface ScriptGenerationStepProps {
  report: AuditReport;
  /** Kept for caller compatibility; never used to generate a script. */
  aiProvider?: AIProvider;
  diagnosisText?: string;
  cleaningScript?: string;
  scriptValidation?: ScriptValidationResult | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  remediationPlan?: RemediationPlanV2 | null;
  onRemediationPlanChange?: (plan: RemediationPlanV2) => void;
  onScriptGenerated?: (script: string, metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
}

export const scriptRequiresV2DiagnosisCopy = {
  title: 'Falta un diagnóstico validado',
  body: 'AURA solo prepara una corrección a partir de un diagnóstico estructurado que haya pasado el validador. Esta sesión no tiene uno, así que no se genera ningún script ni se envía nada a un modelo.',
  next: 'Vuelve al diagnóstico, inícialo con un proveedor local y, cuando el contrato quede validado, regresa aquí.',
} as const;

const ScriptGenerationStep: React.FC<ScriptGenerationStepProps> = (props) => {
  if (props.structuredDiagnosis) {
    return (
      <RemediationPlanStepV2
        report={props.report}
        structuredDiagnosis={props.structuredDiagnosis}
        remediationPlan={props.remediationPlan}
        onRemediationPlanChange={props.onRemediationPlanChange}
        onContinue={props.onContinue}
      />
    );
  }

  return (
    <section className="section" data-testid="script-requires-v2-diagnosis" aria-labelledby="script-requires-v2-title">
      <h2 id="script-requires-v2-title" className="sec-title">{scriptRequiresV2DiagnosisCopy.title}</h2>
      <p className="section-note">{scriptRequiresV2DiagnosisCopy.body}</p>
      <p className="section-note">{scriptRequiresV2DiagnosisCopy.next}</p>
    </section>
  );
};

export default ScriptGenerationStep;
