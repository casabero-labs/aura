import { describe, expect, it } from 'vitest';
import { deriveDiagnosisExportStatus } from '../services/diagnosisExportState';

describe('deriveDiagnosisExportStatus', () => {
  it('marks a structured result as valid', () => {
    expect(deriveDiagnosisExportStatus({
      structuredDiagnosis: { version: 2 } as never,
      failureEvidence: null,
    })).toBe('valid');
  });

  it('marks canonical failure evidence as invalid', () => {
    expect(deriveDiagnosisExportStatus({
      structuredDiagnosis: null,
      failureEvidence: { contractId: 'aura.diagnosis-failure-evidence.v2' } as never,
    })).toBe('invalid');
  });

  it('uses not_run only when no diagnosis evidence exists', () => {
    expect(deriveDiagnosisExportStatus({ structuredDiagnosis: null, failureEvidence: null })).toBe('not_run');
  });
});
