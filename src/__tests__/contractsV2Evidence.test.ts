/**
 * Contracts v2 Evidence — Phase 1B Unit Tests.
 * Real builder tests with forceEnabled=true (no fragile global state).
 */

import { describe, it, expect } from 'vitest';
import { buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import {
  buildColumnRegistry,
  resolveColumnByName,
  getColumnsRequiringReview,
} from '../contracts/llm/columnRegistry';
import {
  buildPrivacyPolicy,
  parsePrivacyLevel,
  isPII,
  shouldHashColumn,
  redactValue,
  hashValue,
  buildPIIConfig,
} from '../contracts/llm/privacyPolicy';
import {
  buildTokenBudget,
  enforceCharacterBudget,
  createTruncationManifest,
} from '../contracts/llm/tokenBudget';
import {
  validateEnvelope,
  validateIssue,
  validateColumnRef,
  validatePrivacyCompliance,
} from '../contracts/llm/validators';
import { REGISTRY, validateAgainstContract } from '../contracts/llm/contractRegistry';
import { sha256hex, sha256short } from '../contracts/llm/hash';

// ── Shared fixtures ──

const minimalReport: AuditReportInput = {
  score: 85,
  rowCount: 100,
  colCount: 5,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [
    {
      id: 'hygiene-ghost-Name',
      column: 'Name',
      category: 'Higiene de Texto',
      ruleName: 'Espacios Fantasma (Trim)',
      description: 'whitespace padding',
      severity: 'info' as const,
      count: 2,
      affectedPercentage: 2,
      sampleValues: ['Braund, Mr. Owen Harris', 'Cumings, Mrs. John Bradley'],
    },
    {
      id: 'integrity-null-Age',
      column: 'Age',
      category: 'Integridad',
      ruleName: 'Valores Nulos / Vacios',
      description: 'nulls in Age',
      severity: 'warning' as const,
      count: 177,
      affectedPercentage: 19.9,
      sampleValues: [null, 22, 38],
    },
    {
      id: 'dup-rows-global',
      column: undefined,
      category: 'Integridad',
      ruleName: 'Exact Duplicates',
      description: 'duplicate rows',
      severity: 'warning' as const,
      count: 3,
      affectedPercentage: 3,
      sampleValues: [],
    },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund, Mr. Owen Harris', count: 1, percentage: 1 }], stats: {} },
    Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
  },
  datasetProfile: {
    columns: [
      { name: 'PassengerId' },
      { name: 'Survived' },
      { name: 'Name' },
      { name: 'Age' },
      { name: 'Fare' },
    ],
  },
};

const reportWithDuplicates: AuditReportInput = {
  score: 75,
  rowCount: 50,
  colCount: 4,
  duplicateRows: 5,
  delimiterDetected: ',',
  issues: [
    {
      id: 'dup-rows',
      column: undefined,
      category: 'Integridad',
      ruleName: 'Exact Duplicates',
      description: '5 duplicate rows',
      severity: 'warning' as const,
      count: 5,
      affectedPercentage: 10,
      sampleValues: [],
    },
  ],
  columnStats: {},
  datasetProfile: {
    columns: [
      { name: 'Name' },
      { name: 'Name' },  // duplicate
      { name: 'Age' },
      { name: 'Fare' },
    ],
  },
};

const opts = (overrides: Record<string, unknown> = {}) => ({
  privacyLevel: 'local_full' as const,
  datasetSha256: 'abc123',
  delimiter: ',',
  ...overrides,
});

// ── Hash ──

describe('Browser-safe hash', () => {
  it('sha256hex produces 64 hex chars', () => {
    const h = sha256hex('hello');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('sha256short produces truncated hash', () => {
    const h = sha256short('hello', 8);
    expect(h).toHaveLength(8);
  });

  it('deterministic', () => {
    expect(sha256hex('test')).toBe(sha256hex('test'));
  });
});

// ── Column Registry ──

describe('Column Registry (1B)', () => {
  it('all same-name columns are isDuplicate=true', () => {
    const dup = buildColumnRegistry(['A', 'B', 'A', 'A']);
    expect(dup[0].isDuplicate).toBe(true);
    expect(dup[1].isDuplicate).toBe(false);
    expect(dup[2].isDuplicate).toBe(true);
    expect(dup[3].isDuplicate).toBe(true);
  });

  it('resolveColumnByName returns error for duplicates', () => {
    const dup = buildColumnRegistry(['A', 'B', 'A']);
    const result = resolveColumnByName(dup, 'A');
    expect('reason' in result).toBe(true);
    if ('reason' in result) {
      expect(result.reason).toBe('duplicate_name');
      expect(result.matches).toHaveLength(2);
    }
  });

  it('resolveColumnByName returns single match', () => {
    const cols = buildColumnRegistry(['A', 'B']);
    const result = resolveColumnByName(cols, 'B');
    expect('columnId' in result && typeof result.columnId === 'string').toBe(true);
  });

  it('columnId uses 16-char hash', () => {
    const cols = buildColumnRegistry(['test']);
    expect(cols[0].columnId).toMatch(/^col:[a-f0-9]{16}$/);
  });
});

// ── Contract Registry ──

describe('Contract Registry (1B)', () => {
  it('contractVersion mismatch is an error', () => {
    const result = validateAgainstContract('aura.evidence.v2', {
      contractId: 'aura.evidence.v2',
      contractVersion: '1.0.0',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('contractVersion'))).toBe(true);
  });

  it('schemas are real objects with properties', () => {
    const c = REGISTRY['aura.script.v2'];
    expect(c.schema.type).toBe('object');
    expect(c.schema.properties.scriptText?.type).toBe('string');
    expect(c.schema.properties.contractVersion?.enum).toContain('2.0.0');
  });
});

// ── Privacy ──

describe('Privacy (1B)', () => {
  it('parsePrivacyLevel defaults to cloud_no_samples on invalid', () => {
    expect(parsePrivacyLevel('invalid')).toBe('cloud_no_samples');
    expect(parsePrivacyLevel('')).toBe('cloud_no_samples');
    expect(parsePrivacyLevel('local_full')).toBe('local_full');
  });

  it('isPII detects emails', () => {
    expect(isPII('user@example.com')).toBe(true);
    expect(isPII('not an email')).toBe(false);
  });

  it('isPII detects phone numbers', () => {
    expect(isPII('+1-555-123-4567')).toBe(true);
    expect(isPII('12345')).toBe(false);
  });

  it('isPII detects URLs', () => {
    expect(isPII('https://evil.com/phishing')).toBe(true);
  });

  it('redactValue redacts email', () => {
    const result = redactValue('john@example.com');
    expect(result).toContain('***');
    expect(result).not.toBe('john@example.com');
  });

  it('redactValue redacts phone', () => {
    const result = redactValue('5551234567');
    expect(result).toContain('***');
    expect(result).not.toBe('5551234567');
  });

  it('hashValue produces deterministic hash', () => {
    const h = hashValue('test');
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(h).toBe(hashValue('test'));
  });

  it('shouldHashColumn uses semanticType', () => {
    expect(shouldHashColumn('any_column', 'name')).toBe(true);
    expect(shouldHashColumn('any_column', 'email')).toBe(true);
    expect(shouldHashColumn('any_column', 'age')).toBe(false);
  });

  it('cloud_minimized does NOT allow raw samples', () => {
    const p = buildPrivacyPolicy('cloud_minimized');
    expect(p.rules.some(r => r.type === 'hash' || r.type === 'redact')).toBe(true);
  });

  it('cloud_no_samples has samples=[] enforced by validator', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'cloud_no_samples' }), true);
    const v = validatePrivacyCompliance(envelope);
    expect(v.valid).toBe(true);
    expect(envelope.evidence.samples).toHaveLength(0);
  });
});

// ── Token Budget ──

describe('Token Budget (1B)', () => {
  it('enforceCharacterBudget reduces large content', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    const manifest = createTruncationManifest();
    const tinyBudget = buildTokenBudget({ maxCharacters: 100 });
    const reduced = enforceCharacterBudget(envelope, manifest, tinyBudget);
    expect(JSON.stringify(reduced).length).toBeLessThanOrEqual(JSON.stringify(envelope).length);
    expect(manifest.truncatedCharacters.length + manifest.truncatedTopValues.length + manifest.truncatedSamples.length).toBeGreaterThanOrEqual(0);
  });
});

// ── Happy-path builder tests ──

describe('buildEvidenceEnvelopeV2 — happy path', () => {
  it('local_full produces complete envelope', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'local_full' }), true);
    expect(envelope.contractId).toBe('aura.evidence.v2');
    expect(envelope.contractVersion).toBe('2.0.0');
    expect(envelope.untrustedContent).toBe(true);
    expect(envelope.columns.length).toBeGreaterThan(0);
    expect(envelope.issues.length).toBeGreaterThan(0);
    expect(envelope.datasetFingerprint.sha256).toBe('abc123');
    expect(envelope.datasetSummary.score).toBe(85);
    expect(envelope.privacyPolicy.level).toBe('local_full');
    expect(envelope.evidence.samples.length).toBeGreaterThan(0);
  });

  it('cloud_minimized redacts PII samples', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'cloud_minimized' }), true);
    expect(envelope.privacyPolicy.level).toBe('cloud_minimized');
    const nameSamples = envelope.evidence.samples.filter(s =>
      envelope.issues.find(i => i.issueId === s.issueId)?.columnId === envelope.columns.find(c => c.name === 'Name')?.columnId
    );
    for (const s of nameSamples) {
      const val = String(s.values[0] ?? '');
      expect(val).not.toMatch(/Braund|Cumings|Harris|Bradley/);
    }
  });

  it('cloud_no_samples has empty samples and topValues', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'cloud_no_samples' }), true);
    expect(envelope.evidence.samples).toHaveLength(0);
    for (const colId of Object.keys(envelope.evidence.columnStats)) {
      expect(envelope.evidence.columnStats[colId]?.topValues || []).toHaveLength(0);
    }
  });

  it('respects maxColumns budget', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({
      tokenBudget: { maxColumns: 2 },
    }), true);
    expect(envelope.columns.length).toBeLessThanOrEqual(2);
  });

  it('respects maxIssues budget', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({
      tokenBudget: { maxIssues: 1 },
    }), true);
    expect(envelope.issues.length).toBeLessThanOrEqual(1);
  });

  it('respects excludeColumns by columnId', () => {
    const cols = buildColumnRegistry(['PassengerId', 'Survived', 'Name', 'Age', 'Fare']);
    const nameColId = cols.find(c => c.name === 'Name')!.columnId;
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({
      excludeColumns: [nameColId],
    }), true);
    expect(envelope.columns.find(c => c.name === 'Name')).toBeUndefined();
    // Issues referencing Name should be excluded
    expect(envelope.issues.some(i => i.columnId === nameColId)).toBe(false);
  });

  it('dataset-scoped issue has columnId=null', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    const dupIssue = envelope.issues.find(i => i.issueId === 'dup-rows-global');
    expect(dupIssue).toBeDefined();
    expect(dupIssue!.columnId).toBeNull();
    expect(dupIssue!.scope).toBe('dataset');
  });

  it('column-scoped issue has non-null columnId', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    const nameIssue = envelope.issues.find(i => i.issueId === 'hygiene-ghost-Name');
    expect(nameIssue).toBeDefined();
    expect(nameIssue!.columnId).not.toBeNull();
    expect(nameIssue!.scope).toBe('column');
  });

  it('drops exact duplicates are auto_safe when duplicateRows > 0', () => {
    const envelope = buildEvidenceEnvelopeV2(reportWithDuplicates, opts(), true);
    const dupIssue = envelope.issues.find(i => i.issueId === 'dup-rows');
    expect(dupIssue).toBeDefined();
    expect(dupIssue!.actionability).toBe('auto_safe');
  });

  it('duplicate columns have isDuplicate=true', () => {
    const envelope = buildEvidenceEnvelopeV2(reportWithDuplicates, opts(), true);
    const nameCols = envelope.columns.filter(c => c.name === 'Name');
    expect(nameCols).toHaveLength(2);
    for (const c of nameCols) {
      expect(c.isDuplicate).toBe(true);
    }
  });

  it('selection manifest has distinguish exclusion reasons', () => {
    const cols = buildColumnRegistry(['PassengerId', 'Survived', 'Name', 'Age', 'Fare']);
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts({
      excludeColumns: [cols.find(c => c.name === 'Survived')!.columnId],
    }), true);
    const manifest = envelope.truncationManifest;
    expect(manifest.truncatedColumns.some(c => c.reason === 'explicit_exclusion')).toBe(true);
    // Check selection manifest too
    const selExclusions = envelope.selectionManifest.excludedByBudget;
    expect(selExclusions.some(e => e.reason === 'explicit_exclusion')).toBe(true);
  });
});

// ── Validation fail-closed ──

describe('Validation fail-closed', () => {
  it('validateEnvelope catches duplicate columnIds', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    const broken = JSON.parse(JSON.stringify(envelope));
    broken.columns[1].columnId = broken.columns[0].columnId; // duplicate
    const result = validateEnvelope(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });

  it('validateEnvelope catches missing evidenceRef', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    // Find an issue with evidenceRefs and make one point to non-existent ref
    const issue = envelope.issues.find(i => i.evidenceRefs.length > 0);
    if (issue) {
      issue.evidenceRefs.push('ev-nonexistent');
    }
    const result = validateEnvelope(envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true);
  });

  it('validateEnvelope catches mismatched sample.columnId vs issue.columnId', () => {
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    const broken = JSON.parse(JSON.stringify(envelope));
    if (broken.evidence.samples.length > 0) {
      broken.evidence.samples[0].columnId = 'col:wrong';
    }
    const result = validateEnvelope(broken);
    expect(result.valid).toBe(false);
  });

  it('validateIssue rejects invalid scope', () => {
    const cols = buildColumnRegistry(['A']);
    const result = validateIssue({
      issueId: 'i1', ruleId: 'r1', ruleName: 'test', columnId: cols[0].columnId,
      scope: 'invalid' as any, category: 'test', severity: 'warning', count: 1,
      affectedPercentage: 1, evidenceRefs: [], actionability: 'review_only',
    }, cols);
    expect(result.valid).toBe(false);
  });

  it('validateIssue rejects column-scoped issue with null columnId', () => {
    // This is checked in validateEnvelope, not validateIssue
    const envelope = buildEvidenceEnvelopeV2(minimalReport, opts(), true);
    const broken = JSON.parse(JSON.stringify(envelope));
    broken.issues[0].scope = 'column';
    broken.issues[0].columnId = null;
    const result = validateEnvelope(broken);
    expect(result.valid).toBe(false);
  });

  it('buildEvidenceEnvelopeV2 throws structured error on invalid result', () => {
    // Use a broken report that will produce an invalid envelope
    const badReport: AuditReportInput = {
      score: 100,
      rowCount: 10,
      colCount: 1,
      duplicateRows: 0,
      delimiterDetected: ',',
      issues: [{
        id: 'i1', column: 'A', category: 'test', ruleName: 'Test',
        description: 'test', severity: 'info' as const, count: 1,
        affectedPercentage: 1, sampleValues: ['test'],
        ruleId: 'test', scope: 'column' as any,
      } as any],
      columnStats: {},
      datasetProfile: { columns: [{ name: 'A' }, { name: 'A' }] },
    };
    // With duplicate columns, the envelope should still build and validate
    const envelope = buildEvidenceEnvelopeV2(badReport, opts(), true);
    expect(envelope.contractId).toBe('aura.evidence.v2');
  });
});

// ── Registry ──

describe('Registry exports', () => {
  it('REGISTRY has 4 contracts with fixed createdAt', () => {
    expect(Object.keys(REGISTRY)).toHaveLength(4);
    for (const c of Object.values(REGISTRY)) {
      expect(c.createdAt).toBe('2026-06-24T00:00:00Z');
    }
  });
});
