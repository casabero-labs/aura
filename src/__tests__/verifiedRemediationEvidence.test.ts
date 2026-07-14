import { describe, expect, it } from 'vitest';
import {
  buildVerifiedRemediationEvidence,
  compareReauditRules,
} from '../services/remediationExecution/verifiedRemediationEvidence';
import {
  buildPythonExecutionBundle,
  buildPythonExecutionReceipt,
} from '../services/remediationExecution/pythonExecutionContract';
import type {
  PythonExecutionBundleV1,
  PythonExecutionReceiptV1,
} from '../services/remediationExecution/pythonExecutionContract';
import { sha256hex, sha256BytesHex } from '../contracts/llm/hash';

const SCRIPT_TEXT = 'import pandas as pd\n\ndef clean_dataset(df):\n    return df\n';
const SCRIPT_HASH = sha256hex(JSON.stringify({ scriptText: SCRIPT_TEXT }));

const BEFORE_CSV = `id,name,email
1,John,not_an_email
2,Jane,jane@example.com
3,Bob,also_invalid
`;

const AFTER_CSV = `id,name,email
1,John,john@example.com
2,Jane,jane@example.com
3,Bob,bob@example.com
`;

const ENVELOPE_REF = 'env:' + 'c'.repeat(64);
const encode = (text: string) => new TextEncoder().encode(text);
const BEFORE_BYTES = encode(BEFORE_CSV);
const AFTER_BYTES = encode(AFTER_CSV);
const FINGERPRINT = sha256BytesHex(BEFORE_BYTES);

const buildBundle = (): PythonExecutionBundleV1 => buildPythonExecutionBundle({
  generatedAt: '2026-07-13T12:00:00.000Z',
  executionId: 'run:verified',
  approvedScriptHash: SCRIPT_HASH,
  beforeDatasetSha256: FINGERPRINT,
  scriptText: SCRIPT_TEXT,
  scriptHashPayload: { scriptText: SCRIPT_TEXT },
  inputReceiptRef: 'b'.repeat(64),
  evidenceEnvelopeRef: ENVELOPE_REF,
});

const buildReceipt = (bundle: PythonExecutionBundleV1): PythonExecutionReceiptV1 => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: bundle.runId,
  approvedScriptHash: bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256,
  afterDatasetSha256: sha256BytesHex(AFTER_BYTES),
  pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'darwin',
  bundleHash: bundle.bundleHash,
  inputReceiptRef: bundle.inputReceiptRef,
  evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed', startedAt: '2026-07-13T12:01:00.000Z', completedAt: '2026-07-13T12:01:01.000Z',
    durationMs: 1000, stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
  },
  output: { rowCount: 3, columnCount: 3 },
});

const baseInput = () => {
  const bundle = buildBundle();
  return {
    bundle,
    receipt: buildReceipt(bundle),
    sourceCsv: BEFORE_BYTES,
    correctedCsv: AFTER_BYTES,
    evidenceEnvelopeRef: ENVELOPE_REF,
  };
};

describe('verifiedRemediationEvidence', () => {
  it('produces before/after score and issue counts from valid CSVs', () => {
    const evidence = buildVerifiedRemediationEvidence(baseInput());

    expect(typeof evidence.beforeAfterSummary.beforeScore).toBe('number');
    expect(typeof evidence.beforeAfterSummary.afterScore).toBe('number');
    expect(evidence.reaudit.summary.beforeIssueCount).toBeGreaterThanOrEqual(
      evidence.reaudit.summary.afterIssueCount,
    );
    expect(evidence.reaudit.beforeReport.rowCount).toBe(3);
    expect(evidence.reaudit.afterReport.rowCount).toBe(3);
    expect(evidence.beforeAfterSummary.beforeIssueCount).toBe(evidence.reaudit.beforeReport.issues.length);
    expect(evidence.beforeAfterSummary.afterIssueCount).toBe(evidence.reaudit.afterReport.issues.length);
  });

  it('carries the verified Python bundle, receipt and corrected CSV bytes', () => {
    const input = baseInput();
    const evidence = buildVerifiedRemediationEvidence(input);

    expect(evidence.bundle.bundleHash).toBe(input.bundle.bundleHash);
    expect(evidence.receipt.receiptHash).toBe(input.receipt.receiptHash);
    expect(evidence.correctedCsv).toEqual(AFTER_BYTES);
  });

  it('does not expose beforeOutput, afterOutput nor rawCsv', () => {
    const evidence = buildVerifiedRemediationEvidence(baseInput());

    expect((evidence.reaudit as Record<string, unknown>).beforeOutput).toBeUndefined();
    expect((evidence.reaudit as Record<string, unknown>).afterOutput).toBeUndefined();
    const serialized = JSON.stringify({ ...evidence, correctedCsv: undefined });
    expect(serialized).not.toContain('rawCsv');
    expect(serialized).not.toContain('beforeOutput');
    expect(serialized).not.toContain('afterOutput');
  });

  it('fails explicitly when the corrected CSV is empty', () => {
    expect(() => buildVerifiedRemediationEvidence({
      ...baseInput(),
      correctedCsv: encode('   '),
    })).toThrow(/corregido/);
  });

  it('fails explicitly when the source CSV is empty', () => {
    expect(() => buildVerifiedRemediationEvidence({
      ...baseInput(),
      sourceCsv: encode(''),
    })).toThrow(/fuente/);
  });

  it('derives corrected, persistent and new rule sets', () => {
    const evidence = buildVerifiedRemediationEvidence(baseInput());
    const comparison = compareReauditRules(evidence);

    expect(Array.isArray(comparison.correctedRuleIds)).toBe(true);
    expect(Array.isArray(comparison.persistentRuleIds)).toBe(true);
    expect(Array.isArray(comparison.newRuleIds)).toBe(true);
    const beforeRules = new Set(evidence.reaudit.beforeReport.issues.map((i) => i.ruleId));
    const afterRules = new Set(evidence.reaudit.afterReport.issues.map((i) => i.ruleId));
    comparison.correctedRuleIds.forEach((ruleId) => {
      expect(beforeRules.has(ruleId)).toBe(true);
      expect(afterRules.has(ruleId)).toBe(false);
    });
    comparison.newRuleIds.forEach((ruleId) => {
      expect(beforeRules.has(ruleId)).toBe(false);
      expect(afterRules.has(ruleId)).toBe(true);
    });
  });
});
