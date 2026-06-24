/**
 * Contracts v2 Evidence — Phase 1C Unit Tests.
 * Uses _buildEvidenceEnvelopeV2 (internal, no gate).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { _buildEvidenceEnvelopeV2, ContractsV2Error } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import {
  buildColumnRegistry,
  resolveColumn,
  getColumnsRequiringReview,
  generateSafeColumnDict,
} from '../contracts/llm/columnRegistry';
import {
  buildPrivacyPolicy,
  parsePrivacyLevel,
  isPII,
  shouldHashColumn,
  redactValue,
  hashValue,
} from '../contracts/llm/privacyPolicy';
import { buildTokenBudget, enforceCharacterBudget, createTruncationManifest } from '../contracts/llm/tokenBudget';
import { validateEnvelope, validatePrivacyCompliance } from '../contracts/llm/validators';
import { REGISTRY, validateAgainstContract } from '../contracts/llm/contractRegistry';
import { sha256hex, sha256short, KNOWN_VECTORS, setForcePureJS } from '../contracts/llm/hash';
import * as ContractsV2 from '../contracts/llm/index';

const opts = (overrides: Record<string, unknown> = {}) => ({
  privacyLevel: 'local_full' as const,
  datasetSha256: 'abc123',
  delimiter: ',',
  ...overrides,
});

const minimalReport: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto', ruleName: 'Espacios Fantasma (Trim)', description: 'whitespace padding', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund, Mr. Owen Harris', 'Cumings, Mrs. John Bradley'] },
    { id: 'integrity-null-Age', column: 'Age', category: 'Integridad', ruleName: 'Valores Nulos / Vacios', description: 'nulls in Age', severity: 'warning', count: 177, affectedPercentage: 19.9, sampleValues: [null, 22, 38] },
    { id: 'dup-rows-global', column: undefined, category: 'Integridad', ruleName: 'Exact Duplicates', description: 'duplicate rows', severity: 'warning', count: 3, affectedPercentage: 3, sampleValues: [] },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund, Mr. Owen Harris', count: 1, percentage: 1 }], stats: {} },
    Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
  },
  datasetProfile: { columns: [{ name: 'PassengerId' }, { name: 'Survived' }, { name: 'Name' }, { name: 'Age' }, { name: 'Fare' }] },
  scoreBreakdown: [
    { reason: 'Espacios Fantasma en [Name]', points: 3, category: 'HYGIENE', severity: 'INFO', ruleId: 'rule:whitespace' },
    { reason: 'Valores Nulos en [Age]', points: 5, category: 'INTEGRITY', severity: 'WARNING', ruleId: 'rule:null' },
  ],
};

const reportWithDups: AuditReportInput = {
  score: 75, rowCount: 50, colCount: 4, duplicateRows: 5, delimiterDetected: ',',
  issues: [
    { id: 'dup-rows', column: undefined, category: 'INTEGRITY', ruleName: 'Exact Duplicates', description: 'Filas Duplicadas (5)', severity: 'warning', count: 5, affectedPercentage: 10, sampleValues: [] },
  ],
  columnStats: {},
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Name' }, { name: 'Age' }, { name: 'Fare' }] },
  scoreBreakdown: [
    { reason: 'Filas Duplicadas (5)', points: 2, category: 'INTEGRITY', severity: 'WARNING', ruleId: 'rule:dupes' },
  ],
};

// ── Hash known vectors ──
describe('Hash — known vectors', () => {
  it('empty string', () => expect(sha256hex('')).toBe(KNOWN_VECTORS['']));
  it('abc', () => expect(sha256hex('abc')).toBe(KNOWN_VECTORS['abc']));
  it('test', () => expect(sha256hex('test')).toBe(KNOWN_VECTORS['test']));
  it('hello world', () => expect(sha256hex('hello world')).toBe(KNOWN_VECTORS['hello world']));
  it('Unicode Japanese', () => expect(sha256hex('日本語')).toBe(KNOWN_VECTORS['日本語']));
  it('Unicode Spanish', () => expect(sha256hex('áéíóúñ')).toBe(KNOWN_VECTORS['áéíóúñ']));
  it('deterministic', () => expect(sha256hex('x')).toBe(sha256hex('x')));
});

// ── Column Registry ──
describe('Column Registry (1C)', () => {
  it('all same-name columns isDuplicate=true', () => {
    const dup = buildColumnRegistry(['A', 'B', 'A', 'A']);
    expect(dup[0].isDuplicate).toBe(true);
    expect(dup[1].isDuplicate).toBe(false);
    expect(dup[2].isDuplicate).toBe(true);
    expect(dup[3].isDuplicate).toBe(true);
  });
  it('resolveColumn via columnId', () => {
    const cols = buildColumnRegistry(['A', 'B']);
    const result = resolveColumn(cols, { columnId: cols[0].columnId });
    expect('name' in result && result.name).toBe('A');
  });
  it('resolveColumn via name+position for duplicates', () => {
    const cols = buildColumnRegistry(['X', 'Y', 'X']);
    const r = resolveColumn(cols, { name: 'X', position: 2 });
    expect('name' in r && r.duplicateOrdinal).toBe(1);
  });
  it('resolveColumn returns error for duplicate without position', () => {
    const cols = buildColumnRegistry(['X', 'Y', 'X']);
    const r = resolveColumn(cols, { name: 'X' });
    expect('reason' in r && r.reason).toBe('duplicate_name');
  });
  it('generateSafeColumnDict uses columnId as key', () => {
    const cols = buildColumnRegistry(['A', 'B', 'A']);
    const dict = generateSafeColumnDict(cols);
    expect(dict).toContain(cols[0].columnId);
    expect(dict).toContain(cols[2].columnId);
  });
});

// ── Privacy ──
describe('Privacy (1C)', () => {
  it('parsePrivacyLevel invalid → cloud_no_samples', () => {
    expect(parsePrivacyLevel('bad')).toBe('cloud_no_samples');
    expect(parsePrivacyLevel('local_full')).toBe('local_full');
  });
  it('PII detection: email, credit card, URL, phone', () => {
    expect(isPII('a@b.com')).toBe(true);
    expect(isPII('4111111111111111')).toBe(true);
    expect(isPII('https://x.com')).toBe(true);
    expect(isPII('1234567890')).toBe(true);
    expect(isPII('hello world')).toBe(false);
  });
  it('redactValue: email, phone, short', () => {
    expect(redactValue('a@b.com')).toContain('***@');
    expect(redactValue('1234567890')).toMatch(/^12\*{3}90$/);
    expect(redactValue('ab')).toBe('**');
  });
  it('hashValue produces sha256: prefix', () => {
    const h = hashValue('test');
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(h).toBe(hashValue('test'));
  });
  it('shouldHashColumn: semanticType-based', () => {
    expect(shouldHashColumn('x', 'name')).toBe(true);
    expect(shouldHashColumn('x', 'email')).toBe(true);
    expect(shouldHashColumn('x', 'age')).toBe(false);
  });
});

// ── Token Budget ──
describe('Token Budget (1C)', () => {
  it('BUDGET_UNSATISFIABLE on impossibly small budget with samples', () => {
    try {
      _buildEvidenceEnvelopeV2(minimalReport, opts({ tokenBudget: { maxCharacters: 20 } }));
      expect(true).toBe(false); // Should have thrown
    } catch (err: any) {
      expect(err.code).toBe('BUDGET_UNSATISFIABLE');
    }
  });
});

// ── Happy path ──
describe('_buildEvidenceEnvelopeV2', () => {
  it('local_full: complete envelope', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'local_full' }));
    expect(e.contractId).toBe('aura.evidence.v2');
    expect(e.untrustedContent).toBe(true);
    expect(e.columns.length).toBeGreaterThan(0);
    expect(e.issues.length).toBeGreaterThan(0);
    expect(e.evidence.samples.length).toBeGreaterThan(0);
    expect(e.datasetFingerprint.sha256).toBe('abc123');
  });
  it('cloud_minimized: real minimized samples present', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'cloud_minimized' }));
    expect(e.privacyPolicy.level).toBe('cloud_minimized');
    const nameIssue = e.issues.find(i => i.issueId === 'hygiene-ghost-Name');
    if (nameIssue) {
      const nameSamples = e.evidence.samples.filter(s => s.issueId === nameIssue.issueId);
      expect(nameSamples.length).toBeGreaterThan(0);
      const minimized = nameSamples.filter(s => {
        const v = String(s.values[0] ?? '');
        return v.startsWith('sha256:') || v.includes('***') || v === 'null';
      });
      expect(minimized.length).toBeGreaterThan(0);
    }
  });

// ── Barrel exports coverage ──
describe('Contracts v2 barrel exports', () => {
  it('exports all public functions', () => {
    expect(typeof ContractsV2.buildColumnRegistry).toBe('function');
    expect(typeof ContractsV2.resolveColumn).toBe('function');
    expect(typeof ContractsV2.buildPrivacyPolicy).toBe('function');
    expect(typeof ContractsV2.buildTokenBudget).toBe('function');
    expect(typeof ContractsV2.buildEvidenceEnvelopeV2).toBe('function');
    expect(typeof ContractsV2.validateEnvelope).toBe('function');
    expect(typeof ContractsV2.validateIssue).toBe('function');
    expect(typeof ContractsV2.getContract).toBe('function');
    expect(typeof ContractsV2.listContracts).toBe('function');
    expect(typeof ContractsV2.isContractsV2Enabled).toBe('function');
    expect(typeof ContractsV2.sha256hex).toBe('function');
    expect(typeof ContractsV2.setForcePureJS).toBe('function');
    expect(typeof ContractsV2.parsePrivacyLevel).toBe('function');
  });

  it('does NOT export _buildEvidenceEnvelopeV2 in public barrel', () => {
    expect((ContractsV2 as any)._buildEvidenceEnvelopeV2).toBeUndefined();
  });

  it('REGISTRY has 4 contracts', () => {
    expect(Object.keys(ContractsV2.REGISTRY)).toHaveLength(4);
  });
});

// ── SHA Pure-JS dual backend ──
describe('SHA-256 dual backend', () => {
  const vectors = Object.entries(KNOWN_VECTORS);

  it('Node backend matches known vectors', () => {
    setForcePureJS(false);
    for (const [input, expected] of vectors) {
      expect(sha256hex(input)).toBe(expected);
    }
  });

  it('Pure-JS backend matches known vectors', () => {
    setForcePureJS(true);
    for (const [input, expected] of vectors) {
      expect(sha256hex(input)).toBe(expected);
    }
  });

  it('Both backends produce identical results', () => {
    setForcePureJS(false);
    const nodeHashes = vectors.map(([input]) => sha256hex(input));
    setForcePureJS(true);
    const jsHashes = vectors.map(([input]) => sha256hex(input));
    expect(nodeHashes).toEqual(jsHashes);
  });

  afterAll(() => {
    setForcePureJS(false); // reset
  });
});

// ── Automatic authorization ──
describe('Automatic authorization', () => {
  const dupReport: AuditReportInput = {
    score: 75, rowCount: 50, colCount: 3, duplicateRows: 5, delimiterDetected: ',',
    issues: [{
      id: 'dup-rows', column: undefined, category: 'INTEGRITY', ruleName: 'Exact Duplicates',
      description: 'Filas Duplicadas (5)', severity: 'warning', count: 5, affectedPercentage: 10, sampleValues: [],
    }],
    datasetProfile: { columns: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
    scoreBreakdown: [
      { reason: 'Filas Duplicadas (5)', points: 2, category: 'INTEGRITY', severity: 'WARNING', ruleId: 'rule:dup' },
    ],
  };

  it('duplicates have auto_safe with authorized=true when duplicateRows>0', () => {
    const e = _buildEvidenceEnvelopeV2(dupReport, opts());
    const dup = e.issues.find(i => i.issueId === 'dup-rows');
    expect(dup).toBeDefined();
    expect(dup!.actionability).toBe('auto_safe');
    expect(dup!.automaticAuthorization.authorized).toBe(true);
    expect(dup!.automaticAuthorization.actionType).toBe('drop_exact_duplicates');
  });

  const dupReportNoRows: AuditReportInput = {
    ...dupReport, duplicateRows: 0,
    scoreBreakdown: [],
    issues: [{ ...dupReport.issues[0], description: 'Filas Duplicadas (0)' }],
  };

  it('duplicates without duplicateRows are review_only', () => {
    const e = _buildEvidenceEnvelopeV2(dupReportNoRows, opts());
    const dup = e.issues.find(i => i.issueId === 'dup-rows');
    expect(dup!.actionability).toBe('review_only');
    expect(dup!.automaticAuthorization.authorized).toBe(false);
  });
});

// ── RuleId from engine ──
describe('Engine ruleId integration', () => {
  it('evidence envelope issues carry engine ruleId when scoreBreakdown present', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts());
    for (const issue of e.issues) {
      expect(issue.ruleId).toMatch(/^rule:/);
    }
  });

  it('unknown rules default to review_only', () => {
    const report: AuditReportInput = {
      score: 100, rowCount: 10, colCount: 2, duplicateRows: 0, delimiterDetected: ',',
      issues: [{ id: 'x', column: 'A', category: 'TEST', ruleName: 'Some Unknown Rule', description: 'unknown', severity: 'info', count: 1, affectedPercentage: 10, sampleValues: [] }],
      datasetProfile: { columns: [{ name: 'A' }, { name: 'B' }] },
    };
    const e = _buildEvidenceEnvelopeV2(report, opts());
    expect(e.issues[0].actionability).toBe('review_only');
  });
});
  it('cloud_no_samples: empty samples + topValues', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'cloud_no_samples' }));
    expect(e.evidence.samples).toHaveLength(0);
    for (const colId of Object.keys(e.evidence.columnStats)) {
      expect(e.evidence.columnStats[colId]?.topValues || []).toHaveLength(0);
    }
  });
  it('respects maxColumns=2', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ tokenBudget: { maxColumns: 2 } }));
    expect(e.columns.length).toBeLessThanOrEqual(2);
  });
  it('respects maxIssues=1', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ tokenBudget: { maxIssues: 1 } }));
    expect(e.issues.length).toBeLessThanOrEqual(1);
  });
  it('excludeColumns by columnId', () => {
    const cols = buildColumnRegistry(['PassengerId', 'Survived', 'Name', 'Age', 'Fare']);
    const nameId = cols.find(c => c.name === 'Name')!.columnId;
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ excludeColumns: [nameId] }));
    expect(e.columns.find(c => c.name === 'Name')).toBeUndefined();
  });
  it('dataset-scoped issue has columnId=null', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts());
    const dup = e.issues.find(i => i.issueId === 'dup-rows-global');
    expect(dup?.columnId).toBeNull();
    expect(dup?.scope).toBe('dataset');
  });
  it('drop_exact_duplicates auto_safe when duplicateRows>0', () => {
    const e = _buildEvidenceEnvelopeV2(reportWithDups, opts());
    const dup = e.issues.find(i => i.issueId === 'dup-rows');
    expect(dup?.actionability).toBe('auto_safe');
  });
  it('duplicate columns all isDuplicate=true, HITL block auto-resolve', () => {
    const e = _buildEvidenceEnvelopeV2(reportWithDups, opts());
    const nameCols = e.columns.filter(c => c.name === 'Name');
    expect(nameCols).toHaveLength(2);
    for (const c of nameCols) expect(c.isDuplicate).toBe(true);
  });
  it('manifest distinguishes exclusion reasons', () => {
    const cols = buildColumnRegistry(['PassengerId', 'Survived', 'Name', 'Age', 'Fare']);
    const sid = cols.find(c => c.name === 'Survived')!.columnId;
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts({ excludeColumns: [sid] }));
    expect(e.truncationManifest.truncatedColumns.some(c => c.reason === 'explicit_exclusion')).toBe(true);
  });
  it('actionability is deduction-based (no heuristic ruleName.includes)', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts());
    const trimIssue = e.issues.find(i => i.issueId === 'hygiene-ghost-Name');
    expect(trimIssue?.ruleId).toMatch(/^rule:/);
    expect(trimIssue?.actionability).toBe('auto_safe');
  });
});

// ── Validation fail-closed ──
describe('Validation fail-closed (1C)', () => {
  it('catches duplicate columnIds', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts());
    const b = JSON.parse(JSON.stringify(e));
    b.columns[1].columnId = b.columns[0].columnId;
    expect(validateEnvelope(b).valid).toBe(false);
  });
  it('catches missing evidenceRef', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts());
    const issue = e.issues.find(i => i.evidenceRefs.length > 0);
    if (issue) issue.evidenceRefs.push('ev-nonexist');
    expect(validateEnvelope(e).valid).toBe(false);
  });
  it('catches sample.columnId != issue.columnId', () => {
    const e = _buildEvidenceEnvelopeV2(minimalReport, opts());
    const b = JSON.parse(JSON.stringify(e));
    if (b.evidence.samples.length > 0) b.evidence.samples[0].columnId = 'col:wrong';
    expect(validateEnvelope(b).valid).toBe(false);
  });
});

// ── Registry ──
describe('Registry', () => {
  it('4 contracts with fixed createdAt', () => {
    for (const c of Object.values(REGISTRY)) expect(c.createdAt).toBe('2026-06-24T00:00:00Z');
  });
  it('contractVersion mismatch is error', () => {
    const r = validateAgainstContract('aura.evidence.v2', { contractId: 'aura.evidence.v2', contractVersion: '1.0.0' });
    expect(r.valid).toBe(false);
  });
});
