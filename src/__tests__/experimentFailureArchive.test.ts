import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildExperimentFailureArchive } from '../services/benchmark/experimentFailureArchive';
import { sha256BytesHex } from '../contracts/llm/hash';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

const failedFixture = () => {
  const fixture = createExperimentEvidenceFixture();
  const source = fixture.runs[0];
  const run = {
    ...source,
    status: 'failed' as const,
    diagnosis: {
      ...source.diagnosis!,
      status: 'failed' as const,
      rawOutput: '{"contractId":"aura.diagnosis.v2"}',
      parsedOutput: { contractId: 'aura.diagnosis.v2' },
      validationErrors: [{
        code: 'DIAGNOSIS_REVIEW_DOWNGRADE',
        path: '$.issues[2].requiresHumanReview',
        message: 'Must be true.',
      }],
      error: {
        code: 'DIAGNOSIS_CONTRACT_INVALID',
        message: 'The diagnosis failed validation.',
        retryable: false,
      },
    },
    executionReceipt: source.executionReceipt
      ? {
          ...source.executionReceipt,
          validationStatus: 'invalid' as const,
          validationErrorCodes: ['DIAGNOSIS_REVIEW_DOWNGRADE'],
        }
      : null,
  };
  return { campaign: fixture.campaign, run };
};

describe('experimentFailureArchive', () => {
  it('exports the complete failed-run evidence without the source dataset', () => {
    const { campaign, run } = failedFixture();
    const archive = buildExperimentFailureArchive({
      campaign,
      run,
      generatedAt: '2026-07-14T18:00:00.000Z',
    });
    const files = unzipSync(archive.bytes);
    const filenames = Object.keys(files).sort();

    expect(filenames).toEqual([
      'README.txt',
      'attempts/attempt-events.json',
      'campaign/campaign.json',
      'environment/environment.json',
      'input/exact-prompt.txt',
      'input/response-schema.json',
      'input/system-instruction.txt',
      'input/user-payload.json',
      'manifest.json',
      'output/provider-response.raw.json',
      'receipts/execution-receipt.json',
      'run/failure-summary.json',
      'run/run.json',
      'validation/errors.json',
    ]);
    expect(strFromU8(files['output/provider-response.raw.json']))
      .toBe(run.diagnosis?.rawOutput);
    expect(strFromU8(files['input/exact-prompt.txt'])).toContain(run.input.userPayload);
    expect(filenames.some((filename) => /source|dataset.*\.csv|raw.*\.csv/i.test(filename))).toBe(false);
    expect(archive.manifest.rawDatasetIncluded).toBe(false);

    for (const entry of archive.manifest.files) {
      expect(files[entry.filename]?.byteLength).toBe(entry.sizeBytes);
      expect(sha256BytesHex(files[entry.filename])).toBe(entry.sha256);
    }
  });

  it('refuses to invent a failure package for a non-failed run', () => {
    const fixture = createExperimentEvidenceFixture();
    expect(() => buildExperimentFailureArchive({
      campaign: fixture.campaign,
      run: fixture.runs[0],
      generatedAt: fixture.generatedAt,
    })).toThrow('FAILURE_ARCHIVE_REQUIRES_FAILED_RUN');
  });

  it('preserves a failed run even when the provider never produced a diagnosis response', () => {
    const fixture = createExperimentEvidenceFixture();
    const run = {
      ...fixture.runs[0],
      status: 'failed' as const,
      diagnosis: null,
      executionReceipt: null,
    };
    const archive = buildExperimentFailureArchive({
      campaign: fixture.campaign,
      run,
      generatedAt: fixture.generatedAt,
    });
    const files = unzipSync(archive.bytes);
    const summary = JSON.parse(strFromU8(files['run/failure-summary.json']));

    expect(summary.diagnosisStatus).toBe('not_started');
    expect(strFromU8(files['output/provider-response.raw.json'])).toBe('');
    expect(JSON.parse(strFromU8(files['validation/errors.json']))).toEqual([]);
  });
});
