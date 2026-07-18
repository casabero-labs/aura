import { describe, expect, it } from 'vitest';
import { buildAuraExportPackage } from '../services/exportPackage';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import { AuditReport, BenchmarkResult } from '../types';

const report: AuditReport = {
  score: 80,
  rowCount: 10,
  colCount: 2,
  duplicateRows: 0,
  issues: [],
  columnStats: {},
  scoreBreakdown: [],
  delimiterDetected: ',',
};

const preliminaryResult: BenchmarkResult = {
  id: 'calibration-1',
  provider: 'Test',
  providerType: 'ollama',
  inputMode: 'smart_sample',
  model: 'test-model',
  temperature: 0.2,
  status: 'completed',
  latencyMs: 20,
  firstTokenMs: 5,
  tokensGenerated: 10,
  tokensPerSecond: 500,
  contractCompliance: true,
  formatCompliance: true,
  pythonScriptIncluded: false,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'preliminary_valid',
  timestamp: '2026-07-04T12:00:00.000Z',
};

const buildPackage = (benchmarkResults: BenchmarkResult[] = []) => {
  const manifest = buildEvidenceManifest({
    auditEvidence: null,
    benchmarkResults,
  });

  return buildAuraExportPackage({
    manifest,
    profile: {
      report,
      auditEvidence: null,
    },
    deterministicValidation: null,
    hitlDecision: null,
    diagnosis: {
      status: 'valid' as const,
      model: 'test-model',
      providerType: 'ollama',
      diagnosisText: 'Diagnóstico de prueba.',
      structuredDiagnosis: null,
      failureEvidence: null,
      inputSnapshot: null,
      executionReceipt: null,
      rawResponseHash: null,
    },
    script: {
      generatedScript: '',
      scriptValidation: null,
      approvedScript: '',
    },
    benchmarkResults,
    improvementRun: null,
  });
};

describe('buildAuraExportPackage', () => {
  it('declara contrato 2.1 y bloques canónicos estables', () => {
    const exported = buildPackage();

    expect(exported.exportContract.name).toBe('aura-technical-export');
    expect(exported.exportContract.version).toBe('2.1');
    expect(exported.exportContract.generatedAt).toBe(exported.manifest.generatedAt);
    expect(exported.exportContract.canonicalBlocks).toEqual([
      'artifactIdentity',
      'manifest',
      'profile',
      'diagnosis',
      'script',
      'remediationExecution',
      'calibrationEvidence',
    ]);
    expect(exported.remediationExecution.status).toBe('not_run');
  });

  it('incluye calibrationEvidence aunque no se hayan ejecutado corridas', () => {
    const exported = buildPackage();

    expect(exported.calibrationEvidence.classification).toBe('experimental');
    expect(exported.calibrationEvidence.summary.status).toBe('none');
    expect(exported.calibrationEvidence.results).toEqual([]);
  });

  it('normaliza diagnóstico y script para que el contrato exportado sea explícito', () => {
    const exported = buildPackage();

    expect(exported.diagnosis).toEqual(expect.objectContaining({
      rawResponse: null,
      structuredDiagnosis: null,
      failureEvidence: null,
      inputSnapshot: null,
      executionReceipt: null,
    }));
    expect(exported.script).toEqual(expect.objectContaining({
      remediationPlan: null,
      contract: null,
      verification: null,
      approvalStatus: 'not_requested',
    }));
  });

  it('no presenta un script sin contrato V2 como aprobado contractual', () => {
    const manifest = buildEvidenceManifest({ auditEvidence: null, benchmarkResults: [] });
    const exported = buildAuraExportPackage({
      manifest,
      profile: { report, auditEvidence: null },
      diagnosis: {
        status: 'not_run', model: 'test-model', providerType: 'ollama', diagnosisText: '',
      },
      script: {
        generatedScript: 'print("ok")\n',
        scriptValidation: null,
        approvedScript: 'print("ok")\n',
      },
      benchmarkResults: [],
    });

    expect(exported.script.approvalStatus).toBe('unverified');
  });

  it('no reintroduce experiment como bloque silencioso', () => {
    const exported = buildPackage();

    expect(exported).not.toHaveProperty('experiment');
    expect(exported.exportContract.canonicalBlocks).not.toContain('experiment');
    expect(exported.exportContract.compatibility.legacyAliasIncluded).toBe(false);
  });

  it('documenta la migración experiment a calibrationEvidence', () => {
    const exported = buildPackage();

    expect(exported.exportContract.deprecatedBlocks).toEqual([
      expect.objectContaining({
        from: 'experiment',
        to: 'calibrationEvidence',
        removedIn: '2.0',
      }),
    ]);
    expect(exported.exportContract.compatibility.migration).toContain(
      'calibrationEvidence.results',
    );
  });

  it('conserva resultados y límites sin claims inflados', () => {
    const exported = buildPackage([preliminaryResult]);
    const serialized = JSON.stringify(exported).toLowerCase();

    expect(exported.calibrationEvidence.results).toEqual([preliminaryResult]);
    expect(exported.calibrationEvidence.summary.status).toBe('preliminary');
    expect(serialized).not.toContain('benchmark definitivo');
    expect(serialized).not.toContain('mejor modelo');
    expect(serialized).not.toContain('ganador universal');
    expect(serialized).not.toContain('production-ready');
  });
});
