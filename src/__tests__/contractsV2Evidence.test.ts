/**
 * Contracts v2 Evidence — Unit Tests.
 * Fase 1: validates all typed infrastructure without Ollama.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ── Column Registry ──
import {
  buildColumnRegistry,
  getColumnById,
  getColumnsByName,
  validateColumnId,
  getColumnsRequiringReview,
  getInjectionRiskColumns,
  generateSafeColumnDict,
} from '../contracts/llm/columnRegistry';

describe('Column Registry', () => {
  const cols = buildColumnRegistry(['PassengerId', 'Survived', 'Name', 'Age', 'Embarked']);

  it('produces deterministic columnIds', () => {
    const a = buildColumnRegistry(['Name', 'Age']);
    const b = buildColumnRegistry(['Name', 'Age']);
    expect(a[0].columnId).toBe(b[0].columnId);
    expect(a[1].columnId).toBe(b[1].columnId);
  });

  it('prefixes columnId with col:', () => {
    for (const c of cols) {
      expect(c.columnId).toMatch(/^col:[a-f0-9]{8}$/);
    }
  });

  it('assigns correct positions', () => {
    expect(cols[0].position).toBe(0);
    expect(cols[1].position).toBe(1);
  });

  it('detects duplicate names', () => {
    const dup = buildColumnRegistry(['A', 'B', 'A']);
    expect(dup[0].isDuplicate).toBe(false);
    expect(dup[2].isDuplicate).toBe(true);
    expect(dup[2].duplicateOrdinal).toBe(1);
    expect(dup[2].columnId).not.toBe(dup[0].columnId);
  });

  it('detects reserved words', () => {
    const rw = buildColumnRegistry(['pass', 'import', 'exec', 'eval', '__import__']);
    for (const c of rw) {
      expect(c.isReservedWord).toBe(true);
    }
  });

  it('detects ambiguous column names', () => {
    const amb = buildColumnRegistry(['l1I|', 'column_1', '  ']);
    expect(amb[0].isAmbiguous).toBe(true);
    expect(amb[1].isAmbiguous).toBe(true);
    expect(amb[2].isAmbiguous).toBe(true);
  });

  it('getColumnById returns correct column', () => {
    const found = getColumnById(cols, cols[2].columnId);
    expect(found?.name).toBe('Name');
  });

  it('getColumnsByName returns all matching', () => {
    const dup = buildColumnRegistry(['A', 'B', 'A']);
    const results = getColumnsByName(dup, 'A');
    expect(results).toHaveLength(2);
  });

  it('validateColumnId checks existence', () => {
    expect(validateColumnId(cols, cols[0].columnId)).toBe(true);
    expect(validateColumnId(cols, 'col:nonexist')).toBe(false);
  });

  it('getColumnsRequiringReview filters correctly', () => {
    const review = getColumnsRequiringReview(buildColumnRegistry(['pass', 'l1I|', 'A', 'A', 'B']));
    expect(review.length).toBeGreaterThanOrEqual(2);
  });

  it('generates safe column dict', () => {
    const dict = generateSafeColumnDict(cols.slice(0, 2));
    expect(dict).toContain('_c = {');
    expect(dict).toContain(JSON.stringify(cols[0].name));
    expect(dict).toContain(cols[0].columnId);
  });

  it('detects injection risks in column names', () => {
    const risky = buildColumnRegistry(["col'name", 'col"name', 'col\nname']);
    expect(getInjectionRiskColumns(risky)).toHaveLength(3);
  });
});

// ── Contract Registry ──
import {
  REGISTRY,
  getContract,
  isRegisteredContract,
  listContracts,
  validateAgainstContract,
} from '../contracts/llm/contractRegistry';

describe('Contract Registry', () => {
  it('has all 4 contracts registered', () => {
    expect(listContracts()).toHaveLength(4);
    expect(isRegisteredContract('aura.evidence.v2')).toBe(true);
    expect(isRegisteredContract('aura.diagnosis.v2')).toBe(true);
    expect(isRegisteredContract('aura.remediation.v2')).toBe(true);
    expect(isRegisteredContract('aura.script.v2')).toBe(true);
  });

  it('getContract returns metadata', () => {
    const c = getContract('aura.evidence.v2');
    expect(c?.contractId).toBe('aura.evidence.v2');
    expect(c?.version).toBe('2.0.0');
    expect(c?.taskType).toBe('evidence');
    expect(c?.compatibility.minContractsVersion).toBe('2.0.0');
  });

  it('isRegisteredContract rejects unknown', () => {
    expect(isRegisteredContract('aura.fake.v1')).toBe(false);
  });

  it('validateAgainstContract validates required fields', () => {
    const result = validateAgainstContract('aura.evidence.v2', { contractId: 'aura.evidence.v2' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validateAgainstContract passes valid payload', () => {
    const result = validateAgainstContract('aura.script.v2', {
      contractId: 'aura.script.v2',
      contractVersion: '2.0.0',
      remediationRef: 'ref-1',
      cleanDatasetFn: 'clean_dataset',
      columnRefs: [],
      scriptText: 'pass',
    });
    expect(result.valid).toBe(true);
  });
});

// ── Privacy Policy ──
import {
  buildPrivacyPolicy,
  allowsRawSamples,
  allowsTopValues,
  requiresHash,
  parsePrivacyLevel,
} from '../contracts/llm/privacyPolicy';

describe('Privacy Policy', () => {
  it('local_full allows everything', () => {
    const p = buildPrivacyPolicy('local_full');
    expect(allowsRawSamples(p)).toBe(true);
    expect(allowsTopValues(p)).toBe(true);
    expect(p.rules).toHaveLength(0);
  });

  it('cloud_minimized restricts samples', () => {
    const p = buildPrivacyPolicy('cloud_minimized');
    expect(allowsRawSamples(p)).toBe(false);
    expect(allowsTopValues(p)).toBe(true);
    expect(p.rules.length).toBeGreaterThan(0);
  });

  it('cloud_no_samples blocks everything', () => {
    const p = buildPrivacyPolicy('cloud_no_samples');
    expect(allowsRawSamples(p)).toBe(false);
    expect(allowsTopValues(p)).toBe(false);
  });

  it('requiresHash for sensitive columns', () => {
    const p = buildPrivacyPolicy('cloud_minimized');
    expect(requiresHash(p, 'Name')).toBe(true);
    expect(requiresHash(p, 'Ticket')).toBe(true);
    expect(requiresHash(p, 'PassengerId')).toBe(true);
    expect(requiresHash(p, 'Age')).toBe(false);
  });

  it('local_full never requires hash', () => {
    const p = buildPrivacyPolicy('local_full');
    expect(requiresHash(p, 'Name')).toBe(false);
  });

  it('parsePrivacyLevel defaults to local_full on invalid input', () => {
    expect(parsePrivacyLevel('invalid')).toBe('local_full');
    expect(parsePrivacyLevel('cloud_minimized')).toBe('cloud_minimized');
  });
});

// ── Token Budget ──
import {
  buildTokenBudget,
  createTruncationManifest,
  applyColumnLimit,
  applySampleLimit,
  defaultBudget,
} from '../contracts/llm/tokenBudget';

describe('Token Budget', () => {
  it('buildTokenBudget with defaults', () => {
    const b = buildTokenBudget();
    expect(b.maxColumns).toBe(16);
    expect(b.maxIssues).toBe(24);
    expect(b.maxSamplesPerIssue).toBe(4);
    expect(b.budgetId).toMatch(/^budget-v2-/);
  });

  it('buildTokenBudget accepts overrides', () => {
    const b = buildTokenBudget({ maxColumns: 5, maxIssues: 10 });
    expect(b.maxColumns).toBe(5);
    expect(b.maxIssues).toBe(10);
    expect(b.maxSamplesPerIssue).toBe(4);
  });

  it('createTruncationManifest is empty', () => {
    const m = createTruncationManifest();
    expect(m.truncatedColumns).toHaveLength(0);
    expect(m.truncatedIssues).toHaveLength(0);
    expect(m.truncatedSamples).toHaveLength(0);
  });

  it('applyColumnLimit logs exceeded columns', () => {
    const m = createTruncationManifest();
    const b = buildTokenBudget({ maxColumns: 3 });
    applyColumnLimit(m, b, 10, ['c1', 'c2', 'c3'], ['c4', 'c5']);
    expect(m.truncatedColumns.length).toBeGreaterThan(0);
  });

  it('applySampleLimit logs exceeded samples', () => {
    const m = createTruncationManifest();
    const b = buildTokenBudget({ maxSamplesPerIssue: 3 });
    applySampleLimit(m, b, 'issue-1', 10);
    expect(m.truncatedSamples).toHaveLength(1);
    expect(m.truncatedSamples[0].excess).toBe(7);
  });

  it('defaultBudget returns default values', () => {
    const b = defaultBudget();
    expect(b.maxColumns).toBe(16);
  });
});

// ── Validators ──
import {
  validateIssue,
  validateColumnRef,
  validateTokenBudget,
  validatePrivacyPolicy,
  aggregateResults,
} from '../contracts/llm/validators';

describe('Validators', () => {
  const cols = buildColumnRegistry(['Name', 'Age', 'Fare']);

  it('validateColumnRef passes valid column', () => {
    const r = validateColumnRef(cols[0], 0);
    expect(r.valid).toBe(true);
  });

  it('validateColumnRef fails invalid columnId', () => {
    const r = validateColumnRef({ ...cols[0], columnId: 'bad-id' }, 0);
    expect(r.valid).toBe(false);
  });

  it('validateColumnRef warns on ambiguous column', () => {
    const amb = buildColumnRegistry(['l1I|']);
    const r = validateColumnRef(amb[0], 0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('validateIssue passes valid issue', () => {
    const r = validateIssue({
      issueId: 'i1', ruleId: 'r1', ruleName: 'Test', columnId: cols[0].columnId,
      category: 'test', severity: 'warning', count: 5, affectedPercentage: 10,
      evidenceRefs: [], actionability: 'review_only',
    }, cols);
    expect(r.valid).toBe(true);
  });

  it('validateIssue fails invalid actionability', () => {
    const r = validateIssue({
      issueId: 'i1', ruleId: 'r1', ruleName: 'Test', columnId: cols[0].columnId,
      category: 'test', severity: 'warning', count: 5, affectedPercentage: 10,
      evidenceRefs: [], actionability: 'invalid' as any,
    }, cols);
    expect(r.valid).toBe(false);
  });

  it('validateIssue fails missing columnId', () => {
    const r = validateIssue({
      issueId: 'i1', ruleId: 'r1', ruleName: 'Test', columnId: 'col:nonexist',
      category: 'test', severity: 'warning', count: 5, affectedPercentage: 10,
      evidenceRefs: [], actionability: 'review_only',
    }, cols);
    expect(r.valid).toBe(false);
  });

  it('validateTokenBudget rejects invalid values', () => {
    const r = validateTokenBudget({
      budgetId: 'test',
      maxColumns: -1,
      maxIssues: 10,
      maxSamplesPerIssue: 4,
      maxTopValues: 6,
      maxCharacters: 1000,
      limits: {},
    });
    expect(r.valid).toBe(false);
  });

  it('validatePrivacyPolicy rejects invalid level', () => {
    const r = validatePrivacyPolicy({ level: 'invalid' as any, rules: [] });
    expect(r.valid).toBe(false);
  });

  it('aggregateResults combines errors', () => {
    const r1 = { valid: false, errors: [{ path: 'a', message: 'e1', value: null }], warnings: [] };
    const r2 = { valid: false, errors: [{ path: 'b', message: 'e2', value: null }], warnings: [{ path: 'b', message: 'w1', value: null }] };
    const agg = aggregateResults([r1, r2]);
    expect(agg.errors).toHaveLength(2);
    expect(agg.warnings).toHaveLength(1);
    expect(agg.valid).toBe(false);
  });
});

// ── Evidence Envelope V2 ──
import { buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';

describe('Evidence Envelope V2 (disabled by default — structural test only)', () => {
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
        severity: 'info',
        count: 2,
        affectedPercentage: 2,
        sampleValues: ['Braund, Mr. Owen Harris', 'Cumings, Mrs. John Bradley'],
      },
    ],
    columnStats: {
      Name: {
        inferredType: 'string',
        semanticType: 'name',
        distinctCount: 89,
        nullCount: 0,
        nullPercentage: 0,
        topValues: [{ value: 'Braund, Mr. Owen Harris', count: 1, percentage: 1 }],
        stats: {},
      },
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

  it('should throw when CONTRACTS_V2_ENABLED is not set', () => {
    expect(() => buildEvidenceEnvelopeV2(minimalReport, {
      privacyLevel: 'local_full',
      datasetSha256: 'abc123',
      delimiter: ',',
    })).toThrow(/not enabled/);
  });

  it('evidence envelope type check (structural smoke test)', () => {
    // Just verify the module imports and types compile
    expect(typeof buildEvidenceEnvelopeV2).toBe('function');
  });
});

// ── Index exports ──
import * as ContractsV2 from '../contracts/llm/index';

describe('Contracts v2 index exports', () => {
  it('exports all core functions', () => {
    expect(typeof ContractsV2.buildColumnRegistry).toBe('function');
    expect(typeof ContractsV2.buildPrivacyPolicy).toBe('function');
    expect(typeof ContractsV2.buildTokenBudget).toBe('function');
    expect(typeof ContractsV2.buildEvidenceEnvelopeV2).toBe('function');
    expect(typeof ContractsV2.validateEnvelope).toBe('function');
    expect(typeof ContractsV2.validateIssue).toBe('function');
    expect(typeof ContractsV2.getContract).toBe('function');
    expect(typeof ContractsV2.listContracts).toBe('function');
    expect(typeof ContractsV2.isContractsV2Enabled).toBe('function');
  });

  it('REGISTRY has 4 entries', () => {
    expect(Object.keys(ContractsV2.REGISTRY)).toHaveLength(4);
  });
});
