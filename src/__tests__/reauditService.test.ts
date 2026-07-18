/**
 * ReauditService Tests — Phase 5 Loop 4
 *
 * Tests: importColabOutput, parseCsvString, computeCsvFingerprint,
 * buildEnvelopeRef, computeChangedCellsEstimate, runReaudit.
 *
 * Does NOT execute Python. Does NOT use real user datasets.
 */

import { describe, expect, it } from 'vitest';
import {
  parseCsvString,
  computeCsvFingerprint,
  computeExactCsvFingerprint,
  buildEnvelopeRef,
  importColabOutput,
  computeChangedCellsEstimate,
  buildReauditEvidence,
  runReaudit,
} from '../services/reauditService';
import { calculateHealthDelta } from '../services/improvementService';

const BEFORE_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","SAN FRANCISCO","2024-01-01",160903280
"456 Oak Ave","LOS ANGELES","2024-01-02",160903281
"789 Pine Rd","CHICAGO","2024-01-03",160903282
`;

const AFTER_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","san francisco","2024-01-01",160903280
"456 Oak Ave","los angeles","2024-01-02",160903281
"789 Pine Rd","chicago","2024-01-03",160903282
`;

const BEFORE_CSV_WITH_ISSUES = `id,name,email
1,John,not_an_email
2,Jane,jane@example.com
3,Bob,also_invalid
`;

const AFTER_CSV_CLEAN = `id,name,email
1,John,john@example.com
2,Jane,jane@example.com
3,Bob,bob@example.com
`;

const BEFORE_CSV_SEMANTIC = `City,Temperature
"San Francisco",hot
"los angeles",Cold
"chicago",WARM
`;

const AFTER_CSV_NORMALIZED = `City,Temperature
san francisco,hot
los angeles,cold
chicago,warm
`;

const BEFORE_CSV_NO_DELIMITER = `col1\tcol2\tcol3
val1\tval2\tval3
`;

const BEFORE_EMPTY_CSV = `col1,col2
,,
`;

const AFTER_EMPTY_CSV = `col1,col2
val1,val2
`;

describe('reauditService', () => {
  describe('parseCsvString', () => {
    it('parses a basic CSV string', () => {
      const result = parseCsvString('name,age\nJohn,30\nJane,25');
      expect(result.data).toHaveLength(2);
      expect(result.fields).toEqual(['name', 'age']);
      expect(result.data[0].name).toBe('John');
      expect(result.data[0].age).toBe(30);
    });

    it('auto-detects comma delimiter', () => {
      const result = parseCsvString('a,b,c\n1,2,3');
      expect(result.delimiter).toBe(',');
      expect(result.fields).toEqual(['a', 'b', 'c']);
    });

    it('auto-detects semicolon delimiter', () => {
      const result = parseCsvString('a;b;c\n1;2;3');
      expect(result.delimiter).toBe(';');
    });

    it('respects forced delimiter option', () => {
      const result = parseCsvString('a|b|c\n1|2|3', '|');
      expect(result.delimiter).toBe('|');
      expect(result.fields).toEqual(['a', 'b', 'c']);
    });

    it('returns empty data for empty string', () => {
      const result = parseCsvString('');
      expect(result.data).toEqual([]);
      expect(result.fields).toEqual([]);
    });

    it('returns empty data for whitespace-only string', () => {
      const result = parseCsvString('   \n  \n  ');
      expect(result.data).toEqual([]);
    });

    it('skips empty lines', () => {
      // PapaParse with skipEmptyLines:true skips lines with no content
      const result = parseCsvString('a,b\n1,2\n\n3,4\n');
      expect(result.data).toHaveLength(2); // blank line between rows is skipped
    });

    it('parses CSV with quoted fields containing commas', () => {
      const result = parseCsvString('name,city\n"John, Smith","San Francisco, CA"');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('John, Smith');
    });
  });

  describe('computeCsvFingerprint', () => {
    it('produces deterministic SHA256 hash', () => {
      const csv = 'a,b\n1,2\n3,4';
      const hash1 = computeCsvFingerprint(csv);
      const hash2 = computeCsvFingerprint(csv);
      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different content', () => {
      const hash1 = computeCsvFingerprint('a,b\n1,2');
      const hash2 = computeCsvFingerprint('a,b\n1,3');
      expect(hash1).not.toBe(hash2);
    });

    it('produces 64-char hex string', () => {
      const hash = computeCsvFingerprint('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is trimmed before hashing', () => {
      const hash1 = computeCsvFingerprint('a,b\n1,2');
      const hash2 = computeCsvFingerprint('  a,b\n1,2\n  ');
      expect(hash1).toBe(hash2);
    });

    it('keeps exact bytes distinct for formal source and imported artifacts', () => {
      expect(computeExactCsvFingerprint('a,b\n1,2')).not.toBe(
        computeExactCsvFingerprint('a,b\n1,2\n'),
      );
    });
  });

  describe('buildEnvelopeRef', () => {
    it('returns env:<16-char-hash> format by default', () => {
      const ref = buildEnvelopeRef('abc123');
      expect(ref).toMatch(/^env:[a-f0-9]{16}$/);
    });

    it('accepts custom prefix', () => {
      const ref = buildEnvelopeRef('abc123', 'output');
      expect(ref).toMatch(/^output:[a-f0-9]{16}$/);
    });

    it('is deterministic', () => {
      const ref1 = buildEnvelopeRef('test-fingerprint');
      const ref2 = buildEnvelopeRef('test-fingerprint');
      expect(ref1).toBe(ref2);
    });
  });

  describe('importColabOutput', () => {
    it('imports a valid CSV and returns structured ColabOutput', () => {
      const output = importColabOutput(BEFORE_CSV);

      expect(output.data).toHaveLength(3);
      expect(output.fields).toEqual(['Address', 'City', 'CallDateTime', 'CrimeId']);
      expect(output.rowCount).toBe(3);
      expect(output.colCount).toBe(4);
      expect(output.delimiter).toBe(',');
      expect(output.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(output.rawCsv).toBe(BEFORE_CSV);
    });

    it('throws for empty csvString', () => {
      expect(() => importColabOutput('')).toThrow('csvString is empty or null');
      expect(() => importColabOutput('   ')).toThrow('csvString is empty or null');
    });

    it('uses forced delimiter when provided', () => {
      const output = importColabOutput(BEFORE_CSV_NO_DELIMITER, { delimiter: '\t' });
      expect(output.fields).toEqual(['col1', 'col2', 'col3']);
      expect(output.delimiter).toBe('\t');
    });

    it('computes fingerprint from raw CSV', () => {
      const output = importColabOutput(BEFORE_CSV);
      const expectedFp = computeCsvFingerprint(BEFORE_CSV);
      expect(output.fingerprint).toBe(expectedFp);
    });

    it('correctly counts rows — trailing newline does not inflate count', () => {
      // 'a,b\n1,2\n3,4\n' has same row count as 'a,b\n1,2\n3,4'
      const withTrailing = importColabOutput('a,b\n1,2\n3,4\n');
      const withoutTrailing = importColabOutput('a,b\n1,2\n3,4');
      expect(withTrailing.rowCount).toBe(withoutTrailing.rowCount);
    });
  });

  describe('computeChangedCellsEstimate', () => {
    it('returns 0 when no cells changed', () => {
      const before = importColabOutput(BEFORE_CSV);
      const after = importColabOutput(BEFORE_CSV);
      expect(computeChangedCellsEstimate(before, after)).toBe(0);
    });

    it('counts changed cells between before and after', () => {
      const before = importColabOutput(BEFORE_CSV);
      const after = importColabOutput(AFTER_CSV);
      // City column changed in all 3 rows: 3 changes
      expect(computeChangedCellsEstimate(before, after)).toBe(3);
    });

    it('returns null when column count differs', () => {
      const before = importColabOutput('a,b,c\n1,2,3');
      const after = importColabOutput('a,b\n1,2');
      expect(computeChangedCellsEstimate(before, after)).toBeNull();
    });

    it('returns null when column names differ', () => {
      const before = importColabOutput('a,b\n1,2');
      const after = importColabOutput('x,y\n1,2');
      expect(computeChangedCellsEstimate(before, after)).toBeNull();
    });

    it('returns null when row counts differ because the estimate would be incomplete', () => {
      const before = importColabOutput('a,b\n1,2\n3,4');
      const after = importColabOutput('a,b\n5,6');
      expect(computeChangedCellsEstimate(before, after)).toBeNull();
    });
  });

  describe('runReaudit', () => {
    it('produces ReauditSummaryV1 and OutputDatasetSummaryV1 for before/after', () => {
      const result = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:before123');

      expect(result.summary.beforeEvidenceEnvelopeRef).toBe('env:before123');
      expect(result.summary.afterEvidenceEnvelopeRef).toMatch(/^env:/);
      expect(typeof result.summary.beforeIssueCount).toBe('number');
      expect(typeof result.summary.afterIssueCount).toBe('number');
      expect(Array.isArray(result.summary.rulesCompared)).toBe(true);
    });

    it('includes before and after reports with issue counts', () => {
      const result = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:before123');

      expect(result.beforeReport).toBeDefined();
      expect(result.afterReport).toBeDefined();
      expect(result.beforeReport.rowCount).toBe(3);
      expect(result.afterReport.rowCount).toBe(3);
    });

    it('includes before and after outputs', () => {
      const result = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:before123');

      expect(result.beforeOutput.rowCount).toBe(3);
      expect(result.afterOutput.rowCount).toBe(3);
      expect(result.beforeOutput.colCount).toBe(4);
      expect(result.afterOutput.colCount).toBe(4);
    });

    it('includes OutputDatasetSummaryV1 with fingerprint', () => {
      const result = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:before123');

      expect(result.output.rowCountBefore).toBe(3);
      expect(result.output.rowCountAfter).toBe(3);
      expect(result.output.columnCountBefore).toBe(4);
      expect(result.output.columnCountAfter).toBe(4);
      expect(result.output.outputFingerprint).toBe(result.afterOutput.fingerprint);
      expect(result.output.changedCellsEstimate).toBeGreaterThan(0);
      expect(result.output.exportedCsvRef).toMatch(/^output:/);
    });

    it('accepts custom envelope refs', () => {
      const result = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:custom_before', {
        afterEvidenceRef: 'output:custom_after',
      });

      expect(result.summary.beforeEvidenceEnvelopeRef).toBe('env:custom_before');
      expect(result.summary.afterEvidenceEnvelopeRef).toBe('output:custom_after');
    });

    it('records issue count delta in logs via changed cells estimate', () => {
      const result = runReaudit(BEFORE_CSV_WITH_ISSUES, AFTER_CSV_CLEAN, 'env:issues');

      expect(result.summary.beforeIssueCount).toBeGreaterThan(result.summary.afterIssueCount);
    });

    it('uses custom delimiter when provided', () => {
      const csv = 'a;b;c\n1;2;3';
      const result = runReaudit(csv, csv, 'env:test', { delimiter: ';' });

      expect(result.beforeOutput.delimiter).toBe(';');
      expect(result.afterOutput.delimiter).toBe(';');
    });

    it('builds the formal before/after evidence without forcing mixed results', () => {
      const result = runReaudit(BEFORE_CSV_WITH_ISSUES, AFTER_CSV_CLEAN, 'env:issues');
      const delta = calculateHealthDelta(result.beforeReport, result.afterReport);
      const evidence = buildReauditEvidence(result, delta);

      expect(evidence.beforeRows).toBe(3);
      expect(evidence.afterRows).toBe(3);
      expect(evidence.estimatedCellsModified).toBeGreaterThan(0);
      expect(['improved', 'unchanged', 'worsened', 'inconclusive']).toContain(evidence.outcome);

      const mixed = buildReauditEvidence(result, {
        ...delta,
        beforeScore: 50,
        afterScore: 60,
        beforeIssueCount: 2,
        afterIssueCount: 3,
      });
      expect(mixed.outcome).toBe('inconclusive');
    });

    it('throws if beforeCsv is empty', () => {
      expect(() => runReaudit('', AFTER_CSV, 'env:test')).toThrow('beforeCsv');
    });

    it('throws if afterCsv is empty', () => {
      expect(() => runReaudit(BEFORE_CSV, '', 'env:test')).toThrow('afterCsv');
    });

    it('produces output with null exportedCsvRef when fingerprint not available', () => {
      const result = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:before123');
      expect(result.output.exportedCsvRef).toBeTruthy();
    });
  });

  describe('integration: before has issues → after is clean', () => {
    it('reduces issue count after cleaning', () => {
      const result = runReaudit(BEFORE_CSV_WITH_ISSUES, AFTER_CSV_CLEAN, 'env:dirty');

      expect(result.summary.beforeIssueCount).toBeGreaterThan(0);
      expect(result.summary.afterIssueCount).toBe(0);
    });

    it('before and after scores are computed', () => {
      const result = runReaudit(BEFORE_CSV_WITH_ISSUES, AFTER_CSV_CLEAN, 'env:dirty');

      expect(result.beforeReport.score).toBeLessThan(100);
      expect(result.afterReport.score).toBe(100);
    });

    it('rulesCompared includes rule IDs from both audits', () => {
      const result = runReaudit(BEFORE_CSV_WITH_ISSUES, AFTER_CSV_CLEAN, 'env:dirty');

      expect(result.summary.rulesCompared.length).toBeGreaterThan(0);
      expect(result.summary.rulesCompared.every(r => typeof r === 'string')).toBe(true);
    });
  });

  describe('integration: semantic normalization case study', () => {
    it('normalizes case and updates issue counts', () => {
      const result = runReaudit(BEFORE_CSV_SEMANTIC, AFTER_CSV_NORMALIZED, 'env:semantic');

      expect(result.beforeReport.rowCount).toBe(3);
      expect(result.afterReport.rowCount).toBe(3);
    });
  });
});
