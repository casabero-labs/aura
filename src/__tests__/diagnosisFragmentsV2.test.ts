/**
 * Gemini Nano — one request per issue.
 *
 * Covers the deterministic fragment builder, the strict assembler, the
 * selector routing for Chrome AI, and the fixed column-statistics mapping.
 */
import { describe, it, expect, vi } from 'vitest';

(import.meta as any).env = { ...((import.meta as any).env || {}), VITE_CONTRACTS_V2_ENABLED: 'true' };

import { runStructuredDiagnosis, buildDiagnosisInputPackageV2 } from '../contracts/llm';
import { _buildEvidenceEnvelopeV2, normalizeColumnStatsInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import {
  assembleDiagnosisFromFragmentsV2,
  buildDiagnosisFragmentRequestsV2,
  parseDiagnosisFragmentV2,
} from '../contracts/llm/diagnosisFragmentsV2';
import { validateExecutionReceiptIntegrityV1 } from '../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import type { AIProvider, StructuredFragmentRequest } from '../types';

const DATASET_SHA256 = 'b'.repeat(64);

// Engine-shaped column stats (uniqueCount / topFreq / flat numbers), as the
// audit engine really produces them.
const report: AuditReportInput = {
  score: 58, rowCount: 891, colCount: 2, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto', ruleName: 'Espacios Fantasma (Trim)', description: 'Textos con espacios invisibles al inicio/final.', severity: 'info', count: 2, affectedPercentage: 0.22, sampleValues: ['Daly, Mr. Peter Denis '], ruleId: 'rule:trim-whitespace' },
    { id: 'integrity-null-Cabin', column: 'Cabin', category: 'Integridad y Estructura', ruleName: 'Valores Nulos / Vacíos', description: 'Crítico: 77.1% de datos faltantes.', severity: 'critical', count: 687, affectedPercentage: 77.1, sampleValues: [], ruleId: 'rule:null-values' },
  ],
  columnStats: {
    Name: { inferredType: 'string', nullCount: 0, uniqueCount: 891, topFreq: [{ value: 'Braund, Mr. Owen Harris', count: 1 }] },
    Cabin: { inferredType: 'string', nullCount: 687, uniqueCount: 147, topFreq: [{ value: 'G6', count: 4 }], zeros: 0 },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Cabin' }] },
};

const envelope = _buildEvidenceEnvelopeV2(report, { privacyLevel: 'local_full', datasetSha256: DATASET_SHA256, delimiter: ',' });
const input = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');

const fragmentFor = (issueId: string, overrides: Record<string, unknown> = {}) => JSON.stringify({
  hypothesis: `Hipótesis para ${issueId}`,
  observation: 'La evidencia muestra la cifra indicada.',
  recommendation: 'Revisar el origen de los datos.',
  confidence: 0.6,
  requiresHumanReview: true,
  evidenceRefs: [],
  limits: ['No se conoce el proceso de captura.'],
  ...overrides,
});

function chromeProvider(responder: (request: StructuredFragmentRequest, call: number) => string | Error): AIProvider {
  let call = 0;
  return {
    name: 'Chrome AI / Gemini Nano',
    type: 'chrome',
    analyzeStream: vi.fn(),
    generateExecutiveReport: vi.fn(),
    generateExecutiveReportStream: vi.fn(),
    generateText: vi.fn(),
    generateTextWithProgress: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    generateStructuredFragment: vi.fn(async (request: StructuredFragmentRequest) => {
      call += 1;
      const out = responder(request, call);
      if (out instanceof Error) throw out;
      request.onChunk?.(out);
      return { text: out, metrics: { provider: 'Chrome AI / Gemini Nano', model: 'gemini-nano', latencyMs: 5, firstTokenMs: 1, tokensGenerated: 10, isLocal: true, timestamp: '' } };
    }),
  } as AIProvider;
}

const issueIdOf = (request: StructuredFragmentRequest) => (JSON.parse(request.prompt) as { issueId: string }).issueId;

describe('column statistics reach the model', () => {
  it('maps the audit engine shape instead of sending zeros', () => {
    const cabin = envelope.columns.find((column) => column.name === 'Cabin')!;
    const stats = envelope.evidence.columnStats[cabin.columnId];
    expect(stats.distinctCount).toBe(147);
    expect(stats.nullCount).toBe(687);
    expect(stats.nullPercentage).toBe(77.1);
    expect(stats.topValues[0]).toMatchObject({ value: 'G6', count: 4 });
    expect(stats.stats).toEqual({ zeros: 0 });
  });

  it('keeps envelope-native fields when present', () => {
    expect(normalizeColumnStatsInput({ distinctCount: 3, uniqueCount: 9, nullPercentage: 12 }, 100))
      .toMatchObject({ distinctCount: 3, nullPercentage: 12 });
  });
});

describe('buildDiagnosisFragmentRequestsV2', () => {
  it('builds one deterministic request per required issue', () => {
    const first = buildDiagnosisFragmentRequestsV2(input);
    const second = buildDiagnosisFragmentRequestsV2(input);
    expect(first.map((request) => request.issueId)).toEqual(envelope.issues.map((issue) => issue.issueId));
    expect(first.map((request) => request.promptHash)).toEqual(second.map((request) => request.promptHash));
    const facts = JSON.parse(first[1].prompt);
    expect(facts).toMatchObject({ column: 'Cabin', affectedRows: 687, totalRows: 891, mustRequireHumanReview: true });
  });

  it('limits evidenceRefs to the refs visible for that issue', () => {
    const [nameRequest, cabinRequest] = buildDiagnosisFragmentRequestsV2(input);
    const nameRefs = envelope.issues[0].evidenceRefs;
    expect((nameRequest.responseSchema as any).properties.evidenceRefs.items.enum).toEqual(nameRefs);
    expect((cabinRequest.responseSchema as any).properties.evidenceRefs).toEqual({ type: 'array', maxItems: 0 });
  });
});

describe('assembleDiagnosisFromFragmentsV2', () => {
  it('rejects markdown-fenced fragments (no repair)', () => {
    expect(parseDiagnosisFragmentV2('```json\n{}\n```')).toMatchObject({ ok: false });
    const outcome = assembleDiagnosisFromFragmentsV2(input, envelope, [
      { issueId: envelope.issues[0].issueId, rawResponse: '```json\n' + fragmentFor('x') + '\n```' },
      { issueId: envelope.issues[1].issueId, rawResponse: fragmentFor('y') },
    ], new Date().toISOString());
    expect(outcome).toMatchObject({ success: false, code: 'DIAGNOSIS_JSON_INVALID', issueId: envelope.issues[0].issueId });
  });

  it('rejects fields outside the fragment contract', () => {
    const outcome = assembleDiagnosisFromFragmentsV2(input, envelope, envelope.issues.map((issue) => ({
      issueId: issue.issueId,
      rawResponse: fragmentFor(issue.issueId, { severity: 'critical' }),
    })), new Date().toISOString());
    expect(outcome).toMatchObject({ success: false, code: 'DIAGNOSIS_SCHEMA_INVALID' });
  });

  it('copies identifiers from the envelope', () => {
    const outcome = assembleDiagnosisFromFragmentsV2(input, envelope, envelope.issues.map((issue) => ({
      issueId: issue.issueId,
      rawResponse: fragmentFor(issue.issueId),
    })), new Date().toISOString());
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.response.diagnosisBlocks.map((block) => [block.issueId, block.ruleId, block.columnId]))
        .toEqual(envelope.issues.map((issue) => [issue.issueId, issue.ruleId, issue.columnId]));
    }
  });
});

describe('runStructuredDiagnosis with Gemini Nano', () => {
  it('diagnoses each issue separately and validates the assembled contract', async () => {
    const provider = chromeProvider((request) => fragmentFor(issueIdOf(request)));
    const progress: string[] = [];
    const outcome = await runStructuredDiagnosis(report, {
      provider,
      auditEvidence: { datasetSha256: DATASET_SHA256 },
      requestedModel: 'gemini-nano',
      onProgress: (event) => progress.push(event.type),
    });

    expect('success' in outcome && outcome.success).toBe(true);
    if (!('success' in outcome) || !outcome.success) return;
    expect(provider.generateStructuredFragment).toHaveBeenCalledTimes(2);
    expect(provider.generateTextWithProgress).not.toHaveBeenCalled();
    expect(progress.filter((type) => type === 'fragment')).toHaveLength(2);
    expect(outcome.result.fragments).toHaveLength(2);
    const receipt = outcome.result.executionReceipt!;
    expect(receipt.validationStatus).toBe('valid');
    expect(receipt.fragmentedExecution).toMatchObject({ strategy: 'per_issue', requestCount: 2 });
    expect(validateExecutionReceiptIntegrityV1(receipt, outcome.result.inputSnapshot!, exactDiagnosisPromptV2(outcome.result.inputSnapshot!)).valid).toBe(true);
  });

  it('asks a fragment once more when its output is not JSON, and counts the attempt', async () => {
    const provider = chromeProvider((request, call) => (call === 1 ? '```json\n{}' : fragmentFor(issueIdOf(request))));
    const outcome = await runStructuredDiagnosis(report, {
      provider,
      auditEvidence: { datasetSha256: DATASET_SHA256 },
      requestedModel: 'gemini-nano',
    });
    expect('success' in outcome && outcome.success).toBe(true);
    if ('success' in outcome && outcome.success) {
      expect(outcome.result.executionReceipt?.fragmentedExecution?.requestCount).toBe(3);
      expect(outcome.result.fragments?.[0].attempts).toBe(2);
    }
  });

  it('fails closed with the verbatim fragments when a fragment stays invalid', async () => {
    const provider = chromeProvider(() => 'no es json');
    const outcome = await runStructuredDiagnosis(report, {
      provider,
      auditEvidence: { datasetSha256: DATASET_SHA256 },
      requestedModel: 'gemini-nano',
    });
    expect('contractId' in outcome && outcome.contractId).toBe('aura.diagnosis-failure-evidence.v2');
    if ('contractId' in outcome) {
      expect(outcome.code).toBe('DIAGNOSIS_JSON_INVALID');
      expect(outcome.fragments?.every((fragment) => fragment.rawResponse === 'no es json')).toBe(true);
      expect(outcome.executionReceipt.fragmentedExecution?.requestCount).toBe(4);
    }
  });

  it('stops when the run is cancelled', async () => {
    const controller = new AbortController();
    const provider = chromeProvider((request) => {
      controller.abort();
      return fragmentFor(issueIdOf(request));
    });
    const outcome = await runStructuredDiagnosis(report, {
      provider,
      auditEvidence: { datasetSha256: DATASET_SHA256 },
      requestedModel: 'gemini-nano',
      signal: controller.signal,
    });
    expect(provider.generateStructuredFragment).toHaveBeenCalledTimes(1);
    expect('contractId' in outcome && outcome.code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });
});
