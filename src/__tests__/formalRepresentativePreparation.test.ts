import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2, type AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2, exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { buildExecutionReceiptV1 } from '../contracts/llm/executionReceiptV1';
import type { DiagnosisResponseV2 } from '../contracts/llm';
import { FINAL_EVALUATION_PROTOCOL } from '../services/benchmark/finalEvaluationProtocol';
import type { ExperimentRunV1 } from '../services/benchmark/experimentTypes';
import { buildFormalRepresentativeExecutionBundle, importFormalRepresentativeOutput, prepareFormalRepresentative } from '../services/benchmark/formalRepresentativePreparation';
import { sha256hex } from '../contracts/llm/hash';
import { buildPythonExecutionReceipt, type PythonExecutionReceiptPayloadV1 } from '../services/benchmark/pythonExecutionReceipt';

const report: AuditReportInput = {
  score: 90, rowCount: 10, colCount: 1, duplicateRows: 0, delimiterDetected: ',',
  issues: [{
    id: 'trim-name', column: 'Name', category: 'Higiene', ruleName: 'Espacios',
    description: 'Espacios externos', severity: 'warning', count: 2, affectedPercentage: 20,
    sampleValues: [' Alice '], ruleId: 'rule:trim-whitespace',
    automaticAuthorization: {
      actionType: 'trim_whitespace', authorized: true,
      conditionsMet: ['string-column'], reason: 'Deterministic',
    },
  }],
  columnStats: { Name: { inferredType: 'string', distinctCount: 10, nullCount: 0, nullPercentage: 0 } },
  datasetProfile: { columns: [{ name: 'Name' }] },
};

describe('formal representative deterministic preparation', () => {
  it('propagates the receipt and reaudits the externally produced CSV', async () => {
    const envelope = _buildEvidenceEnvelopeV2(report, {
      privacyLevel: 'local_full', datasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256, delimiter: ',',
    });
    const pkg = buildDiagnosisInputPackageV2(report, envelope, 'recommended');
    const issue = envelope.issues[0];
    const diagnosis: DiagnosisResponseV2 = {
      contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
      evidenceEnvelopeRef: pkg.evidenceEnvelopeRef, responseId: 'response:test',
      issues: [{
        issueId: issue.issueId, evidenceRefs: issue.evidenceRefs,
        hypothesis: 'Whitespace observed', confidence: 0.9,
        requiresHumanReview: false, limits: [],
      }],
      diagnosisBlocks: [{
        issueId: issue.issueId, ruleId: issue.ruleId, columnId: issue.columnId,
        scope: issue.scope, observation: 'Whitespace observed', recommendation: 'Trim safely',
      }],
      limitations: [], generatedAt: '2026-07-11T22:00:00.000Z',
    };
    const modelId = FINAL_EVALUATION_PROTOCOL.models[0];
    const exactPrompt = exactDiagnosisPromptV2(pkg);
    const receipt = buildExecutionReceiptV1({
      input: pkg, requestedInputMode: 'recommended', exactPrompt,
      provider: 'Ollama', requestedModel: modelId, observedModel: modelId,
      modelDigest: `sha256:${'b'.repeat(64)}`, inference: FINAL_EVALUATION_PROTOCOL.inference,
      startedAt: '2026-07-11T22:00:00.000Z', completedAt: '2026-07-11T22:00:01.000Z',
      rawResponse: JSON.stringify(diagnosis), validationStatus: 'valid',
    });
    const run = {
      status: 'approved', runId: 'run:test', modelId, inputMode: 'recommended',
      input: { ...pkg, contractId: 'aura.input-snapshot.v2', contractVersion: '2.0.0' },
      environment: {
        dataset: { sha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256 },
        model: { localDigest: `sha256:${'b'.repeat(64)}` },
        inference: FINAL_EVALUATION_PROTOCOL.inference,
      },
      diagnosis: {
        status: 'completed', parsedOutput: diagnosis,
        completedAt: '2026-07-11T22:00:01.000Z',
        metrics: { totalDurationMs: 1000, firstTokenMs: 10, outputTokens: 100, promptTokens: 200 },
      },
      executionReceipt: receipt,
      automaticEvaluation: {
        contractId: 'aura.automatic-evaluation.v1', evaluatedAt: '2026-07-11T22:00:02.000Z',
        diagnosis: { primary: { tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 }, engineCoverage: 1, evidenceFidelity: 1, extendedDiscoveryKeys: [], contractCompliant: true, inventedColumns: [], unsupportedClaims: [], anchoringScore: 1, contractErrors: [], anchoredEvidenceRefs: [], anchoredBadSampleRefs: [] },
        script: { contractValid: false, syntaxValid: false, safe: false, coveredActions: [], missingActions: [], unsupportedActions: [] },
      },
      hitl: { status: 'approved' },
    } as unknown as ExperimentRunV1;

    const prepared = prepareFormalRepresentative(run, envelope, '2026-07-11T22:05:00.000Z');
    const contract = prepared.script?.parsedOutput as { inputReceiptRef?: string; scriptHash: string };

    expect(prepared.status).toBe('awaiting_external_output');
    expect(contract.inputReceiptRef).toBe(receipt.receiptHash);
    expect((prepared.script?.rawOutput ?? '')).toContain(`# AURA input receipt: ${receipt.receiptHash}`);
    expect((prepared.script?.rawOutput ?? '')).toContain('# AURA diagnosis input mode: recommended');
    expect((prepared.script?.rawOutput ?? '')).toContain(`# AURA prompt hash: ${pkg.promptHash}`);
    expect((prepared.script?.rawOutput ?? '')).toContain(`# AURA input hash: ${pkg.inputHash}`);
    expect((prepared.script?.rawOutput ?? '')).toContain(`# AURA evidence envelope: ${pkg.evidenceEnvelopeRef}`);
    expect(prepared.execution?.approvedScriptHash).toBe(contract.scriptHash);
    expect(prepared.automaticEvaluation?.script).toEqual(expect.objectContaining({ contractValid: true, safe: true }));
    expect(prepared.automaticEvaluation?.script.syntaxValid).toBe(null);
    const bundle = buildFormalRepresentativeExecutionBundle(prepared, '2026-07-11T22:06:00.000Z');
    expect(bundle.approvedScriptHash).toBe(contract.scriptHash);
    expect(bundle.scriptTextSha256).toBe(sha256hex(prepared.script!.rawOutput));
    expect(bundle.inputReceiptRef).toBe(receipt.receiptHash);
    expect(bundle.evidenceEnvelopeRef).toBe(pkg.evidenceEnvelopeRef);

    const beforeCsv = 'Name\n" Alice "\n';
    const afterCsv = 'Name\nAlice\n';
    prepared.environment.dataset.sha256 = sha256hex(beforeCsv);
    prepared.execution!.beforeDatasetSha256 = sha256hex(beforeCsv);
    const receiptPayload: PythonExecutionReceiptPayloadV1 = {
      contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0',
      runId: prepared.runId,
      approvedScriptHash: prepared.execution!.approvedScriptHash!,
      scriptTextSha256: sha256hex(prepared.script!.rawOutput),
      beforeDatasetSha256: sha256hex(beforeCsv), afterDatasetSha256: sha256hex(afterCsv),
      pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'test',
      bundleHash: bundle.bundleHash,
      inputReceiptRef: bundle.inputReceiptRef,
      evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
      syntax: { status: 'passed', error: null },
      execution: {
        status: 'passed', startedAt: '2026-07-11T22:09:00.000Z', completedAt: '2026-07-11T22:10:00.000Z',
        durationMs: 1000, stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
      },
      output: { rowCount: 1, columnCount: 1 },
    };
    const pythonReceipt = buildPythonExecutionReceipt(receiptPayload);
    const reaudited = await importFormalRepresentativeOutput(
      prepared,
      { text: async () => beforeCsv },
      { text: async () => afterCsv },
      { text: async () => JSON.stringify(pythonReceipt) },
      bundle,
      '2026-07-11T22:10:00.000Z',
    );

    expect(reaudited.status).toBe('reaudited');
    expect(reaudited.automaticEvaluation?.script.syntaxValid).toBe(true);
    expect(reaudited.execution?.pythonReceipt?.receiptHash).toBe(pythonReceipt.receiptHash);
    expect(reaudited.execution?.reaudit).not.toBeNull();
  });
});
