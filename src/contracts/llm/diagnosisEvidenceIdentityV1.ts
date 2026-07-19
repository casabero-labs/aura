import { sha256hex } from './hash';
import { canonicalJson } from './diagnosisPromptV2';
import type {
  DiagnosisInputModeV2,
  DiagnosisInputPackageV2,
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  EvidenceSampleV2,
  ValidationErrorV2,
} from './types';

export const EVIDENCE_ALIAS_CONTRACT_V1 = 'aura.evidence-alias.v1' as const;
export const EVIDENCE_ALIAS_MAP_CONTRACT_V1 = 'aura.evidence-alias-map.v1' as const;

export interface EvidenceAliasEntryV1 {
  alias: string;
  sourceEvidenceRef: string;
  stableEvidenceRef: string;
  issueId: string;
  columnId: string | null;
}

export interface EvidenceAliasMapV1 {
  contractId: typeof EVIDENCE_ALIAS_MAP_CONTRACT_V1;
  contractVersion: '1.0.0';
  entries: EvidenceAliasEntryV1[];
}

export interface DiagnosisInputPackageV2_5 extends DiagnosisInputPackageV2 {
  evidenceAliasContract: typeof EVIDENCE_ALIAS_CONTRACT_V1;
  evidenceAliasMap: EvidenceAliasMapV1;
  evidenceAliasMapHash: string;
  projectionHash: string;
}

export interface ResolvedEvidenceCitationV1 extends EvidenceAliasEntryV1 {}

export interface EvidenceAliasResolutionV1 {
  response: DiagnosisResponseV2;
  citations: ResolvedEvidenceCitationV1[];
  errors: ValidationErrorV2[];
}

const normalizeCanonicalValue = (value: unknown): unknown => {
  if (typeof value === 'string') return value.normalize('NFKC');
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeCanonicalValue(entry)]),
    );
  }
  return value;
};

const stableIssueMaterial = (
  envelope: EvidenceEnvelopeV2,
  sample: EvidenceSampleV2,
): Record<string, unknown> => {
  const issue = envelope.issues.find((candidate) => candidate.issueId === sample.issueId);
  if (!issue) {
    throw new Error(`Cannot build stable evidence identity for unknown issueId: ${sample.issueId}`);
  }
  return {
    algorithmVersion: EVIDENCE_ALIAS_CONTRACT_V1,
    issueId: issue.issueId,
    ruleId: issue.ruleId,
    columnId: issue.columnId,
    scope: issue.scope,
  };
};

const stableSampleMaterial = (
  envelope: EvidenceEnvelopeV2,
  sample: EvidenceSampleV2,
): Record<string, unknown> => ({
  algorithmVersion: EVIDENCE_ALIAS_CONTRACT_V1,
  privacyLevel: envelope.privacyPolicy.level,
  issueId: sample.issueId,
  columnId: sample.columnId,
  values: normalizeCanonicalValue(sample.values),
  metadata: normalizeCanonicalValue(sample.metadata),
});

/**
 * Content-addressed identity derived only from the privacy-processed evidence
 * stored in the envelope. Raw source values are never reintroduced here.
 */
export const buildStableEvidenceRefV1 = (
  envelope: EvidenceEnvelopeV2,
  sample: EvidenceSampleV2,
): string => {
  const issueDigest = sha256hex(canonicalJson(stableIssueMaterial(envelope, sample))).slice(0, 16);
  const sampleDigest = sha256hex(canonicalJson(stableSampleMaterial(envelope, sample))).slice(0, 24);
  return `ev:v1:${issueDigest}:${sampleDigest}`;
};

const visibleSourceRefs = (
  envelope: EvidenceEnvelopeV2,
  inputMode: DiagnosisInputModeV2,
): Set<string> => inputMode === 'prompt_libre'
  ? new Set<string>()
  : new Set(envelope.evidence.samples.map((sample) => sample.evidenceRef));

/**
 * Aliases are deterministic for one semantic projection. Sorting by stable
 * identity makes them independent from the original global ordinal refs.
 */
export const buildEvidenceAliasMapV1 = (
  envelope: EvidenceEnvelopeV2,
  inputMode: DiagnosisInputModeV2,
): EvidenceAliasMapV1 => {
  const visible = visibleSourceRefs(envelope, inputMode);
  const candidates = envelope.evidence.samples
    .filter((sample) => visible.has(sample.evidenceRef))
    .map((sample) => ({
      sourceEvidenceRef: sample.evidenceRef,
      stableEvidenceRef: buildStableEvidenceRefV1(envelope, sample),
      issueId: sample.issueId,
      columnId: sample.columnId,
    }))
    .sort((left, right) => (
      left.issueId.localeCompare(right.issueId)
      || left.stableEvidenceRef.localeCompare(right.stableEvidenceRef)
      || left.sourceEvidenceRef.localeCompare(right.sourceEvidenceRef)
    ));

  const unique = new Map<string, Omit<EvidenceAliasEntryV1, 'alias'>>();
  for (const candidate of candidates) {
    const key = `${candidate.issueId}\u0000${candidate.stableEvidenceRef}`;
    const existing = unique.get(key);
    if (existing && canonicalJson(existing) !== canonicalJson(candidate)) {
      throw new Error(`Stable evidence collision detected for ${candidate.stableEvidenceRef}`);
    }
    if (!existing) unique.set(key, candidate);
  }

  return {
    contractId: EVIDENCE_ALIAS_MAP_CONTRACT_V1,
    contractVersion: '1.0.0',
    entries: [...unique.values()].map((entry, index) => ({
      alias: `e${index + 1}`,
      ...entry,
    })),
  };
};

export const buildEvidenceAliasMapHashV1 = (aliasMap: EvidenceAliasMapV1): string =>
  sha256hex(canonicalJson(aliasMap));

export const isDiagnosisInputPackageV2_5 = (
  value: DiagnosisInputPackageV2 | null | undefined,
): value is DiagnosisInputPackageV2_5 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as DiagnosisInputPackageV2_5;
  return candidate.evidenceAliasContract === EVIDENCE_ALIAS_CONTRACT_V1
    && candidate.evidenceAliasMap?.contractId === EVIDENCE_ALIAS_MAP_CONTRACT_V1
    && typeof candidate.evidenceAliasMapHash === 'string'
    && typeof candidate.projectionHash === 'string';
};

const aliasLookup = (aliasMap: EvidenceAliasMapV1): Map<string, EvidenceAliasEntryV1> =>
  new Map(aliasMap.entries.map((entry) => [entry.alias, entry]));

export const resolveDiagnosisEvidenceAliasesV1 = (
  response: DiagnosisResponseV2,
  aliasMap: EvidenceAliasMapV1,
): EvidenceAliasResolutionV1 => {
  const aliases = aliasLookup(aliasMap);
  const citations: ResolvedEvidenceCitationV1[] = [];
  const errors: ValidationErrorV2[] = [];
  const issues = response.issues.map((issue, issueIndex) => {
    const seen = new Set<string>();
    const resolvedRefs: string[] = [];
    issue.evidenceRefs.forEach((alias, refIndex) => {
      const entry = aliases.get(alias);
      const path = `issues[${issueIndex}].evidenceRefs[${refIndex}]`;
      if (!entry) {
        errors.push({
          code: 'DIAGNOSIS_ALIAS_REFERENCE_INVALID',
          path,
          message: 'Evidence alias does not exist in the input projection.',
          value: alias,
        });
        return;
      }
      if (entry.issueId !== issue.issueId) {
        errors.push({
          code: 'DIAGNOSIS_ALIAS_PROJECTION_MISMATCH',
          path,
          message: 'Evidence alias belongs to a different issue.',
          value: { alias, expectedIssueId: issue.issueId, actualIssueId: entry.issueId },
        });
        return;
      }
      if (seen.has(alias)) {
        errors.push({
          code: 'DIAGNOSIS_ALIAS_DUPLICATE',
          path,
          message: 'Evidence alias is duplicated inside the same issue.',
          value: alias,
        });
        return;
      }
      seen.add(alias);
      resolvedRefs.push(entry.sourceEvidenceRef);
      citations.push({ ...entry });
    });
    return { ...issue, evidenceRefs: resolvedRefs };
  });

  return {
    response: { ...response, issues },
    citations,
    errors,
  };
};
