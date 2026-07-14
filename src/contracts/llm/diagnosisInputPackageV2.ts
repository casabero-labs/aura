import { sha256hex } from './hash';
import {
  buildDiagnosisSystemInstructionV2,
  buildDiagnosisResponseSchemaV2,
  buildEnvelopeRef,
  canonicalJson,
  composeExactDiagnosisPromptV2,
  DIAGNOSIS_PROMPT_VERSION_V2,
} from './diagnosisPromptV2';
import { computeIssueIdsRequiringHumanReview } from './humanReviewPolicyV2';
import type {
  DiagnosisInputModeV2,
  DiagnosisInputPackageV2,
  EvidenceEnvelopeV2,
} from './types';

export const DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE = {
  prompt_libre: ['dataset_summary', 'dataset_schema', 'issue_registry_minimal'],
  smart_sample: [
    'dataset_summary', 'dataset_schema', 'issue_registry_minimal',
    'column_statistics', 'rule_activations', 'evidence_samples',
  ],
  recommended: [
    'dataset_summary', 'dataset_schema', 'issue_registry_minimal',
    'column_registry', 'column_statistics', 'rule_activations', 'evidence_samples',
    'actionability_policy', 'authorization_evidence', 'selection_manifest',
    'truncation_manifest', 'bad_sample_anchors',
  ],
} as const satisfies Record<DiagnosisInputModeV2, readonly string[]>;

const MODES: readonly DiagnosisInputModeV2[] = ['prompt_libre', 'smart_sample', 'recommended'];

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const datasetSummary = (envelope: EvidenceEnvelopeV2) => ({
  rowCount: envelope.datasetSummary.rowCount,
  colCount: envelope.datasetSummary.colCount,
  delimiter: envelope.datasetSummary.delimiter,
});

const datasetSchema = (envelope: EvidenceEnvelopeV2) => envelope.columns.map((column) => ({
  columnId: column.columnId,
  name: column.name,
  position: column.position,
}));

const issueRegistryMinimal = (envelope: EvidenceEnvelopeV2) => envelope.issues.map((issue) => ({
  issueId: issue.issueId,
  ruleId: issue.ruleId,
  columnId: issue.columnId,
  scope: issue.scope,
  category: issue.category,
  severity: issue.severity,
  count: issue.count,
  affectedPercentage: issue.affectedPercentage,
}));

const columnStatistics = (envelope: EvidenceEnvelopeV2) => Object.fromEntries(
  Object.entries(envelope.evidence.columnStats).map(([columnId, stats]) => [columnId, stats]),
);

const ruleActivations = (envelope: EvidenceEnvelopeV2) => envelope.issues.map((issue) => ({
  ...issueRegistryMinimal({ ...envelope, issues: [issue] } as EvidenceEnvelopeV2)[0],
  ruleName: issue.ruleName,
  description: issue.description,
  evidenceRefs: issue.evidenceRefs,
}));

const evidenceSamples = (envelope: EvidenceEnvelopeV2) => envelope.evidence.samples.map((sample) => ({
  evidenceRef: sample.evidenceRef,
  issueId: sample.issueId,
  columnId: sample.columnId,
  values: sample.values,
}));

const visibleEvidence = (envelope: EvidenceEnvelopeV2, inputMode: DiagnosisInputModeV2) => {
  const minimal = {
    datasetSummary: datasetSummary(envelope),
    datasetSchema: datasetSchema(envelope),
    issueRegistryMinimal: issueRegistryMinimal(envelope),
  };
  if (inputMode === 'prompt_libre') return minimal;
  const balanced = {
    ...minimal,
    columnStatistics: columnStatistics(envelope),
    ruleActivations: ruleActivations(envelope),
    evidenceSamples: evidenceSamples(envelope),
  };
  if (inputMode === 'smart_sample') return balanced;
  return {
    ...balanced,
    columnRegistry: envelope.columns,
    actionabilityPolicy: envelope.issues.map(({ issueId, ruleId, actionability }) => ({ issueId, ruleId, actionability })),
    authorizationEvidence: envelope.issues.map(({ issueId, automaticAuthorization }) => ({ issueId, automaticAuthorization })),
    selectionManifest: envelope.selectionManifest,
    truncationManifest: envelope.truncationManifest,
    badSampleAnchors: evidenceSamples(envelope).map((sample) => ({ ...sample, quoteExactly: true })),
  };
};

export interface DiagnosisInputReport {
  score: number;
  rowCount: number;
  colCount: number;
  duplicateRows: number;
  delimiterDetected: string;
}

const assertReportMatchesEnvelope = (report: DiagnosisInputReport, envelope: EvidenceEnvelopeV2): void => {
  const summary = envelope.datasetSummary;
  if (
    report.rowCount !== summary.rowCount
    || report.colCount !== summary.colCount
    || report.delimiterDetected !== summary.delimiter
    || report.score !== summary.score
    || report.duplicateRows !== summary.duplicateRows
  ) throw new Error('Audit report and evidence envelope do not describe the same dataset state.');
};

export const exactDiagnosisPromptV2 = (
  input: Pick<DiagnosisInputPackageV2, 'systemInstruction' | 'userPayload' | 'responseSchema'>,
): string => composeExactDiagnosisPromptV2(
  input.systemInstruction,
  input.userPayload,
  input.responseSchema,
);

export const buildDiagnosisInputPackageV2 = (
  report: DiagnosisInputReport,
  envelope: EvidenceEnvelopeV2,
  inputMode: DiagnosisInputModeV2,
): DiagnosisInputPackageV2 => {
  if (!MODES.includes(inputMode)) throw new Error(`Unsupported diagnosis input mode: ${String(inputMode)}`);
  assertReportMatchesEnvelope(report, envelope);
  const evidenceEnvelopeRef = buildEnvelopeRef(envelope);
  const requiredIssueIds = envelope.issues.map((issue) => issue.issueId);
  const issueIdsWithoutEvidenceRefs = envelope.issues
    .filter((issue) => issue.evidenceRefs.length === 0)
    .map((issue) => issue.issueId);
  const issueIdsRequiringHumanReview = computeIssueIdsRequiringHumanReview(envelope);
  const includedSections = [...DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE[inputMode]];
  const systemInstruction = buildDiagnosisSystemInstructionV2();
  const userPayload = canonicalJson({
    inputMode,
    evidenceEnvelopeRef,
    visibleEvidence: visibleEvidence(envelope, inputMode),
    task: {
      responseContract: 'aura.diagnosis.v2',
      exactCoverageRequired: true,
      expectedIssueCount: requiredIssueIds.length,
      expectedDiagnosisBlockCount: requiredIssueIds.length,
      requiredIssueIds,
      issueIdsWithoutEvidenceRefs,
      issueIdsRequiringHumanReview,
      humanReviewInstruction: 'For every issueId in issueIdsRequiringHumanReview you MUST set requiresHumanReview=true. For issueIds outside that list you may still set requiresHumanReview=true when in doubt, but you MUST NOT return requiresHumanReview=false for any ID in that list.',
      exactCoverageInstruction: 'Produce exactly one issues item and exactly one diagnosisBlocks item for every required issueId. Do not omit or duplicate any required issueId.',
      visualizationInstruction: 'visualizations.issueIds may use only requiredIssueIds. Use [] when no chart is justified.',
      evidenceRefsRequiredOnlyWhenVisible: true,
      samplesVisible: inputMode !== 'prompt_libre',
      whenSamplesAreHidden: inputMode === 'prompt_libre' ? {
        evidenceRefsMustBeEmpty: true,
        requiresHumanReviewMustBeTrue: true,
        declareEvidenceLimitation: true,
      } : undefined,
      prohibitUnsupportedClaims: true,
    },
  });
  const responseSchema = buildDiagnosisResponseSchemaV2(envelope);
  const promptVersion = DIAGNOSIS_PROMPT_VERSION_V2;
  const promptHash = sha256hex(composeExactDiagnosisPromptV2(systemInstruction, userPayload, responseSchema));
  const responseSchemaHash = sha256hex(canonicalJson(responseSchema));
  const stable = {
    contractId: 'aura.input-snapshot.v2' as const,
    contractVersion: '2.0.0' as const,
    inputMode,
    includedSections,
    systemInstruction,
    userPayload,
    responseSchema,
    evidenceEnvelopeRef,
    promptVersion,
    promptHash,
    responseSchemaHash,
  };
  return deepFreeze({
    ...stable,
    inputHash: sha256hex(canonicalJson(stable)),
  });
};
