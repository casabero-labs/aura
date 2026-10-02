import { sha256hex } from './hash';
import {
  buildDiagnosisInputPackageV2 as buildDiagnosisInputPackageV2Legacy,
} from './diagnosisInputPackageV2';
import {
  canonicalJson,
  composeExactDiagnosisPromptV2,
} from './diagnosisPromptV2';
import {
  EVIDENCE_ALIAS_CONTRACT_V1,
  buildEvidenceAliasMapHashV1,
  buildEvidenceAliasMapV1,
  isDiagnosisInputPackageV2_5,
  type DiagnosisInputPackageV2_5,
  type EvidenceAliasMapV1,
} from './diagnosisEvidenceIdentityV1';
import type {
  DiagnosisInputModeV2,
  DiagnosisInputPackageV2,
  DiagnosisPromptOptionsV2,
  EvidenceEnvelopeV2,
  ValidationErrorV2,
  ValidationResultV2,
} from './types';
import type { DiagnosisInputReport } from './diagnosisInputPackageCoreV2';

export const DIAGNOSIS_PROMPT_VERSION_V2_5 = '1.8.0';

const ALIAS_INSTRUCTION = `

11. EVIDENCE ALIAS MODE:
    - evidenceRefs in your response MUST contain only the short aliases exposed in the visible projection, such as "e1" or "e2".
    - Never return internal refs beginning with "ev-" or "ev:v1:".
    - An alias may only be cited by the issueId to which AURA assigned it.
    - When no aliases are visible, evidenceRefs MUST be [].`;

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const aliasBySourceRef = (aliasMap: EvidenceAliasMapV1): Map<string, string> =>
  new Map(aliasMap.entries.map((entry) => [entry.sourceEvidenceRef, entry.alias]));

const projectVisibleEvidenceWithAliases = (
  visibleEvidence: Record<string, unknown>,
  aliasMap: EvidenceAliasMapV1,
): Record<string, unknown> => {
  const sourceToAlias = aliasBySourceRef(aliasMap);
  const ruleActivations = Array.isArray(visibleEvidence.ruleActivations)
    ? visibleEvidence.ruleActivations.map((activation) => {
        const record = activation as Record<string, unknown>;
        const refs = Array.isArray(record.evidenceRefs)
          ? record.evidenceRefs
            .map((ref) => sourceToAlias.get(String(ref)))
            .filter((ref): ref is string => typeof ref === 'string')
          : [];
        return { ...record, evidenceRefs: refs };
      })
    : undefined;
  const evidenceSamples = Array.isArray(visibleEvidence.evidenceSamples)
    ? visibleEvidence.evidenceSamples.flatMap((sample) => {
        const record = sample as Record<string, unknown>;
        const alias = sourceToAlias.get(String(record.evidenceRef ?? ''));
        return alias ? [{ ...record, evidenceRef: alias }] : [];
      })
    : undefined;
  const badSampleAnchors = Array.isArray(visibleEvidence.badSampleAnchors)
    ? visibleEvidence.badSampleAnchors.flatMap((sample) => {
        const record = sample as Record<string, unknown>;
        const alias = sourceToAlias.get(String(record.evidenceRef ?? ''));
        return alias ? [{ ...record, evidenceRef: alias }] : [];
      })
    : undefined;

  return {
    ...visibleEvidence,
    ...(ruleActivations !== undefined ? { ruleActivations } : {}),
    ...(evidenceSamples !== undefined ? { evidenceSamples } : {}),
    ...(badSampleAnchors !== undefined ? { badSampleAnchors } : {}),
  };
};

const aliasesByIssueId = (aliasMap: EvidenceAliasMapV1): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {};
  for (const entry of aliasMap.entries) {
    grouped[entry.issueId] = [...(grouped[entry.issueId] ?? []), entry.alias];
  }
  return grouped;
};

const applyAliasResponseSchema = (
  responseSchema: Record<string, unknown>,
  aliasMap: EvidenceAliasMapV1,
  inputMode: DiagnosisInputModeV2,
): Record<string, unknown> => {
  const schema = JSON.parse(canonicalJson(responseSchema)) as Record<string, unknown>;
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const issueItems = properties.issues.items as Record<string, unknown>;
  const issueProperties = issueItems.properties as Record<string, Record<string, unknown>>;
  const evidenceRefs = issueProperties.evidenceRefs;
  const evidenceRefItems = evidenceRefs.items as Record<string, unknown>;
  if (inputMode === 'prompt_libre') {
    evidenceRefs.maxItems = 0;
    delete evidenceRefItems.enum;
  } else {
    evidenceRefItems.enum = aliasMap.entries.map((entry) => entry.alias);
  }
  return schema;
};

const inputHashMaterial = (
  snapshot: Omit<DiagnosisInputPackageV2_5, 'inputHash'>,
): Omit<DiagnosisInputPackageV2_5, 'inputHash'> => snapshot;

export const buildDiagnosisInputPackageV2_5 = (
  report: DiagnosisInputReport,
  envelope: EvidenceEnvelopeV2,
  inputMode: DiagnosisInputModeV2,
  options?: DiagnosisPromptOptionsV2,
): DiagnosisInputPackageV2_5 => {
  const base = buildDiagnosisInputPackageV2Legacy(report, envelope, inputMode, options);
  const aliasMap = buildEvidenceAliasMapV1(envelope, inputMode);
  const parsedPayload = JSON.parse(base.userPayload) as {
    visibleEvidence?: Record<string, unknown>;
    task?: Record<string, unknown>;
    [key: string]: unknown;
  };
  const userPayload = canonicalJson({
    ...parsedPayload,
    visibleEvidence: projectVisibleEvidenceWithAliases(parsedPayload.visibleEvidence ?? {}, aliasMap),
    task: {
      ...(parsedPayload.task ?? {}),
      evidenceReferenceMode: EVIDENCE_ALIAS_CONTRACT_V1,
      allowedEvidenceAliasesByIssueId: aliasesByIssueId(aliasMap),
      internalEvidenceRefsVisible: false,
    },
  });
  const responseSchema = applyAliasResponseSchema(base.responseSchema, aliasMap, inputMode);
  const systemInstruction = `${base.systemInstruction}${ALIAS_INSTRUCTION}`;
  const promptVersion = DIAGNOSIS_PROMPT_VERSION_V2_5;
  const promptHash = sha256hex(composeExactDiagnosisPromptV2(
    systemInstruction,
    userPayload,
    responseSchema,
  ));
  const responseSchemaHash = sha256hex(canonicalJson(responseSchema));
  const evidenceAliasMapHash = buildEvidenceAliasMapHashV1(aliasMap);
  const projectionHash = sha256hex(userPayload);
  const stable: Omit<DiagnosisInputPackageV2_5, 'inputHash'> = {
    ...base,
    systemInstruction,
    userPayload,
    responseSchema,
    promptVersion,
    promptHash,
    responseSchemaHash,
    evidenceAliasContract: EVIDENCE_ALIAS_CONTRACT_V1,
    evidenceAliasMap: aliasMap,
    evidenceAliasMapHash,
    projectionHash,
  };

  return deepFreeze({
    ...stable,
    inputHash: sha256hex(canonicalJson(inputHashMaterial(stable))),
  });
};

const reportFromEnvelope = (envelope: EvidenceEnvelopeV2): DiagnosisInputReport => ({
  score: envelope.datasetSummary.score,
  rowCount: envelope.datasetSummary.rowCount,
  colCount: envelope.datasetSummary.colCount,
  duplicateRows: envelope.datasetSummary.duplicateRows,
  delimiterDetected: envelope.datasetSummary.delimiter,
});

const error = (
  code: string,
  path: string,
  message: string,
  value: unknown,
): ValidationErrorV2 => ({ code, path, message, value });

export const validateDiagnosisInputSnapshotIntegrityV2_5 = (
  snapshot: DiagnosisInputPackageV2,
  envelope: EvidenceEnvelopeV2,
): ValidationResultV2 => {
  const errors: ValidationErrorV2[] = [];
  if (!isDiagnosisInputPackageV2_5(snapshot)) {
    return {
      valid: false,
      errors: [error(
        'DIAGNOSIS_INPUT_SNAPSHOT_INVALID',
        'inputSnapshot',
        'Active Diagnosis V2.5 validation requires an alias-aware input snapshot.',
        snapshot.contractId,
      )],
      warnings: [],
    };
  }

  let maxConfidence = 1;
  try {
    const payload = JSON.parse(snapshot.userPayload) as { task?: { maximumConfidence?: unknown } };
    if (typeof payload.task?.maximumConfidence === 'number') {
      maxConfidence = payload.task.maximumConfidence;
    }
  } catch {
    errors.push(error(
      'DIAGNOSIS_INPUT_SNAPSHOT_INVALID',
      'inputSnapshot.userPayload',
      'Input snapshot userPayload is not valid JSON.',
      null,
    ));
    return { valid: false, errors, warnings: [] };
  }

  let expected: DiagnosisInputPackageV2_5;
  try {
    expected = buildDiagnosisInputPackageV2_5(
      reportFromEnvelope(envelope),
      envelope,
      snapshot.inputMode,
      { maxConfidence },
    );
  } catch (cause) {
    errors.push(error(
      'DIAGNOSIS_INPUT_SNAPSHOT_INVALID',
      'inputSnapshot',
      'Could not reconstruct the canonical projection.',
      cause instanceof Error ? cause.message : String(cause),
    ));
    return { valid: false, errors, warnings: [] };
  }

  const checks: Array<[keyof DiagnosisInputPackageV2_5, string]> = [
    ['evidenceEnvelopeRef', 'DIAGNOSIS_ENVELOPE_MISMATCH'],
    ['evidenceAliasMapHash', 'DIAGNOSIS_ALIAS_MAP_HASH_MISMATCH'],
    ['projectionHash', 'DIAGNOSIS_PROJECTION_HASH_MISMATCH'],
    ['promptHash', 'DIAGNOSIS_PROMPT_HASH_MISMATCH'],
    ['responseSchemaHash', 'DIAGNOSIS_SCHEMA_HASH_MISMATCH'],
    ['inputHash', 'DIAGNOSIS_INPUT_HASH_MISMATCH'],
  ];
  for (const [field, code] of checks) {
    if (snapshot[field] !== expected[field]) {
      errors.push(error(
        code,
        `inputSnapshot.${String(field)}`,
        `${String(field)} does not match the canonical projection.`,
        { expected: expected[field], actual: snapshot[field] },
      ));
    }
  }

  for (const field of ['includedSections', 'evidenceAliasMap', 'userPayload', 'responseSchema', 'systemInstruction'] as const) {
    if (canonicalJson(snapshot[field]) !== canonicalJson(expected[field])) {
      errors.push(error(
        'DIAGNOSIS_INPUT_SNAPSHOT_INVALID',
        `inputSnapshot.${field}`,
        `${field} differs from the canonical projection.`,
        null,
      ));
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};
