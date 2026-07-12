import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditExecutionEvidence, AuditReport } from '../types';
import { createFormalCampaignBundle } from '../services/benchmark/formalCampaignFactory';
import { FINAL_EVALUATION_PROTOCOL } from '../services/benchmark/finalEvaluationProtocol';
import { validateExperimentCampaignV1, validateExperimentRunV1 } from '../services/benchmark/experimentGuards';

const columnNames = ['customer_id', 'full_name', 'email', 'birth_date', 'registration_date', 'country', 'city', 'plan_type', 'monthly_spend', 'total_spend', 'credits_used', 'total_credits', 'status', 'phone', 'notes'];
const report = {
  score: 100, rowCount: 50, colCount: 15, duplicateRows: 0, delimiterDetected: ',',
  issues: [],
  columnStats: Object.fromEntries(columnNames.map((name) => [name, { inferredType: 'string', distinctCount: 50, nullCount: 0, nullPercentage: 0 }])),
  datasetProfile: { columns: columnNames.map((name) => ({ name, inferredType: 'string', cardinality: 'high' })) },
} as unknown as AuditReport;

const evidence = {
  datasetFingerprint: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
  datasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
  rowsProcessed: 50,
  columnsProcessed: 15,
} as AuditExecutionEvidence;

const controlledCsv = readFileSync(join(__dirname, '..', '..', 'experiments/final-evaluation/datasets/controlled_customers_phase8.csv'));
const datasetFile = { arrayBuffer: async () => controlledCsv.buffer.slice(controlledCsv.byteOffset, controlledCsv.byteOffset + controlledCsv.byteLength) } as Pick<File, 'arrayBuffer'>;
const modelManifest = JSON.parse(readFileSync(
  join(__dirname, '..', '..', 'experiments/final-evaluation/model-manifest.v1.json'),
  'utf8',
)) as { models: Array<{ id: string; expectedGgufSha256: string }> };
const expectedShaByModel = new Map(modelManifest.models.map((model) => [model.id, model.expectedGgufSha256]));

afterEach(() => vi.unstubAllGlobals());

describe('formal OE4 campaign factory', () => {
  it('creates 45 diagnosis-only units only after verifying all Ollama models', async () => {
    const models = FINAL_EVALUATION_PROTOCOL.models.map((model, index) => ({
      name: model,
      digest: `${String(index + 1).repeat(64)}`,
    }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('/api/version') ? { version: '0.20.3' } : { models },
    })));

    const bundle = await createFormalCampaignBundle({
      report,
      auditEvidence: evidence,
      datasetFile,
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      appCommit: 'abcdef1234567',
      now: () => '2026-07-11T22:00:00.000Z',
    });

    expect(bundle.runs).toHaveLength(45);
    expect(new Set(bundle.runs.map((run) => run.input.inputHash)).size).toBe(3);
    expect(bundle.runs.every((run) => run.script === null)).toBe(true);
    expect(bundle.runs.every((run) => (
      run.environment.model.expectedGgufSha256 === expectedShaByModel.get(run.modelId)
    ))).toBe(true);
    expect(validateExperimentCampaignV1(bundle.campaign)).toEqual({ valid: true, errors: [] });
    expect(bundle.runs.every((run) => validateExperimentRunV1(run).valid)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects any dataset other than the frozen controlled CSV', async () => {
    await expect(createFormalCampaignBundle({
      report,
      auditEvidence: { ...evidence, datasetFingerprint: 'bad' },
      datasetFile: { arrayBuffer: async () => new TextEncoder().encode('wrong dataset').buffer },
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      appCommit: 'abcdef1234567',
    })).rejects.toThrow('controlled_customers_phase8.csv');
  });

  it('rejects an Ollama server older than the formal minimum', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('/api/version') ? { version: '0.4.9' } : { models: [] },
    })));
    await expect(createFormalCampaignBundle({
      report, auditEvidence: evidence, datasetFile,
      ollamaBaseUrl: 'http://127.0.0.1:11434', appCommit: 'abcdef1234567',
    })).rejects.toThrow(/0\.5\.0/);
  });
});
