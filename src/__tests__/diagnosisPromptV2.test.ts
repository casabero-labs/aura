/**
 * Diagnosis Prompt v2 — Unit Tests.
 *
 * Tests: buildDiagnosisPromptV2, canonicalJson, buildEnvelopeRef.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDiagnosisPromptV2,
  canonicalJson,
  buildEnvelopeRef,
} from '../contracts/llm/diagnosisPromptV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { sha256hex } from '../contracts/llm/hash';

// ── Fixtures ──
const opts = (overrides: Record<string, unknown> = {}) => ({
  privacyLevel: 'local_full' as const,
  datasetSha256: 'abc123',
  delimiter: ',',
  ...overrides,
});

const minimalReport: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto', ruleName: 'Espacios Fantasma (Trim)', description: 'whitespace padding', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund, Mr. Owen Harris'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic lossless normalization' } },
    { id: 'integrity-null-Age', column: 'Age', category: 'Integridad', ruleName: 'Valores Nulos', description: 'nulls in Age', severity: 'warning', count: 177, affectedPercentage: 19.9, sampleValues: [null, 22, 38], ruleId: 'rule:null-values', automaticAuthorization: { actionType: 'null_values', authorized: false, conditionsMet: [], reason: 'No auto_safe for nulls' } },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} },
    Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
  },
  datasetProfile: { columns: [{ name: 'PassengerId' }, { name: 'Name' }, { name: 'Age' }] },
};

const envelope = _buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'local_full' }));

// ── Tests ──

describe('canonicalJson', () => {
  it('produces stable output for objects regardless of key insertion order', () => {
    const a = canonicalJson({ z: 1, a: 2 });
    const b = canonicalJson({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it('sorts nested object keys', () => {
    const a = canonicalJson({ outer: { b: 1, a: 2 } });
    expect(a).toContain('"a":2');
    expect(a).toContain('"b":1');
    expect(a.indexOf('"a":2')).toBeLessThan(a.indexOf('"b":1'));
  });

  it('preserves array order', () => {
    const a = canonicalJson([3, 1, 2]);
    expect(a).toBe('[3,1,2]');
  });

  it('handles null and primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
  });

  it('handles NaN and Infinity as null', () => {
    expect(canonicalJson(NaN)).toBe('null');
    expect(canonicalJson(Infinity)).toBe('null');
    expect(canonicalJson(-Infinity)).toBe('null');
  });

  it('handles nested arrays', () => {
    const a = canonicalJson({ items: [[1, 2], [3]] });
    expect(a).toBe('{"items":[[1,2],[3]]}');
  });
});

describe('buildEnvelopeRef', () => {
  it('returns env:<sha256> format', () => {
    const ref = buildEnvelopeRef(envelope);
    expect(ref).toMatch(/^env:[a-f0-9]{64}$/);
  });

  it('same envelope produces same ref (deterministic)', () => {
    const envelope2 = _buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'local_full' }));
    expect(buildEnvelopeRef(envelope)).toBe(buildEnvelopeRef(envelope2));
  });

  it('different envelope produces different ref', () => {
    const envelope2 = _buildEvidenceEnvelopeV2(
      { ...minimalReport, score: 80 },
      opts({ privacyLevel: 'local_full' }),
    );
    expect(buildEnvelopeRef(envelope)).not.toBe(buildEnvelopeRef(envelope2));
  });
});

describe('buildDiagnosisPromptV2', () => {
  it('returns a valid DiagnosisPromptPackageV2', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.contractId).toBe('aura.diagnosis.v2');
    expect(pkg.contractVersion).toBe('2.0.0');
    expect(pkg.evidenceEnvelopeRef).toMatch(/^env:/);
    expect(pkg.promptVersion).toBe('1.0.0');
    expect(pkg.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(pkg.systemInstruction.length).toBeGreaterThan(100);
    expect(pkg.userPayload.length).toBeGreaterThan(50);
    expect(pkg.responseSchema).toHaveProperty('additionalProperties', false);
    expect(pkg.generatedAt).toBeTruthy();
  });

  it('includes envelope ref in user payload', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.userPayload).toContain(pkg.evidenceEnvelopeRef);
  });

  it('includes all issue IDs in user payload', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.userPayload).toContain('hygiene-ghost-Name');
    expect(pkg.userPayload).toContain('integrity-null-Age');
  });

  it('system instruction prohibits Python', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.systemInstruction).toContain('NO Python');
    expect(pkg.systemInstruction).toContain('NO eval');
  });

  it('system instruction prohibits code blocks', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.systemInstruction).toContain('No markdown blocks');
    expect(pkg.systemInstruction).toContain('```');
  });

  it('responseSchema has additionalProperties: false on nested objects', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    const schema = pkg.responseSchema as any;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.issues.items.additionalProperties).toBe(false);
    expect(schema.properties.diagnosisBlocks.items.additionalProperties).toBe(false);
  });

  it('promptHash is deterministic for same input', () => {
    const pkg1 = buildDiagnosisPromptV2(envelope);
    const pkg2 = buildDiagnosisPromptV2(envelope);
    expect(pkg1.promptHash).toBe(pkg2.promptHash);
  });

  it('prompt declares untrusted content warning', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.systemInstruction).toContain('UNTRUSTED CONTENT');
  });

  it('prompt declares no new columns/rules', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    expect(pkg.systemInstruction).toContain('CANNOT create new columns');
  });
});

describe('UNTRUSTED_DATA block', () => {
  it('uses evidenceRef (not sampleRef) in evidenceSamples', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    const match = pkg.userPayload.match(/=== UNTRUSTED_DATA ===\s*(\{[\s\S]*?\})\s*===/);
    expect(match).toBeTruthy();
    const untrustedData = JSON.parse(match![1]);
    for (const issue of untrustedData.issues) {
      for (const sample of issue.evidenceSamples || []) {
        expect(sample).toHaveProperty('ref');
        expect(sample).not.toHaveProperty('sampleRef');
        expect(typeof sample.ref).toBe('string');
      }
    }
  });

  it('includes columnStats in untrustedData', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    const match = pkg.userPayload.match(/=== UNTRUSTED_DATA ===\s*(\{[\s\S]*?\})\s*===/);
    expect(match).toBeTruthy();
    const untrustedData = JSON.parse(match![1]);
    expect(untrustedData).toHaveProperty('columnStats');
    expect(typeof untrustedData.columnStats).toBe('object');
    expect(Object.keys(untrustedData.columnStats).length).toBeGreaterThan(0);
    for (const [colId, stats] of Object.entries(untrustedData.columnStats as Record<string, unknown>)) {
      expect(stats).toHaveProperty('inferredType');
      expect(stats).toHaveProperty('distinctCount');
      expect(stats).toHaveProperty('nullCount');
      expect(stats).toHaveProperty('nullPercentage');
    }
  });

  it('untrustedData JSON contains no undefined values', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    const match = pkg.userPayload.match(/=== UNTRUSTED_DATA ===\s*(\{[\s\S]*?\})\s*===/);
    expect(match).toBeTruthy();
    const untrustedDataStr = match![1];
    expect(untrustedDataStr).not.toContain('undefined');
  });

  it('evidenceSamples values are preserved as arrays', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    const match = pkg.userPayload.match(/=== UNTRUSTED_DATA ===\s*(\{[\s\S]*?\})\s*===/);
    expect(match).toBeTruthy();
    const untrustedData = JSON.parse(match![1]);
    for (const issue of untrustedData.issues) {
      for (const sample of issue.evidenceSamples || []) {
        expect(Array.isArray(sample.values)).toBe(true);
      }
    }
  });
});
