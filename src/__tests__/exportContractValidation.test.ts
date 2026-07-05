import { describe, expect, it } from 'vitest';
import { validateAuraExportPackage } from '../services/exportContractValidation';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import { buildAuraExportPackage } from '../services/exportPackage';
import { AuditReport } from '../types';

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
      model: 'test-model',
      providerType: 'ollama',
      diagnosisText: 'Diagnóstico de prueba.',
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
        'exportContract.canonicalBlocks debe incluir calibrationEvidence.',
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
});
