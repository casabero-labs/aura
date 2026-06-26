/**
 * Shared UI context builder for script contract pipeline.
 *
 * Builds ColumnRef[] via buildColumnRegistry (Phase 1) and ScriptBuildContextV2
 * via buildScriptContext. Used by both ScriptGenerationStepV2 and ReviewStep.
 *
 * NO manual column ref construction — always delegates to buildColumnRegistry.
 */
import {
  buildColumnRegistry,
  buildScriptContext,
} from '../contracts/llm';
import type {
  ColumnRef,
  DiagnosisExecutionResult,
  ScriptBuildContextV2,
} from '../contracts/llm';

export interface UiScriptContextInput {
  structuredDiagnosis: DiagnosisExecutionResult | null;
  csvFields: readonly string[];
  sourceDatasetFingerprint: string | null;
}

export type UiScriptContextResult =
  | {
      ok: true;
      refs: ColumnRef[];
      buildContext: ScriptBuildContextV2;
    }
  | {
      ok: false;
      reason:
        | 'missing_remediation_context'
        | 'missing_fingerprint'
        | 'missing_columns'
        | 'context_build_failed';
      message: string;
    };

export function buildUiScriptContext(
  input: UiScriptContextInput,
): UiScriptContextResult {
  const { structuredDiagnosis, csvFields, sourceDatasetFingerprint } = input;

  if (!structuredDiagnosis?.remediationContext) {
    return {
      ok: false,
      reason: 'missing_remediation_context',
      message: 'Falta remediationContext del diagnóstico estructurado',
    };
  }

  if (!sourceDatasetFingerprint) {
    return {
      ok: false,
      reason: 'missing_fingerprint',
      message: 'Falta fingerprint del dataset',
    };
  }

  if (csvFields.length === 0) {
    return {
      ok: false,
      reason: 'missing_columns',
      message: 'No hay columnas disponibles en el CSV',
    };
  }

  try {
    const refs = buildColumnRegistry([...csvFields]);

    const buildContext = buildScriptContext(
      structuredDiagnosis.remediationContext,
      refs,
      sourceDatasetFingerprint,
    );

    return { ok: true, refs, buildContext };
  } catch (err: any) {
    return {
      ok: false,
      reason: 'context_build_failed',
      message: err?.message ?? 'Error construyendo el contexto de script',
    };
  }
}

/**
 * Build a stable identity key for the script contract input.
 * Includes approvalStatus so changes in approval invalidate the contract.
 */
export function buildScriptContractInputKey(params: {
  fingerprint: string | null;
  envelopeRef: string | null;
  planId: string | null;
  plan: { actionId: string; approvalStatus: string }[] | null;
  csvFields: readonly string[];
}): string | null {
  const { fingerprint, envelopeRef, planId, plan, csvFields } = params;
  if (!fingerprint || !envelopeRef || !planId || !plan) return null;

  return JSON.stringify({
    fingerprint,
    envelopeRef,
    planId,
    approvals: plan.map((action) => [action.actionId, action.approvalStatus]),
    csvFields: [...csvFields],
  });
}
