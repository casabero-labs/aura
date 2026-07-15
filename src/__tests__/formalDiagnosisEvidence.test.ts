import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2, type AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2, exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { buildEnvelopeRef } from '../contracts/llm/diagnosisPromptV2';
import { buildExecutionReceiptV1 } from '../contracts/llm/executionReceiptV1';
import { FINAL_EVALUATION_PROTOCOL, type OE4ModelId } from '../services/benchmark/finalEvaluationProtocol';
import type {
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  DiagnosisInputPackageV2,
} from '../contracts/llm/types';
import type { ExperimentRunV1 } from '../services/benchmark/experimentTypes';
import {
  extractContractEvidence,
  extractAnchorEvidence,
  extractUnsupportedClaims,
  extractFormalDiagnosisEvidence,
  type UnsupportedClaim,
} from '../services/benchmark/formalDiagnosisEvidence';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const MODEL_ID = FINAL_EVALUATION_PROTOCOL.models[0];
const NOW = '2026-07-12T00:00:00.000Z';

const makeReport = (): AuditReportInput => ({
  score: 80, rowCount: 100, colCount: 3, duplicateRows: 10, delimiterDetected: ',',
  issues: [
    {
      id: 'issue-1', column: 'Name', category: 'Higiene',
      ruleName: 'trim', description: 'whitespace', severity: 'info',
      count: 5, affectedPercentage: 5, sampleValues: ['a'],
      ruleId: 'rule:trim-whitespace',
      automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic' },
    },
    {
      id: 'issue-2', column: 'Age', category: 'Integridad',
      ruleName: 'nulls', description: 'nulls', severity: 'warning',
      count: 20, affectedPercentage: 20, sampleValues: [null],
      ruleId: 'rule:null-values',
      automaticAuthorization: { actionType: 'null_values', authorized: false, conditionsMet: [], reason: 'No auto' },
    },
  ],
  columnStats: {
    Name: { inferredType: 'string', distinctCount: 90, nullCount: 0, nullPercentage: 0 },
    Age: { inferredType: 'number', distinctCount: 80, nullCount: 20, nullPercentage: 20 },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
});

const makeEnvelope = (): EvidenceEnvelopeV2 =>
  _buildEvidenceEnvelopeV2(makeReport(), { privacyLevel: 'local_full', datasetSha256: HASH_A, delimiter: ',' });

const makeDiagnosisJson = (envelope: EvidenceEnvelopeV2): string => {
  const envIssue0 = envelope.issues[0];
  const envIssue1 = envelope.issues[1];
  return JSON.stringify({
    contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
    evidenceEnvelopeRef: buildEnvelopeRef(envelope),
    responseId: 'response:test',
    issues: [
      {
        issueId: envIssue0.issueId, evidenceRefs: envIssue0.evidenceRefs.slice(0, 1),
        hypothesis: 'Column has 5 affected rows', confidence: 0.9,
        requiresHumanReview: true, limits: [],
      },
      {
        issueId: envIssue1.issueId, evidenceRefs: envIssue1.evidenceRefs.slice(0, 1),
        hypothesis: 'Column has 30 nulls', confidence: 0.8,
        requiresHumanReview: true, limits: [],
      },
    ],
    diagnosisBlocks: [
      {
        issueId: envIssue0.issueId, ruleId: envIssue0.ruleId,
        columnId: envIssue0.columnId, scope: envIssue0.scope,
        observation: 'Name has 5 affected rows',
        recommendation: 'Trim whitespace',
      },
      {
        issueId: envIssue1.issueId, ruleId: envIssue1.ruleId,
        columnId: envIssue1.columnId, scope: envIssue1.scope,
        observation: 'Age has 30 nulls',
        recommendation: 'Check integrity',
      },
    ],
    limitations: ['This diagnosis only covers 100 rows.'],
    generatedAt: NOW,
  });
};

const DIAGNOSIS_JSON = makeDiagnosisJson(makeEnvelope());

const makeInput = (inputMode: 'prompt_libre' | 'smart_sample' | 'recommended' = 'recommended'): DiagnosisInputPackageV2 => {
  const envelope = makeEnvelope();
  const report = makeReport();
  return buildDiagnosisInputPackageV2(report, envelope, inputMode);
};

const makeRun = (inputMode: 'prompt_libre' | 'smart_sample' | 'recommended' = 'recommended'): ExperimentRunV1 => {
  const input = makeInput(inputMode);
  return {
    contractId: 'aura.experiment-run.v1', contractVersion: '1.0.0',
    campaignId: 'campaign:test', runId: 'run:test',
    protocolId: FINAL_EVALUATION_PROTOCOL.id, protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    modelId: MODEL_ID, inputMode, repetition: 1, sequence: 1,
    status: 'completed', createdAt: NOW, updatedAt: NOW,
    environment: {
      contractId: 'aura.environment-snapshot.v1', capturedAt: NOW,
      appCommit: 'a'.repeat(40),
      dataset: {
        id: FINAL_EVALUATION_PROTOCOL.dataset.id,
        sha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
        schemaSha256: FINAL_EVALUATION_PROTOCOL.dataset.schemaSha256,
        groundTruthSha256: FINAL_EVALUATION_PROTOCOL.dataset.groundTruthSha256,
      },
      hardware: { machine: 'test', cpu: 'test', memoryBytes: 1024 },
      runtime: { provider: 'ollama', ollamaVersion: '1.0', clientVersion: '1.0' },
      model: { id: MODEL_ID, quantization: 'UD-Q4_K_XL', expectedGgufSha256: HASH_A, localDigest: HASH_B },
      inference: { ...FINAL_EVALUATION_PROTOCOL.inference },
    },
    input,
    diagnosis: {
      contractId: 'aura.llm-stage-result.v1', stage: 'diagnosis', status: 'completed',
      attemptId: 'attempt:1', startedAt: NOW, completedAt: NOW,
      rawOutput: DIAGNOSIS_JSON,
      parsedOutput: JSON.parse(DIAGNOSIS_JSON),
      validationErrors: [], metrics: {
        totalDurationMs: 1000, loadDurationMs: 0, promptEvalDurationMs: 100,
        evalDurationMs: 900, promptTokens: 200, outputTokens: 100,
        reasoningTokens: null, firstTokenMs: null, tokensPerSecond: 100,
      }, error: null,
    },
    script: null, automaticEvaluation: null, humanReview: null, hitl: null, execution: null,
    attempts: [],
  };
};

const makeValidReceipt = (run: ExperimentRunV1): ReturnType<typeof buildExecutionReceiptV1> =>
  buildExecutionReceiptV1({
    input: run.input,
    requestedInputMode: run.inputMode,
    exactPrompt: exactDiagnosisPromptV2(run.input),
    provider: 'Ollama',
    requestedModel: run.modelId,
    observedModel: run.modelId,
    modelDigest: HASH_B,
    inference: FINAL_EVALUATION_PROTOCOL.inference,
    startedAt: NOW,
    completedAt: NOW,
    rawResponse: DIAGNOSIS_JSON,
    validationStatus: 'valid',
  });

describe('extractContractEvidence', () => {
  it('returns compliant for a valid diagnosis and valid receipt', () => {
    const run = makeRun('recommended');
    const envelope = makeEnvelope();
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const receipt = makeValidReceipt(run);
    const evidence = extractContractEvidence(diagnosis, envelope, run, receipt);
    expect(evidence.contractCompliant).toBe(true);
    expect(evidence.contractErrors).toEqual([]);
  });

  it('returns non-compliant when the diagnosis validator finds errors', () => {
    const run = makeRun('recommended');
    const envelope = makeEnvelope();
    const badDiagnosis: DiagnosisResponseV2 = {
      ...JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2,
      evidenceEnvelopeRef: 'mismatched-ref',
    };
    const receipt = makeValidReceipt(run);
    const evidence = extractContractEvidence(badDiagnosis, envelope, run, receipt);
    expect(evidence.contractCompliant).toBe(false);
    expect(evidence.contractErrors.length).toBeGreaterThan(0);
  });

  it('fails closed without a receipt and still preserves stage validation errors', () => {
    const run = makeRun('recommended');
    run.diagnosis!.validationErrors = [{ code: 'STAGE_INVALID', message: 'stage rejected output', path: '$' }];
    const evidence = extractContractEvidence(
      JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2,
      makeEnvelope(),
      run,
      null,
    );
    expect(evidence.contractCompliant).toBe(false);
    expect(evidence.contractErrors).toEqual(expect.arrayContaining([
      expect.stringContaining('execution receipt is missing'),
      expect.stringContaining('STAGE_INVALID'),
    ]));
  });

  it('rejects raw output that does not match the receipt and parsed diagnosis', () => {
    const run = makeRun('recommended');
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    run.diagnosis!.rawOutput = JSON.stringify({ ...diagnosis, responseId: 'response:tampered' });
    const evidence = extractContractEvidence(diagnosis, makeEnvelope(), run, makeValidReceipt(run));
    expect(evidence.contractCompliant).toBe(false);
    expect(evidence.contractErrors).toEqual(expect.arrayContaining([
      expect.stringContaining('rawOutput hash'),
      expect.stringContaining('parsed rawOutput differs'),
    ]));
  });

  it('returns non-compliant when receipt observedModel differs from run.modelId', () => {
    const run = makeRun('recommended');
    const envelope = makeEnvelope();
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const mismatchedReceipt = buildExecutionReceiptV1({
      input: run.input,
      requestedInputMode: run.inputMode,
      exactPrompt: exactDiagnosisPromptV2(run.input),
      provider: 'Ollama',
      requestedModel: run.modelId,
      observedModel: 'different-model',
      modelDigest: HASH_B,
      inference: FINAL_EVALUATION_PROTOCOL.inference,
      startedAt: NOW, completedAt: NOW,
      rawResponse: '',
      validationStatus: 'invalid',
      validationErrorCodes: ['DIAGNOSIS_MODEL_MISMATCH'],
    });
    const evidence = extractContractEvidence(diagnosis, envelope, run, mismatchedReceipt);
    expect(evidence.contractCompliant).toBe(false);
    expect(evidence.contractErrors.some((e) => e.includes('validationStatus') || e.includes('observedModel'))).toBe(true);
  });
});

describe('extractAnchorEvidence', () => {
  it('prompt_libre returns zero anchors', () => {
    const run = makeRun('prompt_libre');
    const envelope = makeEnvelope();
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const { anchorResult } = extractAnchorEvidence(diagnosis, run, envelope);
    expect(anchorResult.anchoredEvidenceRefs).toEqual([]);
    expect(anchorResult.anchoredBadSampleRefs).toEqual([]);
    expect(anchorResult.allowedEvidenceRefsByIssueId.size).toBe(0);
  });

  it('smart_sample counts evidenceRefs from visible userPayload', () => {
    const run = makeRun('smart_sample');
    const envelope = makeEnvelope();
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const { anchorResult } = extractAnchorEvidence(diagnosis, run, envelope);
    expect(anchorResult.anchoredEvidenceRefs.length).toBeGreaterThan(0);
    expect(anchorResult.anchoredBadSampleRefs).toEqual([]);
  });

  it('recommended returns badSampleRefs for refs in visible badSampleAnchors', () => {
    const run = makeRun('recommended');
    const envelope = makeEnvelope();
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const { anchorResult } = extractAnchorEvidence(diagnosis, run, envelope);
    // recommended includes badSampleAnchors in userPayload visible evidence
    expect(anchorResult.allowedBadSampleRefsByIssueId.size).toBeGreaterThan(0);
  });

  it('does not credit a reference under a different issue', () => {
    const run = makeRun('recommended');
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const foreignRef = diagnosis.issues[1].evidenceRefs[0];
    diagnosis.issues[0].evidenceRefs = [foreignRef];
    diagnosis.issues[1].evidenceRefs = [];
    const { anchorResult } = extractAnchorEvidence(diagnosis, run, makeEnvelope());
    expect(anchorResult.anchoredEvidenceRefs).not.toContain(foreignRef);
  });
});

describe('extractUnsupportedClaims', () => {
  const withVisibleEvidence = (
    run: ExperimentRunV1,
    issueId: string,
    values: unknown,
  ): ExperimentRunV1 => {
    const payload = JSON.parse(run.input.userPayload) as {
      visibleEvidence?: { evidenceSamples?: Array<Record<string, unknown>> };
    };
    payload.visibleEvidence ??= {};
    payload.visibleEvidence.evidenceSamples = [{
      evidenceRef: 'ev-visible-test',
      issueId,
      columnId: 'col:test',
      values,
    }];
    return {
      ...run,
      input: {
        ...run.input,
        userPayload: JSON.stringify(payload),
      },
    };
  };

  it('detects a false numeric claim in a hypothesis', () => {
    const run = makeRun('recommended');
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const claims = extractUnsupportedClaims(diagnosis, run);
    const falseClaim = claims.find((c) => c.claimedValue === 30);
    expect(falseClaim).toBeDefined();
    expect(falseClaim!.field).toBe('hypothesis');
    expect(falseClaim!.text).toContain('30');
  });

  it('does not flag a numeric claim that matches visible facts', () => {
    const run = makeRun('recommended');
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const claims = extractUnsupportedClaims(diagnosis, run);
    const validClaim = claims.find((c) => c.claimedValue === 5 && c.text.includes('5 affected rows'));
    expect(validClaim).toBeUndefined();
  });

  it('flags unsupported numeric values in limitations', () => {
    const run = makeRun('recommended');
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const claims = extractUnsupportedClaims(diagnosis, run);
    const limClaim = claims.filter((c) => c.field === 'limitations');
    const validLim = diagnosis.limitations.find((l) => l.includes('100 rows'));
    if (validLim) {
      const falseLimClaim = limClaim.find((c) => c.claimedValue === 100 && c.text.includes('100'));
      expect(falseLimClaim).toBeUndefined();
    }
  });

  it('ignores instructional numbers that are not factual claims', () => {
    const run = makeRun('recommended');
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    diagnosis.diagnosisBlocks[0].recommendation = 'Revisar 3 muestras en el paso 2.';
    const claims = extractUnsupportedClaims(diagnosis, run);
    expect(claims.some((claim) => claim.claimedValue === 3 || claim.claimedValue === 2)).toBe(false);
  });

  it('accepts negative, date and masked values visible for the same issue', () => {
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const issueId = diagnosis.diagnosisBlocks[0].issueId;
    const run = withVisibleEvidence(
      makeRun('smart_sample'),
      issueId,
      [-1500, '01/15/2023', '9***9'],
    );
    diagnosis.issues[0].hypothesis = 'Se observaron -1500, 01/15/2023 y 9***9 en la muestra visible.';
    diagnosis.diagnosisBlocks[0].observation = diagnosis.issues[0].hypothesis;

    const claims = extractUnsupportedClaims(diagnosis, run);

    expect(claims.filter((claim) => claim.location.includes(issueId))).toEqual([]);
  });

  it('accepts an abbreviated SHA-256 only when its visible issue sample has the same prefix', () => {
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const issueId = diagnosis.diagnosisBlocks[0].issueId;
    const run = withVisibleEvidence(
      makeRun('recommended'),
      issueId,
      ['sha256:fb3290001234567890abcdef1234567890abcdef1234567890abcdef12345678'],
    );
    diagnosis.issues[0].hypothesis = 'El valor sha256:fb329000... aparece en la evidencia protegida.';
    diagnosis.diagnosisBlocks[0].observation = diagnosis.issues[0].hypothesis;

    const claims = extractUnsupportedClaims(diagnosis, run);

    expect(claims.filter((claim) => claim.location.includes(issueId))).toEqual([]);
  });

  it('does not borrow a visible sample from another issue or from a mode without samples', () => {
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const targetIssueId = diagnosis.diagnosisBlocks[0].issueId;
    const otherIssueId = diagnosis.diagnosisBlocks[1].issueId;
    const run = withVisibleEvidence(makeRun('smart_sample'), otherIssueId, [150]);
    diagnosis.issues[0].hypothesis = 'Se observó el valor 150.';
    diagnosis.diagnosisBlocks[0].observation = 'Se observó el valor 150.';

    const wrongIssueClaims = extractUnsupportedClaims(diagnosis, run);
    const minimalClaims = extractUnsupportedClaims(diagnosis, makeRun('prompt_libre'));

    expect(wrongIssueClaims.some((claim) => claim.claimedValue === 150 && claim.location.includes(targetIssueId))).toBe(true);
    expect(minimalClaims.some((claim) => claim.claimedValue === 30)).toBe(true);
  });
});

describe('extractFormalDiagnosisEvidence', () => {
  it('returns full evidence for a valid diagnosis', () => {
    const run = makeRun('recommended');
    const envelope = makeEnvelope();
    const diagnosis = JSON.parse(DIAGNOSIS_JSON) as DiagnosisResponseV2;
    const receipt = makeValidReceipt(run);
    const evidence = extractFormalDiagnosisEvidence(diagnosis, envelope, run, receipt);
    expect(evidence.contract.contractCompliant).toBe(true);
    expect(evidence.contract.contractErrors).toEqual([]);
    expect(evidence.anchors.anchoredEvidenceRefs.length).toBeGreaterThan(0);
    expect(evidence.unsupportedClaims.length).toBeGreaterThan(0);
  });
});
