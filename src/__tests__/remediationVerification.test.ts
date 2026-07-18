import { describe, expect, it } from 'vitest';
import { sha256BytesHex, sha256hex } from '../contracts/llm/hash';
import {
  buildPythonExecutionBundle,
  buildPythonExecutionReceipt,
} from '../services/remediationExecution/pythonExecutionContract';
import type {
  PythonExecutionBundleV1,
  PythonExecutionReceiptV1,
} from '../services/remediationExecution/pythonExecutionContract';
import {
  buildRemediationVerification,
  compareQualityFindings,
  deriveVerificationOutcome,
} from '../services/remediationExecution/remediationVerification';
import type { AuditReport, QualityIssue } from '../types';
import { IssueCategory, IssueSeverity } from '../types';

const SCRIPT = 'import pandas as pd\n\ndef clean_dataset(df):\n    return df\n';
const BEFORE_CSV = 'email,name\nbad, Ana \nana@example.com,Bob\n';
const AFTER_CSV = 'email,name\nana@example.com,Ana\nana@example.com,Bob\n';
const ENVELOPE_REF = `env:${'c'.repeat(64)}`;
const DIAGNOSIS_RECEIPT_HASH = 'b'.repeat(64);
const encode = (value: string) => new TextEncoder().encode(value);

const buildBundle = (
  script = SCRIPT,
  sourceCsv = encode(BEFORE_CSV),
): PythonExecutionBundleV1 => buildPythonExecutionBundle({
  generatedAt: '2026-07-18T12:00:00.000Z',
  executionId: 'exec:reaudit-32',
  approvedScriptHash: sha256hex(JSON.stringify({ scriptText: script })),
  beforeDatasetSha256: sha256BytesHex(sourceCsv),
  scriptText: script,
  scriptHashPayload: { scriptText: script },
  inputReceiptRef: DIAGNOSIS_RECEIPT_HASH,
  evidenceEnvelopeRef: ENVELOPE_REF,
});

const buildReceipt = (
  bundle: PythonExecutionBundleV1,
  correctedCsv = encode(AFTER_CSV),
  overrides: Partial<PythonExecutionReceiptV1> = {},
): PythonExecutionReceiptV1 => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: bundle.runId,
  approvedScriptHash: bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256,
  afterDatasetSha256: sha256BytesHex(correctedCsv),
  pythonVersion: '3.12.1',
  pandasVersion: '2.2.0',
  platform: 'darwin',
  bundleHash: bundle.bundleHash,
  inputReceiptRef: bundle.inputReceiptRef,
  evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed',
    startedAt: '2026-07-18T12:01:00.000Z',
    completedAt: '2026-07-18T12:01:01.000Z',
    durationMs: 1000,
    stdoutSha256: sha256hex(''),
    stderrSha256: sha256hex(''),
    error: null,
  },
  output: { rowCount: 2, columnCount: 2 },
  ...overrides,
});

const validInput = () => {
  const sourceCsv = encode(BEFORE_CSV);
  const correctedCsv = encode(AFTER_CSV);
  const bundle = buildBundle(SCRIPT, sourceCsv);
  return {
    bundle,
    receipt: buildReceipt(bundle, correctedCsv),
    sourceCsv,
    correctedCsv,
    evidenceEnvelopeRef: ENVELOPE_REF,
  };
};

const issue = (
  id: string,
  ruleId: string,
  column: string | undefined,
  count: number,
): QualityIssue => ({
  id,
  ruleId,
  column,
  ruleName: ruleId,
  category: IssueCategory.HYGIENE,
  description: 'fixture',
  severity: IssueSeverity.WARNING,
  count,
  affectedPercentage: count * 10,
  sampleValues: [],
});

const report = (score: number, issues: QualityIssue[]): AuditReport => ({
  score,
  rowCount: 10,
  colCount: 2,
  duplicateRows: 0,
  issues,
  columnStats: {},
  scoreBreakdown: [],
  delimiterDetected: ',',
});

describe('remediationVerification — #32 trust contract', () => {
  it.each([
    {
      name: 'resolved',
      before: report(70, [issue('email', 'rule:invalid-email', 'email', 2)]),
      after: report(100, []),
      expected: { resolved: 1, persistent: 0, new: 0, outcome: 'improved' },
    },
    {
      name: 'persistent-count-change',
      before: report(70, [issue('nulls', 'rule:null-values', 'email', 5)]),
      after: report(80, [issue('nulls', 'rule:null-values', 'email', 2)]),
      expected: { resolved: 0, persistent: 1, new: 0, outcome: 'improved' },
    },
    {
      name: 'new',
      before: report(100, []),
      after: report(80, [issue('mixed', 'rule:mixed-types', 'age', 1)]),
      expected: { resolved: 0, persistent: 0, new: 1, outcome: 'worsened' },
    },
    {
      name: 'zero-findings',
      before: report(100, []),
      after: report(100, []),
      expected: { resolved: 0, persistent: 0, new: 0, outcome: 'unchanged' },
    },
    {
      name: 'contradictory-signals',
      before: report(60, [issue('old', 'rule:null-values', 'email', 1)]),
      after: report(80, [
        issue('old', 'rule:null-values', 'email', 1),
        issue('new', 'rule:mixed-types', 'age', 1),
      ]),
      expected: { resolved: 0, persistent: 1, new: 1, outcome: 'inconclusive' },
    },
    {
      name: 'net-improvement-with-new-finding',
      before: report(60, [
        issue('old-a', 'rule:null-values', 'email', 2),
        issue('old-b', 'rule:trim-whitespace', 'name', 2),
        issue('persistent', 'rule:invalid-email', 'email', 1),
      ]),
      after: report(80, [
        issue('persistent', 'rule:invalid-email', 'email', 1),
        issue('new', 'rule:mixed-types', 'age', 1),
      ]),
      expected: { resolved: 2, persistent: 1, new: 1, outcome: 'inconclusive' },
    },
  ])('matches the expected five-fixture matrix: $name', ({ before, after, expected }) => {
    const findings = compareQualityFindings(before, after);
    const outcome = deriveVerificationOutcome({
      beforeScore: before.score,
      afterScore: after.score,
      beforeIssueCount: before.issues.length,
      afterIssueCount: after.issues.length,
      resolvedCount: findings.resolved.length,
      newCount: findings.new.length,
    });

    expect({
      resolved: findings.resolved.length,
      persistent: findings.persistent.length,
      new: findings.new.length,
      outcome,
    }).toEqual(expected);
  });

  it('keeps the same rule in different columns as separate finding identities', () => {
    const before = report(80, [
      issue('trim-name', 'rule:trim-whitespace', 'name', 2),
      issue('trim-address', 'rule:trim-whitespace', 'address', 3),
    ]);
    const after = report(90, [issue('trim-address', 'rule:trim-whitespace', 'address', 1)]);

    const comparison = compareQualityFindings(before, after);

    expect(comparison.resolved).toHaveLength(1);
    expect(comparison.resolved[0].column).toBe('name');
    expect(comparison.persistent).toHaveLength(1);
    expect(comparison.persistent[0].before.column).toBe('address');
    expect(comparison.persistent[0].after.count).toBe(1);
  });

  it('fails closed instead of collapsing a true canonical identity collision', () => {
    const duplicate = issue('same', 'rule:null-values', 'email', 1);

    expect(() => compareQualityFindings(report(70, [duplicate, { ...duplicate }]), report(70, [])))
      .toThrow(/REMEDIATION_FINDING_IDENTITY_COLLISION:before/);
  });

  it('classifies resolved, persistent and new findings by canonical identity', () => {
    const before = report(70, [
      issue('resolved', 'rule:null-values', 'email', 4),
      issue('persistent', 'rule:trim-whitespace', 'name', 5),
    ]);
    const after = report(75, [
      issue('persistent', 'rule:trim-whitespace', 'name', 2),
      issue('new', 'rule:mixed-types', 'age', 1),
    ]);

    const comparison = compareQualityFindings(before, after);

    expect(comparison.resolved.map((item) => item.id)).toEqual(['resolved']);
    expect(comparison.persistent.map((item) => item.before.id)).toEqual(['persistent']);
    expect(comparison.new.map((item) => item.id)).toEqual(['new']);
  });

  it('keeps a persistent identity when only count and percentage change', () => {
    const comparison = compareQualityFindings(
      report(70, [issue('same', 'rule:null-values', 'email', 8)]),
      report(80, [issue('same', 'rule:null-values', 'email', 3)]),
    );

    expect(comparison.persistent).toHaveLength(1);
    expect(comparison.persistent[0].before.count).toBe(8);
    expect(comparison.persistent[0].after.count).toBe(3);
  });

  it('returns inconclusive when score and issue-count signals contradict each other', () => {
    expect(deriveVerificationOutcome({
      beforeScore: 60,
      afterScore: 80,
      beforeIssueCount: 2,
      afterIssueCount: 3,
      resolvedCount: 0,
      newCount: 1,
    })).toBe('inconclusive');
  });

  it('does not sell equal resolved/new finding churn as improvement from score alone', () => {
    expect(deriveVerificationOutcome({
      beforeScore: 60,
      afterScore: 80,
      beforeIssueCount: 2,
      afterIssueCount: 2,
      resolvedCount: 1,
      newCount: 1,
    })).toBe('inconclusive');
  });

  it('does not sell net issue reduction as improvement when a new finding appears', () => {
    expect(deriveVerificationOutcome({
      beforeScore: 60,
      afterScore: 80,
      beforeIssueCount: 3,
      afterIssueCount: 2,
      resolvedCount: 2,
      newCount: 1,
    })).toBe('inconclusive');
  });

  it('blocks reaudit when the Python receipt did not validate a successful execution', () => {
    const input = validInput();
    const { receiptHash: _receiptHash, ...receiptPayload } = input.receipt;
    const failedReceipt = buildPythonExecutionReceipt({
      ...receiptPayload,
      syntax: { status: 'failed', error: 'SyntaxError' },
      execution: { ...input.receipt.execution, status: 'failed', error: 'not executed' },
      afterDatasetSha256: null,
      output: null,
    });

    expect(() => buildRemediationVerification({ ...input, receipt: failedReceipt }))
      .toThrow(/REMEDIATION_VERIFICATION_CHAIN_INVALID/);
  });

  it('blocks when corrected CSV bytes no longer match the certified hash', () => {
    const input = validInput();

    expect(() => buildRemediationVerification({
      ...input,
      correctedCsv: encode('email,name\neve@example.com,Eve\n'),
    })).toThrow(/output CSV hash mismatch/);
  });

  it('blocks at the new builder when source CSV bytes change after bundle creation', () => {
    const input = validInput();

    expect(() => buildRemediationVerification({
      ...input,
      sourceCsv: encode('email,name\neve@example.com,Eve\n'),
    })).toThrow(/source dataset hash mismatch/);
  });

  it('blocks at the new builder when receiptHash is adulterated', () => {
    const input = validInput();

    expect(() => buildRemediationVerification({
      ...input,
      receipt: { ...input.receipt, receiptHash: 'a'.repeat(64) },
    })).toThrow(/receipt hash is invalid/);
  });

  it('blocks at the new builder when bundleHash is adulterated', () => {
    const input = validInput();

    expect(() => buildRemediationVerification({
      ...input,
      bundle: { ...input.bundle, bundleHash: 'a'.repeat(64) },
    })).toThrow(/bundle bundleHash mismatch/);
  });

  it('blocks at the new builder when evidenceEnvelopeRef differs from the bundle', () => {
    const input = validInput();

    expect(() => buildRemediationVerification({
      ...input,
      evidenceEnvelopeRef: `env:${'d'.repeat(64)}`,
    })).toThrow(/REMEDIATION_VERIFICATION_EVIDENCE_ENVELOPE_MISMATCH/);
  });

  it('does not mutate source bytes, corrected bytes, bundle or receipt', () => {
    const input = validInput();
    const sourceBefore = [...input.sourceCsv];
    const correctedBefore = [...input.correctedCsv];
    const bundleBefore = JSON.stringify(input.bundle);
    const receiptBefore = JSON.stringify(input.receipt);

    buildRemediationVerification(input);

    expect([...input.sourceCsv]).toEqual(sourceBefore);
    expect([...input.correctedCsv]).toEqual(correctedBefore);
    expect(JSON.stringify(input.bundle)).toBe(bundleBefore);
    expect(JSON.stringify(input.receipt)).toBe(receiptBefore);
  });

  it('invalidates the chain when an approved script changes', () => {
    const input = validInput();
    const changedBundle = buildBundle(`${SCRIPT}\n# changed`, input.sourceCsv);

    expect(() => buildRemediationVerification({ ...input, bundle: changedBundle }))
      .toThrow(/approved script hash mismatch|bundleHash/);
  });

  it('fails closed with a verifiable parse error for malformed corrected CSV', () => {
    const sourceCsv = encode(BEFORE_CSV);
    const correctedCsv = encode('email,name\n"unterminated,Ana\n');
    const bundle = buildBundle(SCRIPT, sourceCsv);
    const receipt = buildReceipt(bundle, correctedCsv, { output: { rowCount: 1, columnCount: 2 } });

    expect(() => buildRemediationVerification({
      bundle,
      receipt,
      sourceCsv,
      correctedCsv,
      evidenceEnvelopeRef: ENVELOPE_REF,
    })).toThrow(/CSV_PARSE_FAILED/);
  });

  it('links diagnosis, script, bundle, receipt, datasets and deterministic result', () => {
    const input = validInput();
    const result = buildRemediationVerification(input);

    expect(result.contractId).toBe('aura.remediation-verification.v1');
    expect(result.executionId).toBe(input.bundle.runId);
    expect(result.diagnosisReceiptHash).toBe(DIAGNOSIS_RECEIPT_HASH);
    expect(result.approvedScriptHash).toBe(input.bundle.approvedScriptHash);
    expect(result.executionBundleHash).toBe(input.bundle.bundleHash);
    expect(result.pythonReceiptHash).toBe(input.receipt.receiptHash);
    expect(result.sourceDatasetSha256).toBe(sha256BytesHex(input.sourceCsv));
    expect(result.correctedDatasetSha256).toBe(sha256BytesHex(input.correctedCsv));
    expect(result.after.rowCount).toBe(2);
    expect(result.after.columnCount).toBe(2);
  });
});
