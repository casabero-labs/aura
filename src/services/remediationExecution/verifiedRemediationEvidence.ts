// ── Task 2: Verified Remediation Evidence ──
// Connects the real reaudit immediately after AURA validates
// corrected.csv and receipt.json.
//
// Reuses runReaudit() (deterministic engine, same as runAudit) and
// calculateHealthDelta(). Does NOT use runImprovementFlow() — that belongs
// to the historic simulation/Colab flow.
//
// The canonical result never carries the raw CSV bytes of the audited
// datasets (no beforeOutput, afterOutput nor rawCsv): only structured
// summaries plus the already-verified corrected.csv bytes.

import type { AuditReport, HealthDelta } from '../../types';
import { calculateHealthDelta } from '../improvementService';
import {
  runReaudit,
  type OutputDatasetSummaryV1,
  type ReauditSummaryV1,
} from '../reauditService';
import type { PythonExecutionBundleV1, PythonExecutionReceiptV1 } from './pythonExecutionContract';

export interface VerifiedRemediationEvidence {
  bundle: PythonExecutionBundleV1;
  receipt: PythonExecutionReceiptV1;
  correctedCsv: Uint8Array;
  reaudit: {
    summary: ReauditSummaryV1;
    output: OutputDatasetSummaryV1;
    beforeReport: AuditReport;
    afterReport: AuditReport;
  };
  beforeAfterSummary: HealthDelta;
}

export interface BuildVerifiedRemediationEvidenceInput {
  bundle: PythonExecutionBundleV1;
  receipt: PythonExecutionReceiptV1;
  sourceCsv: Uint8Array;
  correctedCsv: Uint8Array;
  evidenceEnvelopeRef: string;
  delimiter?: string;
}

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/**
 * Builds the canonical reaudit evidence from an already-validated Python
 * execution. Throws explicitly if either dataset is empty/invalid so the
 * caller can keep the Python receipt while marking the reaudit as failed.
 */
export function buildVerifiedRemediationEvidence(
  input: BuildVerifiedRemediationEvidenceInput,
): VerifiedRemediationEvidence {
  const beforeCsv = decode(input.sourceCsv);
  const afterCsv = decode(input.correctedCsv);

  if (!beforeCsv.trim()) throw new Error('El CSV fuente está vacío o no es válido.');
  if (!afterCsv.trim()) throw new Error('El CSV corregido está vacío o no es válido.');

  const reaudit = runReaudit(beforeCsv, afterCsv, input.evidenceEnvelopeRef, {
    delimiter: input.delimiter,
  });
  const beforeAfterSummary = calculateHealthDelta(reaudit.beforeReport, reaudit.afterReport);

  return {
    bundle: input.bundle,
    receipt: input.receipt,
    correctedCsv: input.correctedCsv,
    reaudit: {
      summary: reaudit.summary,
      output: reaudit.output,
      beforeReport: reaudit.beforeReport,
      afterReport: reaudit.afterReport,
    },
    beforeAfterSummary,
  };
}

export interface RuleComparison {
  correctedRuleIds: string[];
  persistentRuleIds: string[];
  newRuleIds: string[];
}

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

/** Derives corrected / persistent / new rule sets by ruleId from the reports. */
export function compareReauditRules(evidence: VerifiedRemediationEvidence): RuleComparison {
  const beforeRules = new Set(evidence.reaudit.beforeReport.issues.map((issue) => issue.ruleId));
  const afterRules = new Set(evidence.reaudit.afterReport.issues.map((issue) => issue.ruleId));
  return {
    correctedRuleIds: uniqueSorted([...beforeRules].filter((ruleId) => !afterRules.has(ruleId))),
    persistentRuleIds: uniqueSorted([...beforeRules].filter((ruleId) => afterRules.has(ruleId))),
    newRuleIds: uniqueSorted([...afterRules].filter((ruleId) => !beforeRules.has(ruleId))),
  };
}
