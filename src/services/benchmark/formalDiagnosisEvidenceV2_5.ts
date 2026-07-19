import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import {
  isDiagnosisInputPackageV2_5,
  type DiagnosisInputPackageV2_5,
} from '../../contracts/llm/diagnosisEvidenceIdentityV1';
import {
  processDiagnosisResponseV2_5,
} from '../../contracts/llm/diagnosisProjectedPipelineV2_5';
import { validateExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { parseDiagnosisResponseV2 } from '../../contracts/llm/diagnosisParserV2';
import { sha256hex } from '../../contracts/llm/hash';
import type {
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  ExecutionReceiptV1,
} from '../../contracts/llm/types';
import {
  extractFormalDiagnosisEvidence,
  extractUnsupportedClaims,
  type AnchorEvidence,
  type FormalDiagnosisEvidence,
} from './formalDiagnosisEvidence';
import type { ExperimentRunV1 } from './experimentTypes';

export interface CompatibleFormalDiagnosisEvidence {
  evidence: FormalDiagnosisEvidence;
  resolvedDiagnosis: DiagnosisResponseV2;
}

const emptyAnchors = (): AnchorEvidence => ({
  anchoredEvidenceRefs: [],
  anchoredBadSampleRefs: [],
  allowedEvidenceRefsByIssueId: new Map(),
  allowedBadSampleRefsByIssueId: new Map(),
});

const buildAliasAwareAnchors = (
  diagnosis: DiagnosisResponseV2,
  input: DiagnosisInputPackageV2_5,
): AnchorEvidence => {
  const byAlias = new Map(input.evidenceAliasMap.entries.map((entry) => [entry.alias, entry]));
  const allowedEvidenceRefsByIssueId = new Map<string, Set<string>>();
  const allowedBadSampleRefsByIssueId = new Map<string, Set<string>>();

  for (const entry of input.evidenceAliasMap.entries) {
    const allowed = allowedEvidenceRefsByIssueId.get(entry.issueId) ?? new Set<string>();
    allowed.add(entry.sourceEvidenceRef);
    allowedEvidenceRefsByIssueId.set(entry.issueId, allowed);
    if (input.inputMode === 'recommended') {
      const badAllowed = allowedBadSampleRefsByIssueId.get(entry.issueId) ?? new Set<string>();
      badAllowed.add(entry.sourceEvidenceRef);
      allowedBadSampleRefsByIssueId.set(entry.issueId, badAllowed);
    }
  }

  const anchoredEvidenceRefs: string[] = [];
  const anchoredBadSampleRefs: string[] = [];
  for (const issue of diagnosis.issues) {
    for (const alias of issue.evidenceRefs) {
      const entry = byAlias.get(alias);
      if (!entry || entry.issueId !== issue.issueId) continue;
      anchoredEvidenceRefs.push(entry.sourceEvidenceRef);
      if (input.inputMode === 'recommended') {
        anchoredBadSampleRefs.push(entry.sourceEvidenceRef);
      }
    }
  }

  return {
    anchoredEvidenceRefs: [...new Set(anchoredEvidenceRefs)],
    anchoredBadSampleRefs: [...new Set(anchoredBadSampleRefs)],
    allowedEvidenceRefsByIssueId,
    allowedBadSampleRefsByIssueId,
  };
};

const verifyRawAndReceipt = (
  diagnosis: DiagnosisResponseV2,
  run: ExperimentRunV1,
  receipt: ExecutionReceiptV1 | null | undefined,
): string[] => {
  const errors: string[] = [];
  const rawOutput = run.diagnosis?.rawOutput ?? '';
  if (!receipt) {
    errors.push('execution receipt is missing — formal runs must have an executionReceipt');
  } else {
    if (sha256hex(rawOutput) !== receipt.rawResponseHash) {
      errors.push('rawOutput hash does not match receipt.rawResponseHash');
    }
    const receiptValidation = validateExecutionReceiptV1(
      receipt,
      run.input,
      exactDiagnosisPromptV2(run.input),
      run.environment.inference,
    );
    errors.push(...receiptValidation.errors);
    if (receipt.validationStatus !== 'valid') {
      errors.push(`receipt validationStatus is ${receipt.validationStatus}`);
    }
    if (receipt.requestedModel !== run.modelId) {
      errors.push(`receipt requestedModel (${receipt.requestedModel}) != run.modelId (${run.modelId})`);
    }
    if (receipt.observedModel !== null && receipt.observedModel !== run.modelId) {
      errors.push(`receipt observedModel (${receipt.observedModel}) != run.modelId (${run.modelId})`);
    }
  }

  const parsed = parseDiagnosisResponseV2(rawOutput);
  if (!parsed.success) {
    const failure = parsed as { success: false; error: { code: string; message: string } };
    errors.push(`rawOutput parse failed: ${failure.error.code} — ${failure.error.message}`);
  } else if (JSON.stringify(parsed.response) !== JSON.stringify(diagnosis)) {
    errors.push('parsed rawOutput differs from diagnosis.parsedOutput');
  }
  return errors;
};

const extractAliasAwareEvidence = (
  diagnosis: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  run: ExperimentRunV1,
  receipt?: ExecutionReceiptV1 | null,
): CompatibleFormalDiagnosisEvidence => {
  const input = run.input as DiagnosisInputPackageV2_5;
  const contractErrors = verifyRawAndReceipt(diagnosis, run, receipt);
  const outcome = processDiagnosisResponseV2_5(
    envelope,
    JSON.stringify(diagnosis),
    input,
  );

  contractErrors.push(...(run.diagnosis?.validationErrors ?? []).map(
    (entry) => `${entry.code}: ${entry.message}`,
  ));

  if (!outcome.success) {
    const details = outcome.details as {
      validationErrors?: Array<{ code?: string; message?: string }>;
    } | null;
    const validationErrors = details?.validationErrors ?? [];
    if (validationErrors.length > 0) {
      contractErrors.push(...validationErrors.map((entry) => (
        `${entry.code ?? outcome.code}: ${entry.message ?? outcome.message}`
      )));
    } else {
      contractErrors.push(`${outcome.code}: ${outcome.message}`);
    }
    return {
      evidence: {
        contract: { contractCompliant: false, contractErrors },
        anchors: emptyAnchors(),
        unsupportedClaims: extractUnsupportedClaims(diagnosis, run),
      },
      resolvedDiagnosis: diagnosis,
    };
  }

  if (!outcome.rawValidation.valid) {
    contractErrors.push(...outcome.rawValidation.errorCodes.map(
      (code) => `${code}: raw provider response required deterministic normalization`,
    ));
  }

  return {
    evidence: {
      contract: {
        contractCompliant: contractErrors.length === 0,
        contractErrors,
      },
      anchors: buildAliasAwareAnchors(diagnosis, input),
      unsupportedClaims: extractUnsupportedClaims(diagnosis, run),
    },
    resolvedDiagnosis: outcome.response,
  };
};

/**
 * Formal evaluator compatibility boundary. Historical campaign artifacts keep
 * the original evaluator; V2.5-C snapshots use alias-aware validation and
 * expose a resolved diagnosis for oracle scoring without rewriting raw output.
 */
export const extractCompatibleFormalDiagnosisEvidence = (
  diagnosis: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  run: ExperimentRunV1,
  receipt?: ExecutionReceiptV1 | null,
): CompatibleFormalDiagnosisEvidence => {
  if (!isDiagnosisInputPackageV2_5(run.input)) {
    return {
      evidence: extractFormalDiagnosisEvidence(diagnosis, envelope, run, receipt),
      resolvedDiagnosis: diagnosis,
    };
  }
  return extractAliasAwareEvidence(diagnosis, envelope, run, receipt);
};
