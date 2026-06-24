/**
 * Remediation Context v2 — Minimized context builder.
 *
 * Extracts only trusted policy data from EvidenceEnvelopeV2.
 * No samples, topValues, raw text, secrets, or API keys.
 */

import type {
  EvidenceEnvelopeV2,
  RemediationContextV2,
  RemediationContextColumnV2,
  RemediationContextIssueV2,
} from './types';
import { canonicalJson } from './diagnosisPromptV2';
import { sha256hex } from './hash';
import type { DiagnosisResponseV2 } from './types';

export function buildRemediationContext(envelope: EvidenceEnvelopeV2): RemediationContextV2 {
  const columns: RemediationContextColumnV2[] = envelope.columns.map((col) => ({
    columnId: col.columnId,
    name: col.name,
    position: col.position,
    duplicateOrdinal: col.duplicateOrdinal ?? 0,
    isAmbiguous: col.isAmbiguous,
    isDuplicate: col.isDuplicate,
  }));

  const issues: RemediationContextIssueV2[] = envelope.issues.map((iss) => ({
    issueId: iss.issueId,
    ruleId: iss.ruleId,
    columnId: iss.columnId,
    scope: iss.scope,
    evidenceRefs: [...iss.evidenceRefs],
    actionability: iss.actionability,
    automaticAuthorization: {
      actionType: iss.automaticAuthorization.actionType,
      authorized: iss.automaticAuthorization.authorized,
      conditionsMet: [...iss.automaticAuthorization.conditionsMet],
      reason: iss.automaticAuthorization.reason,
    },
  }));

  return {
    evidenceEnvelopeRef: '', // to be filled by caller
    datasetFingerprint: envelope.datasetFingerprint.sha256,
    columns,
    issues,
  };
}

// ── DiagnosisRef: diag:<sha256-canonical-json> ──

const DIAGNOSIS_REF_FIELDS = [
  'contractId',
  'contractVersion',
  'evidenceEnvelopeRef',
  'issues',
  'diagnosisBlocks',
  'limitations',
] as const;

export function buildDiagnosisRef(response: DiagnosisResponseV2): string {
  const semantic: Record<string, unknown> = {};
  for (const key of DIAGNOSIS_REF_FIELDS) {
    semantic[key] = (response as unknown as Record<string, unknown>)[key];
  }
  const canonical = canonicalJson(semantic);
  const hash = sha256hex(canonical);
  return `diag:${hash}`;
}
