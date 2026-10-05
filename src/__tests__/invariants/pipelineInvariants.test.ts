/**
 * Pipeline invariants — guards for failures that already reached production.
 *
 * Each block names the incident it prevents. If one of these fails, the change
 * broke a promise of the product, not just an implementation detail: fix the
 * code, or change the promise deliberately (and the copy that states it).
 * See AGENTS.md § "Invariantes del pipeline".
 */
import { readFileSync } from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { afterEach, describe, expect, it, vi } from 'vitest';

(import.meta as any).env = { ...((import.meta as any).env || {}), VITE_CONTRACTS_V2_ENABLED: 'true' };

import { runAudit } from '../../services/auditEngine';
import { createAIProvider } from '../../services/aiProvider';
import { ChromePromptProvider } from '../../services/providers/chromeProvider';
import { toPipelineSessionSnapshot } from '../../services/pipelineSession';
import {
  buildDiagnosisInputPackageV2,
  buildEvidenceEnvelopeV2,
  runStructuredDiagnosis,
} from '../../contracts/llm';
import {
  DIAGNOSIS_FRAGMENT_SYSTEM_INSTRUCTION_ES,
  buildDiagnosisFragmentRequestsV2,
} from '../../contracts/llm/diagnosisFragmentsV2';
import type { AIConfig, AIProvider } from '../../types';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const TITANIC_891 = path.join(REPO_ROOT, 'experiments/datasets/titanic.csv');
const SHA = 'c'.repeat(64);

/** Gemini Nano context window observed on Chrome 154 (session.contextWindow). */
const NANO_CONTEXT_TOKENS = 9216;
/** Conservative token estimate for Spanish/JSON text. */
const estimateTokens = (text: string) => Math.ceil(text.length / 3);

const auditTitanic = () => {
  const parsed = Papa.parse<Record<string, string>>(readFileSync(TITANIC_891, 'utf8'), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return runAudit(parsed.data, parsed.meta.fields ?? [], ',');
};

// ── 2026-10-03: every column reached the model as zeros ─────────────────────
describe('INV-1 · the audit engine output reaches the LLM with its statistics', () => {
  it('maps real ColumnStats (uniqueCount/topFreq) into the envelope', () => {
    const report = auditTitanic();
    expect(report.rowCount).toBe(891);
    const envelope = buildEvidenceEnvelopeV2(report as any, { privacyLevel: 'local_full', datasetSha256: SHA, delimiter: ',' });
    for (const column of envelope.columns) {
      const engine = report.columnStats[column.name];
      const sent = envelope.evidence.columnStats[column.columnId];
      if (!engine || !sent) continue;
      expect(sent.distinctCount, column.name).toBe(engine.uniqueCount);
      expect(sent.nullCount, column.name).toBe(engine.nullCount);
      expect(sent.nullPercentage, column.name).toBeCloseTo((engine.nullCount / report.rowCount) * 100, 1);
    }
    const cabin = envelope.columns.find((column) => column.name === 'Cabin')!;
    expect(envelope.evidence.columnStats[cabin.columnId].nullPercentage).toBeGreaterThan(70);
  });
});

// ── 2026-10-03: the lazy wrapper hid provider methods ───────────────────────
describe('INV-2 · provider wrappers expose every capability of the real provider', () => {
  const OPTIONAL_CAPABILITIES = ['generateTextWithProgress', 'generateStructuredFragment', 'preloadModel', 'unloadModel'] as const;

  it('LazyChromeProvider forwards what ChromePromptProvider implements', () => {
    const wrapper = createAIProvider({ providerType: 'chrome', model: 'gemini-nano', temperature: 0.1 } as AIConfig) as AIProvider & Record<string, unknown>;
    for (const capability of OPTIONAL_CAPABILITIES) {
      const implemented = typeof (ChromePromptProvider.prototype as unknown as Record<string, unknown>)[capability] === 'function';
      if (implemented) expect(typeof wrapper[capability], capability).toBe('function');
    }
  });
});

// ── 2026-10-03: Nano received a 6.8k-token prompt in a 9.2k window ──────────
describe('INV-3 · Gemini Nano is diagnosed per issue and every request fits its context', () => {
  const originalLanguageModel = (globalThis as any).LanguageModel;
  afterEach(() => { (globalThis as any).LanguageModel = originalLanguageModel; });

  it('routes Chrome through fragments, streams string chunks and stays within budget', async () => {
    const report = auditTitanic();
    const sentPrompts: string[] = [];
    const constrained: boolean[] = [];

    /** Chrome 154 shape: string deltas, clone(), contextWindow. */
    const makeSession = (system?: string): any => ({
      contextWindow: NANO_CONTEXT_TOKENS,
      clone: async () => makeSession(system),
      destroy: () => undefined,
      prompt: async () => { throw new Error('prompt() must not be used when streaming works'); },
      promptStreaming: (input: string, options?: { responseConstraint?: unknown }) => {
        sentPrompts.push(`${system ?? ''}\n${input}`);
        constrained.push(Boolean(options?.responseConstraint));
        const body = JSON.stringify({
          hypothesis: 'Hipótesis', observation: 'Observación con la cifra dada.', recommendation: 'Revisar el origen.',
          confidence: 0.5, requiresHumanReview: true, evidenceRefs: [], limits: [],
        });
        const chunks = body.match(/.{1,7}/g) ?? [];
        return new ReadableStream<string>({ start(controller) { chunks.forEach((c) => controller.enqueue(c)); controller.close(); } });
      },
    });
    (globalThis as any).LanguageModel = {
      availability: async () => 'available',
      create: async (options?: { initialPrompts?: Array<{ content: string }> }) => makeSession(options?.initialPrompts?.[0]?.content),
    };

    const provider = createAIProvider({ providerType: 'chrome', model: 'gemini-nano', temperature: 0.1 } as AIConfig);
    const outcome = await runStructuredDiagnosis(report as any, {
      provider,
      auditEvidence: { datasetSha256: SHA },
      requestedModel: 'gemini-nano',
    });

    expect('success' in outcome && outcome.success, JSON.stringify((outcome as any).code ?? '')).toBe(true);
    expect(sentPrompts).toHaveLength(report.issues.length);
    expect(constrained.every(Boolean)).toBe(true);
    for (const prompt of sentPrompts) {
      expect(prompt).not.toContain('=== REQUIRED RESPONSE JSON SCHEMA ===');
      // Leave at least a third of the window for the answer.
      expect(estimateTokens(prompt)).toBeLessThan(NANO_CONTEXT_TOKENS * 0.66);
    }
    if ('success' in outcome && outcome.success) {
      expect(outcome.result.executionReceipt?.fragmentedExecution?.requestCount).toBe(report.issues.length);
      // AURA does not control Nano's sampling; the receipt must not claim it does.
      expect(outcome.result.executionReceipt?.inferenceHash).toBeTruthy();
    }
  });

  it('the largest allowed envelope still fits per request', () => {
    const report = auditTitanic();
    const envelope = buildEvidenceEnvelopeV2(report as any, { privacyLevel: 'local_full', datasetSha256: SHA, delimiter: ',' });
    const input = buildDiagnosisInputPackageV2(report as any, envelope, 'recommended');
    for (const request of buildDiagnosisFragmentRequestsV2(input)) {
      const total = DIAGNOSIS_FRAGMENT_SYSTEM_INSTRUCTION_ES + request.prompt + JSON.stringify(request.responseSchema);
      expect(estimateTokens(total), request.issueId).toBeLessThan(NANO_CONTEXT_TOKENS * 0.5);
    }
  });
});

// ── 2026-10-03: 891 rows persisted in localStorage ──────────────────────────
describe('INV-4 · the persisted session never contains dataset rows', () => {
  it('no row value survives serialization', () => {
    const SENTINEL = 'ROW-VALUE-7f3a91';
    const snapshot = toPipelineSessionSnapshot({
      rawData: [{ Name: SENTINEL }],
      improvementRun: { simulatedData: [{ Name: SENTINEL }] },
    } as any);
    expect(JSON.stringify(snapshot)).not.toContain(SENTINEL);
  });
});
