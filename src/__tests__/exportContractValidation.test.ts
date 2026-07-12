import { describe, expect, it } from 'vitest';
import { validateAuraExportPackage } from '../services/exportContractValidation';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import { buildAuraExportPackage } from '../services/exportPackage';
import { AuditReport } from '../types';
import {
  buildDiagnosisInputPackageV2,
  buildExecutionReceiptV1,
  exactDiagnosisPromptV2,
} from '../contracts/llm';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';

const report: AuditReport = {
  score: 80,
  rowCount: 10,
  colCount: 1,
  duplicateRows: 0,
  issues: [],
  columnStats: {
    email: {
      name: 'email', inferredType: 'string', nullCount: 0, uniqueCount: 10,
      sampleValues: ['a@example.com'],
    },
  },
  scoreBreakdown: [],
  delimiterDetected: ',',
  datasetProfile: {
    totalRows: 10,
    totalColumns: 1,
    columns: [{
      name: 'email', cardinality: 'unique', uniqueRatio: 1, sparsity: 0,
      inferredType: 'string', isCandidateForCoalescence: false, pruneRecommendation: 'keep',
    }],
    coalescencePairs: [],
    pruningCandidates: [],
    generatedAt: '2026-07-12T00:00:00.000Z',
  },
};

const buildValidPackage = () => {
  const manifest = buildEvidenceManifest({
    auditEvidence: null,
    benchmarkResults: [],
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
      status: 'not_run',
      model: 'test-model',
      providerType: 'ollama',
      diagnosisText: '',
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
    benchmarkResults: [],
    improvementRun: null,
  });
};

const buildTrace = (status: 'valid' | 'invalid') => {
  const envelope = _buildEvidenceEnvelopeV2(report as any, {
    privacyLevel: 'local_full',
    datasetSha256: 'a'.repeat(64),
    delimiter: ',',
  });
  const inputSnapshot = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
  const rawResponse = '{"contractId":"aura.diagnosis.v2"}';
  const executionReceipt = buildExecutionReceiptV1({
    input: inputSnapshot,
    requestedInputMode: 'smart_sample',
    exactPrompt: exactDiagnosisPromptV2(inputSnapshot),
    provider: 'Ollama',
    requestedModel: 'model-a',
    observedModel: status === 'valid' ? 'model-a' : null,
    inference: {
      temperature: 0.1, topP: 0.9, numCtx: 16384, numPredict: 1600,
      think: false, seed: null, keepAlive: '10m', timeoutSeconds: 600,
    },
    startedAt: '2026-07-12T00:00:00.000Z',
    completedAt: '2026-07-12T00:00:01.000Z',
    rawResponse,
    validationStatus: status,
    validationErrorCodes: status === 'invalid' ? ['DIAGNOSIS_ADAPTER_ERROR'] : [],
  });
  const common = {
    status,
    model: 'model-a',
    providerType: 'ollama' as const,
    diagnosisText: status === 'valid' ? 'Diagnóstico válido' : '',
    inputSnapshot,
    executionReceipt,
    rawResponseHash: executionReceipt.rawResponseHash,
  };
  if (status === 'valid') {
    return {
      ...common,
      structuredDiagnosis: {
        version: 2,
        diagnosis: { contractId: 'aura.diagnosis.v2' },
        metrics: { latencyMs: 1, tokensGenerated: 1, model: 'model-a', provider: 'Ollama', isLocal: true },
        promptHash: inputSnapshot.promptHash,
        evidenceEnvelopeRef: inputSnapshot.evidenceEnvelopeRef,
        promptVersion: inputSnapshot.promptVersion,
        rawResponseHash: executionReceipt.rawResponseHash,
        inputMode: inputSnapshot.inputMode,
        inputHash: inputSnapshot.inputHash,
        inputSnapshot,
        executionReceipt,
      },
      failureEvidence: null,
    };
  }
  return {
    ...common,
    structuredDiagnosis: null,
    failureEvidence: {
      contractId: 'aura.diagnosis-failure-evidence.v2',
      code: 'DIAGNOSIS_ADAPTER_ERROR',
      message: 'transport failed',
      path: 'adapter',
      inputSnapshot,
      executionReceipt,
      rawResponseHash: executionReceipt.rawResponseHash,
    },
  };
};

const withDiagnosis = (diagnosis: ReturnType<typeof buildTrace>) => {
  const base = buildValidPackage();
  return {
    ...base,
    artifactIdentity: {
      ...base.artifactIdentity,
      diagnosisReceiptHash: diagnosis.executionReceipt.receiptHash,
    },
    diagnosis,
  };
};

  describe('validateAuraExportPackage', () => {
  it('acepta el paquete técnico 2.0 construido por AURA', () => {
    const result = validateAuraExportPackage(buildValidPackage());

    expect(result).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it('rechaza entradas no estructuradas sin lanzar excepciones', () => {
    expect(validateAuraExportPackage(null)).toEqual({
      valid: false,
      errors: ['El paquete exportado debe ser un objeto.'],
      warnings: [],
    });
    expect(() => validateAuraExportPackage('invalid')).not.toThrow();
  });

  it('rechaza un contrato distinto de la versión técnica 2.0', () => {
    const validPackage = buildValidPackage();
    const result = validateAuraExportPackage({
      ...validPackage,
      exportContract: {
        ...validPackage.exportContract,
        name: 'otro-contrato',
        version: '1.0',
        canonicalBlocks: ['manifest'],
        compatibility: {
          ...validPackage.exportContract.compatibility,
          legacyAliasIncluded: true,
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'exportContract.name debe ser aura-technical-export.',
        'exportContract.version debe ser 2.0.',
        'exportContract.canonicalBlocks debe incluir artifactIdentity y calibrationEvidence.',
        'exportContract.compatibility.legacyAliasIncluded debe ser false.',
      ]),
    );
  });

  it('rechaza el alias legacy experiment en la raíz', () => {
    const result = validateAuraExportPackage({
      ...buildValidPackage(),
      experiment: {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'El bloque raíz experiment no está permitido en el contrato 2.0.',
    );
  });

  it('rechaza evidencia de calibración ausente o metodológicamente inválida', () => {
    const validPackage = buildValidPackage();
    const result = validateAuraExportPackage({
      ...validPackage,
      calibrationEvidence: {
        ...validPackage.calibrationEvidence,
        classification: 'definitive',
        summary: {
          ...validPackage.calibrationEvidence.summary,
          status: 'certified',
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'calibrationEvidence.classification debe ser experimental.',
        'calibrationEvidence.summary.status no es un estado permitido.',
      ]),
    );
  });

  it('advierte si falta la declaración de migración legacy sin bloquear el paquete', () => {
    const validPackage = buildValidPackage();
    const result = validateAuraExportPackage({
      ...validPackage,
      exportContract: {
        ...validPackage.exportContract,
        deprecatedBlocks: [],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain(
      'exportContract.deprecatedBlocks no declara la migración experiment a calibrationEvidence.',
    );
  });

  it.each(['valid', 'invalid'] as const)('acepta evidencia %s enlazada criptográficamente', (status) => {
    expect(validateAuraExportPackage(withDiagnosis(buildTrace(status))).valid).toBe(true);
  });

  it('rechaza valid sin diagnóstico e invalid sin evidencia de fallo', () => {
    const base = buildValidPackage();
    expect(validateAuraExportPackage({ ...base, diagnosis: { ...base.diagnosis, status: 'valid' } }).valid).toBe(false);
    expect(validateAuraExportPackage({ ...base, diagnosis: { ...base.diagnosis, status: 'invalid' } }).valid).toBe(false);
  });

  it('rechaza not_run con cualquier evidencia técnica', () => {
    const base = buildValidPackage();
    const result = validateAuraExportPackage({
      ...base,
      diagnosis: { ...base.diagnosis, rawResponseHash: 'a'.repeat(64) },
    });
    expect(result.valid).toBe(false);
  });

  it('rechaza not_run cuando existe texto de una respuesta sin recibo', () => {
    const base = buildValidPackage();
    const result = validateAuraExportPackage({
      ...base,
      diagnosis: { ...base.diagnosis, diagnosisText: 'respuesta legacy sin trazabilidad' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('diagnosisText debe estar vacío');
  });

  it('rechaza alteraciones de snapshot, recibo y hash de respuesta', () => {
    const original = withDiagnosis(buildTrace('valid'));
    for (const diagnosis of [
      { ...original.diagnosis, inputSnapshot: { ...original.diagnosis.inputSnapshot, inputHash: 'b'.repeat(64) } },
      { ...original.diagnosis, executionReceipt: { ...original.diagnosis.executionReceipt, receiptHash: 'c'.repeat(64) } },
      { ...original.diagnosis, rawResponseHash: 'd'.repeat(64) },
      { ...original.diagnosis, structuredDiagnosis: { ...original.diagnosis.structuredDiagnosis, inputHash: 'e'.repeat(64) } },
    ]) {
      expect(validateAuraExportPackage({ ...original, diagnosis }).valid).toBe(false);
    }
  });

  it.each(['apiKey', 'api_key', 'API-KEY'])('rechaza %s dentro de arrays anidados', (key) => {
    const packageLike = buildValidPackage() as any;
    packageLike.calibrationEvidence.results = [{ nested: [{ [key]: 'secret' }] }];
    expect(validateAuraExportPackage(packageLike).valid).toBe(false);
  });
});
