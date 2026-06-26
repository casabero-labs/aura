/**
 * Diagnosis Parser v2 — Unit Tests.
 *
 * Tests: parseDiagnosisResponseV2 strictness.
 */

import { describe, it, expect } from 'vitest';
import { parseDiagnosisResponseV2 } from '../contracts/llm/diagnosisParserV2';
import type { DiagnosisParseOutcome, ParseFailure } from '../contracts/llm/diagnosisParserV2';
import type { DiagnosisResponseV2 } from '../contracts/llm/types';

// ── Valid fixture ──
const validResponse: DiagnosisResponseV2 = {
  contractId: 'aura.diagnosis.v2',
  contractVersion: '2.0.0',
  evidenceEnvelopeRef: 'env:abc123',
  responseId: 'diag-001',
  issues: [
    {
      issueId: 'issue-1',
      evidenceRefs: ['ev-1'],
      hypothesis: 'Whitespace padding from data entry',
      confidence: 0.9,
      requiresHumanReview: false,
      limits: ['Limited to string columns'],
    },
  ],
  diagnosisBlocks: [
    {
      issueId: 'issue-1',
      ruleId: 'rule:trim-whitespace',
      columnId: 'col-Name',
      scope: 'column',
      observation: '2 values have leading/trailing whitespace',
      recommendation: 'Consider trimming whitespace during data ingestion',
    },
  ],
  limitations: ['Analysis limited to provided evidence'],
  generatedAt: new Date().toISOString(),
};

const validJson = JSON.stringify(validResponse);

// ── Tests ──

describe('parseDiagnosisResponseV2 — valid cases', () => {
  it('parses valid JSON response', () => {
    const result = parseDiagnosisResponseV2(validJson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.contractId).toBe('aura.diagnosis.v2');
      expect(result.response.issues).toHaveLength(1);
    }
  });

  it('trims whitespace around JSON', () => {
    const result = parseDiagnosisResponseV2(`  ${validJson}  `);
    expect(result.success).toBe(true);
  });

  it('accepts single-line JSON', () => {
    const single = JSON.stringify(validResponse);
    const result = parseDiagnosisResponseV2(single);
    expect(result.success).toBe(true);
  });
});

describe('parseDiagnosisResponseV2 — invalid cases', () => {
  it('rejects empty string', () => {
    const result = parseDiagnosisResponseV2('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect((result as ParseFailure).error.code).toBe('DIAGNOSIS_JSON_INVALID');
    }
  });

  it('rejects non-JSON prose', () => {
    const result = parseDiagnosisResponseV2('Here is my diagnosis: the data looks fine.');
    expect(result.success).toBe(false);
  });

  it('rejects JSON wrapped in markdown code block', () => {
    const result = parseDiagnosisResponseV2(`\`\`\`json\n${validJson}\n\`\`\``);
    expect(result.success).toBe(false);
  });

  it('rejects JSON preceded by explanation text', () => {
    const result = parseDiagnosisResponseV2(`Sure, here is the JSON:\n${validJson}`);
    expect(result.success).toBe(false);
  });

  it('rejects JSON followed by extra text', () => {
    const result = parseDiagnosisResponseV2(`${validJson}\nThis is extra.`);
    expect(result.success).toBe(false);
  });

  it('rejects eval payload', () => {
    const result = parseDiagnosisResponseV2('eval("console.log(1)")');
    expect(result.success).toBe(false);
  });

  it('rejects malformed JSON (missing comma)', () => {
    const malformed = '{"contractId":"aura.diagnosis.v2" "contractVersion":"2.0.0"}';
    const result = parseDiagnosisResponseV2(malformed);
    expect(result.success).toBe(false);
  });

  it('rejects malformed JSON (trailing comma)', () => {
    const malformed = '{"contractId":"aura.diagnosis.v2",}';
    const result = parseDiagnosisResponseV2(malformed);
    expect(result.success).toBe(false);
  });

  it('rejects unclosed braces', () => {
    const result = parseDiagnosisResponseV2('{"contractId":"aura.diagnosis.v2"');
    expect(result.success).toBe(false);
  });

  it('rejects single-quoted strings', () => {
    const result = parseDiagnosisResponseV2("{'contractId':'aura.diagnosis.v2'}");
    expect(result.success).toBe(false);
  });

  it('rejects array as root', () => {
    const result = parseDiagnosisResponseV2('[1,2,3]');
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = parseDiagnosisResponseV2('null');
    expect(result.success).toBe(false);
  });

  it('rejects number', () => {
    const result = parseDiagnosisResponseV2('42');
    expect(result.success).toBe(false);
  });
});

describe('parseDiagnosisResponseV2 — error structure', () => {
  it('error has code, message, path, details', () => {
    const result = parseDiagnosisResponseV2('not json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect((result as ParseFailure).error.code).toBeDefined();
      expect((result as ParseFailure).error.message).toBeDefined();
      expect((result as ParseFailure).error.path).toBeDefined();
      expect((result as ParseFailure).error.details).toBeDefined();
    }
  });

  it('rejects Python code block', () => {
    const result = parseDiagnosisResponseV2('```python\nprint("hello")\n```');
    expect(result.success).toBe(false);
  });
});
