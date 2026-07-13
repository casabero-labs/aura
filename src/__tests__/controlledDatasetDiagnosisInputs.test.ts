import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { defaultBudget } from '../contracts/llm/tokenBudget';
import { runAudit } from '../services/auditEngine';

const datasetPath = join(
  __dirname,
  '..',
  '..',
  'experiments',
  'final-evaluation',
  'datasets',
  'controlled_customers_phase8.csv',
);

describe('controlled Phase 8 diagnosis inputs', () => {
  it('builds the real evidence envelope and all three input modes', () => {
    const csv = readFileSync(datasetPath);
    const parsed = Papa.parse<Record<string, unknown>>(csv.toString('utf8'), {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: '',
    });
    const columns = parsed.meta.fields ?? [];
    const report = runAudit(parsed.data, columns, parsed.meta.delimiter || ',');
    const compatibleReport: AuditReportInput = {
      ...report,
      datasetProfile: report.datasetProfile ? {
        columns: report.datasetProfile.columns.map((column) => ({
          name: column.name,
          inferredType: column.inferredType,
          semanticType: column.semanticType,
          cardinality: report.columnStats[column.name]?.uniqueCount,
        })),
      } : undefined,
    };
    const envelope = _buildEvidenceEnvelopeV2(compatibleReport, {
      privacyLevel: 'local_full',
      datasetSha256: createHash('sha256').update(csv).digest('hex'),
      delimiter: report.delimiterDetected,
    });

    expect(report.issues).toHaveLength(29);
    expect(envelope.issues).toHaveLength(24);
    expect(envelope.evidence.samples.length).toBeGreaterThan(0);
    expect(Object.keys(envelope.evidence.columnStats)).toHaveLength(15);
    expect(JSON.stringify(envelope).length).toBeLessThanOrEqual(defaultBudget().maxCharacters);

    const modes = ['prompt_libre', 'smart_sample', 'recommended'] as const;
    const packages = modes.map((mode) => buildDiagnosisInputPackageV2(report, envelope, mode));

    expect(new Set(packages.map((input) => input.inputHash))).toHaveLength(3);
    expect(packages.every((input) => input.userPayload.length > 0)).toBe(true);
  });
});
