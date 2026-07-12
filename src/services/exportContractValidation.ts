import { CalibrationEvidenceStatus } from '../types';
import {
  canonicalJson,
  exactDiagnosisPromptV2,
  sha256hex,
  validateExecutionReceiptIntegrityV1,
  type DiagnosisInputPackageV2,
  type ExecutionReceiptV1,
} from '../contracts/llm';
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

const sameCanonicalValue = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);

const validateDiagnosisTrace = (
  diagnostics: Record<string, unknown>,
  expectedStatus: 'valid' | 'invalid',
  errors: string[],
): void => {
  const inputLike = diagnostics.inputSnapshot;
  const receiptLike = diagnostics.executionReceipt;
  if (!isRecord(inputLike) || !isRecord(receiptLike)) return;
  if (
    inputLike.contractId !== 'aura.input-snapshot.v2'
    || inputLike.contractVersion !== '2.0.0'
    || typeof inputLike.systemInstruction !== 'string'
    || typeof inputLike.userPayload !== 'string'
    || !isRecord(inputLike.responseSchema)
    || !Array.isArray(inputLike.includedSections)
    || typeof inputLike.promptHash !== 'string'
    || typeof inputLike.responseSchemaHash !== 'string'
    || typeof inputLike.inputHash !== 'string'
  ) {
    errors.push('diagnosis.inputSnapshot no cumple aura.input-snapshot.v2.');
    return;
  }
  if (
    receiptLike.contractId !== 'aura.execution-receipt.v1'
    || receiptLike.contractVersion !== '1.0.0'
    || !Array.isArray(receiptLike.includedSections)
    || !Array.isArray(receiptLike.validationErrorCodes)
    || typeof receiptLike.receiptHash !== 'string'
    || typeof receiptLike.rawResponseHash !== 'string'
  ) {
    errors.push('diagnosis.executionReceipt no cumple aura.execution-receipt.v1.');
    return;
  }

  const input = inputLike as unknown as DiagnosisInputPackageV2;
  const receipt = receiptLike as unknown as ExecutionReceiptV1;
  const exactPrompt = exactDiagnosisPromptV2(input);
  const stableInput = {
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    inputMode: input.inputMode,
    includedSections: input.includedSections,
    systemInstruction: input.systemInstruction,
    userPayload: input.userPayload,
    responseSchema: input.responseSchema,
    evidenceEnvelopeRef: input.evidenceEnvelopeRef,
    promptVersion: input.promptVersion,
    promptHash: input.promptHash,
    responseSchemaHash: input.responseSchemaHash,
  };
  if (input.promptHash !== sha256hex(exactPrompt)) errors.push('diagnosis.inputSnapshot.promptHash no corresponde al prompt canónico.');
  if (input.responseSchemaHash !== sha256hex(canonicalJson(input.responseSchema))) errors.push('diagnosis.inputSnapshot.responseSchemaHash no corresponde al schema.');
  if (input.inputHash !== sha256hex(canonicalJson(stableInput))) errors.push('diagnosis.inputSnapshot.inputHash no corresponde al snapshot.');

  const receiptValidation = validateExecutionReceiptIntegrityV1(receipt, input, exactPrompt);
  receiptValidation.errors.forEach((error) => errors.push(`diagnosis.executionReceipt: ${error}.`));
  if (receipt.validationStatus !== expectedStatus) errors.push(`diagnosis.executionReceipt.validationStatus debe ser ${expectedStatus}.`);
  if (diagnostics.rawResponseHash !== receipt.rawResponseHash) errors.push('diagnosis.rawResponseHash no corresponde al recibo.');

  if (expectedStatus === 'valid') {
    const structured = diagnostics.structuredDiagnosis;
    if (isRecord(structured)) {
      if (!sameCanonicalValue(structured.inputSnapshot, inputLike)) errors.push('diagnosis.structuredDiagnosis.inputSnapshot no corresponde al snapshot exportado.');
      if (!sameCanonicalValue(structured.executionReceipt, receiptLike)) errors.push('diagnosis.structuredDiagnosis.executionReceipt no corresponde al recibo exportado.');
      if (structured.rawResponseHash !== receipt.rawResponseHash) errors.push('diagnosis.structuredDiagnosis.rawResponseHash no corresponde al recibo.');
    }
  } else {
    const failure = diagnostics.failureEvidence;
    if (isRecord(failure)) {
      if (failure.contractId !== 'aura.diagnosis-failure-evidence.v2') errors.push('diagnosis.failureEvidence no cumple aura.diagnosis-failure-evidence.v2.');
      if (!sameCanonicalValue(failure.inputSnapshot, inputLike)) errors.push('diagnosis.failureEvidence.inputSnapshot no corresponde al snapshot exportado.');
      if (!sameCanonicalValue(failure.executionReceipt, receiptLike)) errors.push('diagnosis.failureEvidence.executionReceipt no corresponde al recibo exportado.');
      if (failure.rawResponseHash !== receipt.rawResponseHash) errors.push('diagnosis.failureEvidence.rawResponseHash no corresponde al recibo.');
    }
  }
};

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

  const diagnostics = packageLike.diagnosis;
  if (!isRecord(diagnostics)) {
    errors.push('El paquete debe incluir diagnosis.');
  } else {
    const diagStatus = diagnostics.status;
    if (diagStatus !== 'valid' && diagStatus !== 'invalid' && diagStatus !== 'not_run') {
      errors.push("diagnosis.status debe ser 'valid', 'invalid' o 'not_run'.");
    }

    if (diagStatus === 'valid') {
      if (!isRecord(diagnostics.structuredDiagnosis) || diagnostics.structuredDiagnosis === null) {
        errors.push('diagnosis.structuredDiagnosis debe ser un objeto no-null cuando status es valid.');
      }
      if (!isRecord(diagnostics.inputSnapshot) || diagnostics.inputSnapshot === null) {
        errors.push('diagnosis.inputSnapshot debe ser un objeto no-null cuando status es valid.');
      }
      if (!isRecord(diagnostics.executionReceipt) || diagnostics.executionReceipt === null) {
        errors.push('diagnosis.executionReceipt debe ser un objeto no-null cuando status es valid.');
      }
      if (diagnostics.failureEvidence !== null && diagnostics.failureEvidence !== undefined) {
        errors.push('diagnosis.failureEvidence debe ser null/ausente cuando status es valid.');
      }
      validateDiagnosisTrace(diagnostics, 'valid', errors);
    }

    if (diagStatus === 'invalid') {
      if (!isRecord(diagnostics.failureEvidence) || diagnostics.failureEvidence === null) {
        errors.push('diagnosis.failureEvidence debe ser un objeto no-null cuando status es invalid.');
      }
      if (!isRecord(diagnostics.inputSnapshot) || diagnostics.inputSnapshot === null) {
        errors.push('diagnosis.inputSnapshot debe ser un objeto no-null cuando status es invalid.');
      }
      if (!isRecord(diagnostics.executionReceipt) || diagnostics.executionReceipt === null) {
        errors.push('diagnosis.executionReceipt debe ser un objeto no-null cuando status es invalid.');
      }
      if (diagnostics.structuredDiagnosis !== null && diagnostics.structuredDiagnosis !== undefined) {
        errors.push('diagnosis.structuredDiagnosis debe ser null/ausente cuando status es invalid.');
      }
      validateDiagnosisTrace(diagnostics, 'invalid', errors);
    }

    if (diagStatus === 'not_run') {
      if (diagnostics.structuredDiagnosis !== null && diagnostics.structuredDiagnosis !== undefined) {
        errors.push('diagnosis.structuredDiagnosis debe ser null/ausente cuando status es not_run.');
      }
      if (diagnostics.failureEvidence !== null && diagnostics.failureEvidence !== undefined) {
        errors.push('diagnosis.failureEvidence debe ser null/ausente cuando status es not_run.');
      }
      if (diagnostics.inputSnapshot !== null && diagnostics.inputSnapshot !== undefined) {
        errors.push('diagnosis.inputSnapshot debe ser null/ausente cuando status es not_run.');
      }
      if (diagnostics.executionReceipt !== null && diagnostics.executionReceipt !== undefined) {
        errors.push('diagnosis.executionReceipt debe ser null/ausente cuando status es not_run.');
      }
      if (diagnostics.rawResponseHash !== null && diagnostics.rawResponseHash !== undefined) {
        errors.push('diagnosis.rawResponseHash debe ser null/ausente cuando status es not_run.');
      }
    }
  }

  const API_KEY_PATTERN = /^api[_-]?key$/i;
  const deepCheckApiKey = (obj: unknown, path: string): void => {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => deepCheckApiKey(item, `${path}[${index}]`));
      return;
    }
    if (!isRecord(obj)) return;
    for (const [key, value] of Object.entries(obj)) {
      if (API_KEY_PATTERN.test(key)) {
        errors.push(`Prohibido: ${key} encontrado en ${path}.${key}.`);
      }
      if (isRecord(value) || Array.isArray(value)) {
        deepCheckApiKey(value, `${path}.${key}`);
      }
    }
  };
  deepCheckApiKey(packageLike, 'package');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
