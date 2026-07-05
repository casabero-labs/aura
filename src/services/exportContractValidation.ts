import { CalibrationEvidenceStatus } from '../types';
import {
  AURA_EXPORT_CONTRACT_NAME,
  AURA_EXPORT_CONTRACT_VERSION,
} from './exportPackage';

export interface ExportContractValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const CALIBRATION_EVIDENCE_STATUSES: readonly CalibrationEvidenceStatus[] = [
  'none',
  'attempted',
  'preliminary',
  'formal',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const declaresLegacyMigration = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some(
    (entry) =>
      isRecord(entry) &&
      entry.from === 'experiment' &&
      entry.to === 'calibrationEvidence',
  );

export const validateAuraExportPackage = (
  packageLike: unknown,
): ExportContractValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(packageLike)) {
    return {
      valid: false,
      errors: ['El paquete exportado debe ser un objeto.'],
      warnings,
    };
  }

  const exportContract = packageLike.exportContract;
  if (!isRecord(exportContract)) {
    errors.push('El paquete debe incluir exportContract.');
  } else {
    if (exportContract.name !== AURA_EXPORT_CONTRACT_NAME) {
      errors.push(
        `exportContract.name debe ser ${AURA_EXPORT_CONTRACT_NAME}.`,
      );
    }

    if (exportContract.version !== AURA_EXPORT_CONTRACT_VERSION) {
      errors.push(
        `exportContract.version debe ser ${AURA_EXPORT_CONTRACT_VERSION}.`,
      );
    }

    if (
      !Array.isArray(exportContract.canonicalBlocks) ||
      !exportContract.canonicalBlocks.includes('calibrationEvidence')
    ) {
      errors.push(
        'exportContract.canonicalBlocks debe incluir calibrationEvidence.',
      );
    }

    const compatibility = exportContract.compatibility;
    if (
      !isRecord(compatibility) ||
      compatibility.legacyAliasIncluded !== false
    ) {
      errors.push(
        'exportContract.compatibility.legacyAliasIncluded debe ser false.',
      );
    }

    if (!declaresLegacyMigration(exportContract.deprecatedBlocks)) {
      warnings.push(
        'exportContract.deprecatedBlocks no declara la migración experiment a calibrationEvidence.',
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(packageLike, 'experiment')) {
    errors.push(
      'El bloque raíz experiment no está permitido en el contrato 2.0.',
    );
  }

  const calibrationEvidence = packageLike.calibrationEvidence;
  if (!isRecord(calibrationEvidence)) {
    errors.push('El paquete debe incluir calibrationEvidence.');
  } else {
    if (calibrationEvidence.classification !== 'experimental') {
      errors.push(
        'calibrationEvidence.classification debe ser experimental.',
      );
    }

    const summary = calibrationEvidence.summary;
    if (
      !isRecord(summary) ||
      !CALIBRATION_EVIDENCE_STATUSES.includes(
        summary.status as CalibrationEvidenceStatus,
      )
    ) {
      errors.push(
        'calibrationEvidence.summary.status no es un estado permitido.',
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
