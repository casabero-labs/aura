import { validateDiagnosisResponseV2 } from '../../contracts/llm/diagnosisValidatorV2';
import { validateExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { parseDiagnosisResponseV2 } from '../../contracts/llm/diagnosisParserV2';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { sha256hex } from '../../contracts/llm/hash';
import type {
  DiagnosisResponseV2,
  DiagnosisInputPackageV2,
  EvidenceEnvelopeV2,
  ExecutionReceiptV1,
  InferenceSnapshotV1,
} from '../../contracts/llm/types';
import type { ExperimentRunV1 } from './experimentTypes';

export interface ContractEvidence {
  contractCompliant: boolean;
  contractErrors: string[];
}

export interface AnchorEvidence {
  anchoredEvidenceRefs: string[];
  anchoredBadSampleRefs: string[];
  allowedEvidenceRefsByIssueId: Map<string, Set<string>>;
  allowedBadSampleRefsByIssueId: Map<string, Set<string>>;
}

export interface UnsupportedClaim {
  text: string;
  claimedValue: number;
  field: 'hypothesis' | 'observation' | 'recommendation' | 'limitations';
  location: string;
}

export interface FormalDiagnosisEvidence {
  contract: ContractEvidence;
  anchors: AnchorEvidence;
  unsupportedClaims: UnsupportedClaim[];
}

interface ParsedUserPayload {
  inputMode?: string;
  visibleEvidence?: {
    datasetSummary?: { rowCount?: number; colCount?: number; delimiter?: string };
    datasetSchema?: Array<{ columnId?: string; name?: string; position?: number }>;
    issueRegistryMinimal?: Array<{
      issueId?: string; ruleId?: string; columnId?: string | null;
      scope?: string; category?: string; severity?: string;
      count?: number; affectedPercentage?: number;
    }>;
    columnStatistics?: Record<string, {
      distinctCount?: number; nullCount?: number; nullPercentage?: number;
    }>;
    evidenceSamples?: Array<{
      evidenceRef?: string; issueId?: string; columnId?: string | null; values?: unknown;
    }>;
    badSampleAnchors?: Array<{
      evidenceRef?: string; issueId?: string; quoteExactly?: boolean;
    }>;
  };
}

const parsePayload = (userPayload: string): ParsedUserPayload | null => {
  try {
    return JSON.parse(userPayload) as ParsedUserPayload;
  } catch {
    return null;
  }
};

const isInstructionalNumber = (text: string, num: number): boolean => {
  const ctx = text.toLowerCase();
  if (/\b(revisar|revisa|review|check|ver|ve)\s+(las?\s+)?\d+\s+(muestras?|samples?|items?|registros?|filas?)\b/i.test(ctx)) return true;
  if (/\b(paso|step|versi[oó]n|version|a[ñn]o|year|nivel|level|fase|phase)\s+\d+\b/i.test(ctx)) return true;
  if (/\bseleccionar\s+\d+|select\s+\d+|tomar\s+\d+|take\s+\d+/i.test(ctx)) return true;
  return false;
};

export const extractContractEvidence = (
  diagnosis: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  run: ExperimentRunV1,
  receipt?: ExecutionReceiptV1 | null,
): ContractEvidence => {
  const errors: string[] = [];

  if (!receipt) {
    errors.push('execution receipt is missing — formal runs must have an executionReceipt');
  }

  const validation = validateDiagnosisResponseV2(diagnosis, envelope);
  if (!validation.valid) {
    errors.push(...validation.errors.map((e) => `${e.code}: ${e.message}`));
  }

  errors.push(...(run.diagnosis?.validationErrors ?? []).map(
    (e) => `${e.code}: ${e.message}`,
  ));

  const rawOutput = run.diagnosis?.rawOutput ?? '';
  if (receipt && sha256hex(rawOutput) !== receipt.rawResponseHash) {
    errors.push('rawOutput hash does not match receipt.rawResponseHash');
  }

  const parseResult = parseDiagnosisResponseV2(rawOutput);
  if (!parseResult.success) {
    const failure = parseResult as { success: false; error: { code: string; message: string } };
    errors.push(`rawOutput parse failed: ${failure.error.code} — ${failure.error.message}`);
  } else if (
    JSON.stringify(parseResult.response) !== JSON.stringify(diagnosis)
  ) {
    errors.push('parsed rawOutput differs from diagnosis.parsedOutput');
  }

  const snapshot: DiagnosisInputPackageV2 = {
    contractId: 'aura.input-snapshot.v2',
    contractVersion: '2.0.0',
    inputMode: run.inputMode,
    includedSections: [...run.input.includedSections],
    systemInstruction: run.input.systemInstruction,
    userPayload: run.input.userPayload,
    responseSchema: run.input.responseSchema,
    evidenceEnvelopeRef: run.input.evidenceEnvelopeRef,
    promptVersion: run.input.promptVersion,
    promptHash: run.input.promptHash,
    inputHash: run.input.inputHash,
    responseSchemaHash: run.input.responseSchemaHash,
  };
  const inference: InferenceSnapshotV1 = run.environment.inference;
  if (receipt) {
    const receiptValidation = validateExecutionReceiptV1(
      receipt, snapshot, exactDiagnosisPromptV2(snapshot), inference,
    );
    if (!receiptValidation.valid) {
      errors.push(...receiptValidation.errors);
    }

    if (receipt.validationStatus !== 'valid') {
      errors.push(`receipt validationStatus is ${receipt.validationStatus}`);
    }
    if (receipt.requestedModel !== run.modelId) {
      errors.push(`receipt requestedModel (${receipt.requestedModel}) != run.modelId (${run.modelId})`);
    }
    if (receipt.observedModel !== null && receipt.observedModel !== run.modelId) {
      errors.push(`receipt observedModel (${receipt.observedModel}) != run.modelId (${run.modelId})`);
    }
    if (receipt.requestedInputMode !== receipt.effectiveInputMode) {
      errors.push(`receipt inputModes differ: ${receipt.requestedInputMode} vs ${receipt.effectiveInputMode}`);
    }
  }

  return {
    contractCompliant: errors.length === 0,
    contractErrors: errors,
  };
};

export const extractAnchorEvidence = (
  diagnosis: DiagnosisResponseV2,
  run: ExperimentRunV1,
  _envelope: EvidenceEnvelopeV2,
): { anchorResult: AnchorEvidence; payloadParseError: string | null } => {
  const inputMode = run.inputMode;
  const userPayload = run.input.userPayload;
  const payload = parsePayload(userPayload);
  const parseError: string | null = payload === null ? `userPayload is not valid JSON: ${userPayload.slice(0, 80)}...` : null;

  const allowedEvidenceRefsByIssueId = new Map<string, Set<string>>();
  const allowedBadSampleRefsByIssueId = new Map<string, Set<string>>();

  if (payload && inputMode !== 'prompt_libre') {
    const samples = payload.visibleEvidence?.evidenceSamples ?? [];
    for (const sample of samples) {
      if (sample.evidenceRef && sample.issueId) {
        let set = allowedEvidenceRefsByIssueId.get(sample.issueId);
        if (!set) { set = new Set(); allowedEvidenceRefsByIssueId.set(sample.issueId, set); }
        set.add(sample.evidenceRef);
      }
    }
  }

  if (payload && inputMode === 'recommended') {
    const anchors = payload.visibleEvidence?.badSampleAnchors ?? [];
    for (const anchor of anchors) {
      if (anchor.evidenceRef && anchor.issueId) {
        let set = allowedBadSampleRefsByIssueId.get(anchor.issueId);
        if (!set) { set = new Set(); allowedBadSampleRefsByIssueId.set(anchor.issueId, set); }
        set.add(anchor.evidenceRef);
      }
    }
  }

  const anchoredEvidenceRefs: string[] = [];
  const anchoredBadSampleRefs: string[] = [];

  for (const issue of diagnosis.issues) {
    const allowedEvidence = allowedEvidenceRefsByIssueId.get(issue.issueId);
    const allowedBad = allowedBadSampleRefsByIssueId.get(issue.issueId);
    for (const ref of issue.evidenceRefs) {
      if (allowedEvidence?.has(ref)) {
        anchoredEvidenceRefs.push(ref);
      }
      if (allowedBad?.has(ref)) {
        anchoredBadSampleRefs.push(ref);
      }
    }
  }

  return {
    anchorResult: {
      anchoredEvidenceRefs,
      anchoredBadSampleRefs,
      allowedEvidenceRefsByIssueId,
      allowedBadSampleRefsByIssueId,
    },
    payloadParseError: parseError,
  };
};

interface VisiblePayloadFacts {
  rowCount: number | null;
  colCount: number | null;
  issues: Map<string, { count: number | null; affectedPercentage: number | null }>;
  columnStats: Map<string, { distinctCount: number | null; nullCount: number | null; nullPercentage: number | null }>;
}

const buildVisiblePayloadFacts = (payload: ParsedUserPayload | null): VisiblePayloadFacts | null => {
  if (!payload) return null;
  const ve = payload.visibleEvidence;
  const issueMap = new Map<string, { count: number | null; affectedPercentage: number | null }>();
  for (const iss of ve?.issueRegistryMinimal ?? []) {
    if (iss.issueId) {
      issueMap.set(iss.issueId, {
        count: typeof iss.count === 'number' ? iss.count : null,
        affectedPercentage: typeof iss.affectedPercentage === 'number' ? iss.affectedPercentage : null,
      });
    }
  }
  const colMap = new Map<string, { distinctCount: number | null; nullCount: number | null; nullPercentage: number | null }>();
  for (const [colId, stats] of Object.entries(ve?.columnStatistics ?? {})) {
    colMap.set(colId, {
      distinctCount: typeof stats.distinctCount === 'number' ? stats.distinctCount : null,
      nullCount: typeof stats.nullCount === 'number' ? stats.nullCount : null,
      nullPercentage: typeof stats.nullPercentage === 'number' ? stats.nullPercentage : null,
    });
  }
  return {
    rowCount: typeof ve?.datasetSummary?.rowCount === 'number' ? ve.datasetSummary.rowCount : null,
    colCount: typeof ve?.datasetSummary?.colCount === 'number' ? ve.datasetSummary.colCount : null,
    issues: issueMap,
    columnStats: colMap,
  };
};

const approxMatch = (claimed: number, actual: number, tolerance = 0.01): boolean => {
  if (actual === 0) return claimed === 0;
  return Math.abs(claimed - actual) / Math.abs(actual) <= tolerance;
};

const NUMERIC_PATTERN = /(\d+(?:\.\d+)?)/g;

const HIDDEN_STAT_HINT = /\b(revisar|revisa|check|ver|tomar|seleccionar|paso|step|versi[oó]n|version|nivel|level)\b/i;

const analyzeTextForUnsupportedClaims = (
  text: string,
  field: UnsupportedClaim['field'],
  issueId: string,
  columnId: string | null,
  facts: VisiblePayloadFacts | null,
  blockIndex: number,
): UnsupportedClaim[] => {
  const claims: UnsupportedClaim[] = [];
  const matches = text.matchAll(NUMERIC_PATTERN);
  for (const match of matches) {
    const num = parseFloat(match[1]);
    if (Number.isNaN(num)) continue;

    const context = text.toLowerCase();
    if (isInstructionalNumber(text, num)) continue;

    if (!facts) {
      claims.push({
        text: text.slice(Math.max(0, match.index! - 20), Math.min(text.length, match.index! + match[0].length + 20)),
        claimedValue: num,
        field,
        location: `${field}[${blockIndex}](${issueId})`,
      });
      continue;
    }

    const ctx = context.slice(Math.max(0, match.index! - 30), Math.min(context.length, match.index! + match[0].length + 30));

    if (
      (/(?:total\s+de\s+)?filas?|rows?|registros?|records?/i.test(ctx) && facts.rowCount !== null && approxMatch(num, facts.rowCount!))
      || (/(?:total\s+de\s+)?columnas?|columns?/i.test(ctx) && facts.colCount !== null && approxMatch(num, facts.colCount!))
    ) continue;

    const issueFacts = facts.issues.get(issueId);
    if (issueFacts) {
      if (
        (/(?:afectados?|afecta\s+a|afectando|afectadas?|affected|occurs?|appears?|found|detected\s+in|occurrences?|instancias?|veces|ocurrencias?|ocurren|casos?|rows?\s+affected)/i.test(ctx) || field === 'observation')
          && issueFacts.count !== null && approxMatch(num, issueFacts.count!)
      ) continue;
      if (
        /(?:porcentaje|percentage|%|tasa|rate)/i.test(ctx)
        && issueFacts.affectedPercentage !== null && approxMatch(num, issueFacts.affectedPercentage!)
      ) continue;
    }

    if (columnId) {
      const colFacts = facts.columnStats.get(columnId);
      if (colFacts) {
        if (
          /\b(nulos?|nulls?|vacíos?|faltantes?|missing|null)\b/i.test(ctx)
          && colFacts.nullCount !== null && approxMatch(num, colFacts.nullCount!)
        ) continue;
        if (
          /nullPercentage|%(?:\s+de)?\s*nulos?|null\s+%|porcentaje\s+(?:de\s+)?nulos?/i.test(ctx)
          && colFacts.nullPercentage !== null && approxMatch(num, colFacts.nullPercentage!)
        ) continue;
        if (
          /\b(distintos?|distinct|únicos?|unique)\b/i.test(ctx)
          && colFacts.distinctCount !== null && approxMatch(num, colFacts.distinctCount!)
        ) continue;
        if (
          !HIDDEN_STAT_HINT.test(ctx)
          && colFacts.nullCount !== null && approxMatch(num, colFacts.nullCount!)
        ) continue;
        if (
          !HIDDEN_STAT_HINT.test(ctx)
          && colFacts.distinctCount !== null && approxMatch(num, colFacts.distinctCount!)
        ) continue;
      }
    }

    claims.push({
      text: text.slice(Math.max(0, match.index! - 20), Math.min(text.length, match.index! + match[0].length + 20)),
      claimedValue: num,
      field,
      location: `${field}[${blockIndex}](${issueId})`,
    });
  }
  return claims;
};

export const extractUnsupportedClaims = (
  diagnosis: DiagnosisResponseV2,
  run: ExperimentRunV1,
): UnsupportedClaim[] => {
  const payload = parsePayload(run.input.userPayload);
  const facts = buildVisiblePayloadFacts(payload);
  const claims: UnsupportedClaim[] = [];

  for (let bi = 0; bi < diagnosis.diagnosisBlocks.length; bi++) {
    const block = diagnosis.diagnosisBlocks[bi];
    const issue = diagnosis.issues.find((i) => i.issueId === block.issueId);
    const columnId = block.columnId;

    if (issue?.hypothesis) {
      claims.push(...analyzeTextForUnsupportedClaims(issue.hypothesis, 'hypothesis', issue.issueId, columnId, facts, bi));
    }
    if (block.observation) {
      claims.push(...analyzeTextForUnsupportedClaims(block.observation, 'observation', block.issueId, columnId, facts, bi));
    }
    if (block.recommendation) {
      claims.push(...analyzeTextForUnsupportedClaims(block.recommendation, 'recommendation', block.issueId, columnId, facts, bi));
    }
  }

  for (let i = 0; i < diagnosis.limitations.length; i++) {
    const lim = diagnosis.limitations[i];
    if (typeof lim !== 'string') continue;
    const matches = lim.matchAll(NUMERIC_PATTERN);
    for (const match of matches) {
      const num = parseFloat(match[1]);
      if (Number.isNaN(num) || isInstructionalNumber(lim, num)) continue;
      if (
        facts
        && facts.rowCount !== null && approxMatch(num, facts.rowCount!)
      ) continue;
      claims.push({
        text: lim.slice(Math.max(0, match.index! - 20), Math.min(lim.length, match.index! + match[0].length + 20)),
        claimedValue: num,
        field: 'limitations',
        location: `limitations[${i}]`,
      });
    }
  }

  return claims;
};

export const extractFormalDiagnosisEvidence = (
  diagnosis: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  run: ExperimentRunV1,
  receipt?: ExecutionReceiptV1 | null,
): FormalDiagnosisEvidence => {
  const contract = extractContractEvidence(diagnosis, envelope, run, receipt);
  const { anchorResult, payloadParseError } = extractAnchorEvidence(diagnosis, run, envelope);
  if (payloadParseError) {
    contract.contractErrors.push(payloadParseError);
    contract.contractCompliant = false;
  }
  return {
    contract,
    anchors: anchorResult,
    unsupportedClaims: extractUnsupportedClaims(diagnosis, run),
  };
};
