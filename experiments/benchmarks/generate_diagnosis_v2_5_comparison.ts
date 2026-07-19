import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../../src/contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisV2_5Comparison } from '../../src/services/benchmark/diagnosisV2_5Comparison';

const report: AuditReportInput = {
  score: 82,
  rowCount: 12,
  colCount: 3,
  duplicateRows: 1,
  delimiterDetected: ',',
  issues: [
    {
      id: 'fixture:trim-name',
      column: 'Name',
      ruleName: 'Whitespace',
      ruleId: 'rule:trim-whitespace',
      category: 'Higiene',
      description: 'Whitespace detected',
      severity: 'info',
      count: 2,
      affectedPercentage: 16.67,
      sampleValues: [' Alice ', ' Bob '],
      automaticAuthorization: {
        actionType: 'trim_whitespace',
        authorized: true,
        conditionsMet: ['string-column'],
        reason: 'Lossless normalization',
      },
    },
    {
      id: 'fixture:null-age',
      column: 'Age',
      ruleName: 'Null values',
      ruleId: 'rule:null-values',
      category: 'Integridad',
      description: 'Null detected',
      severity: 'warning',
      count: 2,
      affectedPercentage: 16.67,
      sampleValues: [null, 22],
      automaticAuthorization: {
        actionType: 'null_values',
        authorized: false,
        conditionsMet: [],
        reason: 'Human decision required',
      },
    },
    {
      id: 'fixture:duplicate-row',
      column: null,
      ruleName: 'Duplicate rows',
      ruleId: 'rule:exact-duplicates',
      category: 'Duplicados',
      description: 'Duplicate row detected',
      severity: 'warning',
      count: 1,
      affectedPercentage: 8.33,
      sampleValues: ['row:8'],
    },
  ],
  columnStats: {
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 10,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
    Age: {
      inferredType: 'number', semanticType: 'age', distinctCount: 9,
      nullCount: 2, nullPercentage: 16.67, topValues: [], stats: {},
    },
    City: {
      inferredType: 'string', semanticType: 'city', distinctCount: 4,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
  },
  datasetProfile: {
    columns: [{ name: 'Name' }, { name: 'Age' }, { name: 'City' }],
  },
};

const envelope = _buildEvidenceEnvelopeV2(report, {
  privacyLevel: 'local_full',
  datasetSha256: '7'.repeat(64),
  delimiter: ',',
});

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const checkIndex = args.indexOf('--check');
  const outputPath = outputIndex >= 0 && args[outputIndex + 1]
    ? resolve(process.cwd(), args[outputIndex + 1])
    : null;
  const checkPath = checkIndex >= 0 && args[checkIndex + 1]
    ? resolve(process.cwd(), args[checkIndex + 1])
    : null;
  const serialized = `${JSON.stringify(buildDiagnosisV2_5Comparison(report, envelope), null, 2)}\n`;

  if (checkPath) {
    const expected = await readFile(checkPath, 'utf8');
    if (expected !== serialized) {
      throw new Error(`Diagnosis V2.5 comparison differs from ${checkPath}`);
    }
  }
  if (outputPath) {
    await writeFile(outputPath, serialized, 'utf8');
    process.stdout.write(`${outputPath}\n`);
    return;
  }
  process.stdout.write(serialized);
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
