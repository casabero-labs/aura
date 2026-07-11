import type { AuditReport } from '../../types';
import {
  buildDiagnosisSystemInstructionV2,
  buildEnvelopeRef,
  canonicalJson,
  DIAGNOSIS_PROMPT_VERSION_V2,
  DIAGNOSIS_RESPONSE_SCHEMA_V2,
} from '../../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../../contracts/llm/hash';
import type { EvidenceEnvelopeV2 } from '../../contracts/llm/types';
import type { InputContractSnapshotV1 } from './experimentTypes';
import {
  OE4_INPUT_MODES,
  type OE4InputMode,
} from './finalEvaluationProtocol';

export const OE4_INCLUDED_SECTIONS_BY_MODE = {
  prompt_libre: [
    'dataset_summary',
    'dataset_schema',
  ],
  smart_sample: [
    'dataset_summary',
    'dataset_schema',
    'column_statistics',
    'rule_activations',
    'evidence_samples',
  ],
  recommended: [
    'dataset_summary',
    'dataset_schema',
    'column_registry',
    'column_statistics',
    'rule_activations',
    'evidence_samples',
    'actionability_policy',
    'authorization_evidence',
    'selection_manifest',
    'truncation_manifest',
    'bad_sample_anchors',
  ],
} as const satisfies Record<OE4InputMode, readonly string[]>;

const COMMON_TASK = {
  responseContract: 'aura.diagnosis.v2',
  rules: [
    'Use only the evidence made visible in this input mode.',
    'Never invent columns, rules, values, evidence references or unsupported claims.',
    'When support is absent, omit the claim and disclose the limitation.',
    'Return one JSON object only and preserve evidenceEnvelopeRef exactly.',
  ],
} as const;

const datasetSummary = (envelope: EvidenceEnvelopeV2) => ({
  rowCount: envelope.datasetSummary.rowCount,
  colCount: envelope.datasetSummary.colCount,
  delimiter: envelope.datasetSummary.delimiter,
});

const datasetSchema = (envelope: EvidenceEnvelopeV2) =>
  envelope.columns.map((column) => ({
    columnId: column.columnId,
    name: column.name,
    position: column.position,
  }));

const columnStatistics = (envelope: EvidenceEnvelopeV2) =>
  Object.fromEntries(
    Object.entries(envelope.evidence.columnStats).map(([columnId, stats]) => [
      columnId,
      {
        inferredType: stats.inferredType,
        semanticType: stats.semanticType,
        distinctCount: stats.distinctCount,
        nullCount: stats.nullCount,
        nullPercentage: stats.nullPercentage,
        topValues: stats.topValues,
        stats: stats.stats,
      },
    ]),
  );

const ruleActivations = (envelope: EvidenceEnvelopeV2) =>
  envelope.issues.map((issue) => ({
    issueId: issue.issueId,
    ruleId: issue.ruleId,
    ruleName: issue.ruleName,
    description: issue.description,
    columnId: issue.columnId,
    scope: issue.scope,
    category: issue.category,
    severity: issue.severity,
    count: issue.count,
    affectedPercentage: issue.affectedPercentage,
    evidenceRefs: issue.evidenceRefs,
  }));

const evidenceSamples = (envelope: EvidenceEnvelopeV2) =>
  envelope.evidence.samples.map((sample) => ({
    evidenceRef: sample.evidenceRef,
    issueId: sample.issueId,
    columnId: sample.columnId,
    values: sample.values,
  }));

const buildVisibleEvidence = (
  envelope: EvidenceEnvelopeV2,
  mode: OE4InputMode,
): Record<string, unknown> => {
  const minimal = {
    datasetSummary: datasetSummary(envelope),
    datasetSchema: datasetSchema(envelope),
  };
  if (mode === 'prompt_libre') return minimal;

  const structured = {
    ...minimal,
    columnStatistics: columnStatistics(envelope),
    ruleActivations: ruleActivations(envelope),
    evidenceSamples: evidenceSamples(envelope),
  };
  if (mode === 'smart_sample') return structured;

  return {
    ...structured,
    columnRegistry: envelope.columns,
    actionabilityPolicy: envelope.issues.map((issue) => ({
      issueId: issue.issueId,
      ruleId: issue.ruleId,
      actionability: issue.actionability,
    })),
    authorizationEvidence: envelope.issues.map((issue) => ({
      issueId: issue.issueId,
      automaticAuthorization: issue.automaticAuthorization,
    })),
    selectionManifest: envelope.selectionManifest,
    truncationManifest: envelope.truncationManifest,
    badSampleAnchors: envelope.evidence.samples.map((sample) => {
      const issue = envelope.issues.find((candidate) => candidate.issueId === sample.issueId);
      return {
        evidenceRef: sample.evidenceRef,
        issueId: sample.issueId,
        ruleId: issue?.ruleId ?? null,
        columnId: sample.columnId,
        values: sample.values,
        quoteExactly: true,
      };
    }),
  };
};

const assertReportMatchesEnvelope = (
  report: AuditReport,
  envelope: EvidenceEnvelopeV2,
): void => {
  const summary = envelope.datasetSummary;
  if (
    report.rowCount !== summary.rowCount
    || report.colCount !== summary.colCount
    || report.delimiterDetected !== summary.delimiter
    || report.score !== summary.score
    || report.duplicateRows !== summary.duplicateRows
  ) {
    throw new Error('Audit report and evidence envelope do not describe the same dataset state.');
  }
};

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
};

export const buildExperimentInputPackage = (
  report: AuditReport,
  envelope: EvidenceEnvelopeV2,
  mode: OE4InputMode,
): InputContractSnapshotV1 => {
  if (!OE4_INPUT_MODES.includes(mode)) {
    throw new Error(`Unsupported OE4 input mode: ${String(mode)}`);
  }
  assertReportMatchesEnvelope(report, envelope);

  const evidenceEnvelopeRef = buildEnvelopeRef(envelope);
  const includedSections = [...OE4_INCLUDED_SECTIONS_BY_MODE[mode]];
  const systemInstruction = buildDiagnosisSystemInstructionV2();
  const userPayload = canonicalJson({
    mode,
    evidenceEnvelopeRef,
    visibleEvidence: buildVisibleEvidence(envelope, mode),
    task: COMMON_TASK,
  });
  const responseSchema = JSON.parse(
    canonicalJson(DIAGNOSIS_RESPONSE_SCHEMA_V2),
  ) as Record<string, unknown>;
  const promptVersion = DIAGNOSIS_PROMPT_VERSION_V2;
  const promptHash = sha256hex(`${systemInstruction}\n\n${userPayload}`);
  const responseSchemaHash = sha256hex(canonicalJson(responseSchema));
  const inputHash = sha256hex(canonicalJson({
    mode,
    evidenceEnvelopeRef,
    includedSections,
    systemInstruction,
    userPayload,
    responseSchema,
    promptVersion,
    promptHash,
  }));

  return deepFreeze({
    contractId: 'aura.input-snapshot.v1',
    mode,
    evidenceEnvelopeRef,
    includedSections,
    systemInstruction,
    userPayload,
    responseSchema,
    promptVersion,
    promptHash,
    inputHash,
    responseSchemaHash,
  });
};
