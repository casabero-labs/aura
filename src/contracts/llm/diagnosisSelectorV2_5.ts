import {
  runStructuredDiagnosis as runStructuredDiagnosisCore,
  type DiagnosisSelectorOptions,
  type StructuredDiagnosisFailure,
  type StructuredDiagnosisOutcome,
} from './diagnosisSelector';
import {
  isDiagnosisInputPackageV2_5,
  resolveDiagnosisEvidenceAliasesV1,
  type DiagnosisInputPackageV2_5,
} from './diagnosisEvidenceIdentityV1';
import type { AuditReportInput } from './evidenceEnvelopeV2';
import type { DiagnosisResponseV2 } from './types';

const buildStableEffectiveDiagnosis = (
  effective: DiagnosisResponseV2,
  input: DiagnosisInputPackageV2_5,
): { diagnosis: DiagnosisResponseV2; errors: string[] } => {
  const stableByIssueAndSource = new Map(
    input.evidenceAliasMap.entries.map((entry) => [
      `${entry.issueId}\u0000${entry.sourceEvidenceRef}`,
      entry.stableEvidenceRef,
    ]),
  );
  const errors: string[] = [];
  const issues = effective.issues.map((issue) => ({
    ...issue,
    evidenceRefs: issue.evidenceRefs.flatMap((sourceRef) => {
      const stableRef = stableByIssueAndSource.get(`${issue.issueId}\u0000${sourceRef}`);
      if (!stableRef) {
        errors.push(`No stable ref exists for ${issue.issueId}/${sourceRef}.`);
        return [];
      }
      return [stableRef];
    }),
  }));
  return { diagnosis: { ...effective, issues }, errors };
};

const internalFailure = (
  message: string,
  outcome: Extract<StructuredDiagnosisOutcome, { success: true }>,
  details: Record<string, unknown>,
): StructuredDiagnosisFailure => ({
  success: false,
  code: 'DIAGNOSIS_SCHEMA_INVALID',
  message,
  path: 'evidenceResolution',
  details,
  inputSnapshot: outcome.result.inputSnapshot,
  executionReceipt: outcome.result.executionReceipt,
  rawResponseHash: outcome.result.rawResponseHash,
});

/**
 * Active product boundary for V2.5-C. The core selector remains available for
 * explicit legacy callers; this wrapper persists the content-addressed view
 * and verifies it against the receipt generated from the exact raw response.
 */
export const runStructuredDiagnosisV2_5 = async (
  report: AuditReportInput,
  options: DiagnosisSelectorOptions,
): Promise<StructuredDiagnosisOutcome> => {
  const outcome = await runStructuredDiagnosisCore(report, options);
  if (!('success' in outcome) || !outcome.success) return outcome;

  const input = outcome.result.inputSnapshot;
  if (!input || !isDiagnosisInputPackageV2_5(input)) return outcome;
  const rawDiagnosis = outcome.result.rawDiagnosis;
  if (!rawDiagnosis) {
    return internalFailure(
      'Alias-aware diagnosis completed without a preserved raw diagnosis.',
      outcome,
      { reason: 'missing_raw_diagnosis' },
    );
  }

  const resolution = resolveDiagnosisEvidenceAliasesV1(rawDiagnosis, input.evidenceAliasMap);
  if (resolution.errors.length > 0) {
    return internalFailure(
      'Alias-aware diagnosis could not be reconstructed after pipeline success.',
      outcome,
      { validationErrors: resolution.errors },
    );
  }
  const stableEffective = buildStableEffectiveDiagnosis(outcome.result.diagnosis, input);
  if (stableEffective.errors.length > 0) {
    return internalFailure(
      'Effective diagnosis contains evidence refs missing from the stable identity map.',
      outcome,
      { errors: stableEffective.errors },
    );
  }
  if (
    outcome.result.executionReceipt?.resolvedCitationsHash
    !== resolution.resolvedCitationsHash
  ) {
    return internalFailure(
      'Execution receipt does not certify the reconstructed citation resolution.',
      outcome,
      {
        receipt: outcome.result.executionReceipt?.resolvedCitationsHash ?? null,
        reconstructed: resolution.resolvedCitationsHash,
      },
    );
  }

  return {
    success: true,
    result: {
      ...outcome.result,
      evidenceResolution: {
        aliasContract: 'aura.evidence-alias.v1',
        aliasMapHash: input.evidenceAliasMapHash,
        projectionHash: input.projectionHash,
        resolvedCitationsHash: resolution.resolvedCitationsHash,
        citations: resolution.citations,
        stableDiagnosis: stableEffective.diagnosis,
      },
    },
  };
};
