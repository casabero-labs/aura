import { CalibrationEvidenceStatus } from '../types';
import {
  canonicalJson,
  computeScriptHashV2,
  exactDiagnosisPromptV2,
  sha256hex,
  validateExecutionReceiptIntegrityV1,
  type DiagnosisInputPackageV2,
  type ExecutionReceiptV1,
  type ScriptContractV2,
} from '../contracts/llm';
import {
  AURA_EXPORT_CONTRACT_NAME,
  AURA_EXPORT_LEGACY_VERSION,
  AURA_EXPORT_CONTRACT_VERSION,
} from './exportPackage';
import {
  computePythonBundleHash,
  computePythonReceiptHash,
  validatePythonExecutionBundle,
  type PythonExecutionBundleV1,
  type PythonExecutionReceiptV1,
} from './remediationExecution/pythonExecutionContract';
import { NOT_RUN_REMEDIATION_LIMITATION } from './remediationExecution/remediationExport';

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
    || !inputLike.includedSections.every((section) => typeof section === 'string')
    || typeof inputLike.inputMode !== 'string'
    || typeof inputLike.evidenceEnvelopeRef !== 'string'
    || typeof inputLike.promptVersion !== 'string'
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
    || !receiptLike.validationErrorCodes.every((code) => typeof code === 'string')
    || typeof receiptLike.requestedModel !== 'string'
    || (receiptLike.observedModel !== null && typeof receiptLike.observedModel !== 'string')
    || (receiptLike.validationStatus !== 'valid' && receiptLike.validationStatus !== 'invalid')
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
  if (diagnostics.model !== receipt.requestedModel) errors.push('diagnosis.model no corresponde al modelo solicitado del recibo.');
  if (diagnostics.rawResponseHash !== receipt.rawResponseHash) errors.push('diagnosis.rawResponseHash no corresponde al recibo.');
  if (typeof diagnostics.rawResponse === 'string' && sha256hex(diagnostics.rawResponse) !== receipt.rawResponseHash) {
    errors.push('diagnosis.rawResponse no corresponde al hash de la respuesta cruda.');
  }

  if (expectedStatus === 'valid') {
    const structured = diagnostics.structuredDiagnosis;
    if (isRecord(structured)) {
      if (structured.version !== 2 || !isRecord(structured.diagnosis) || structured.diagnosis.contractId !== 'aura.diagnosis.v2') {
        errors.push('diagnosis.structuredDiagnosis no contiene un diagnóstico aura.diagnosis.v2 válido.');
      }
      if (!sameCanonicalValue(structured.inputSnapshot, inputLike)) errors.push('diagnosis.structuredDiagnosis.inputSnapshot no corresponde al snapshot exportado.');
      if (!sameCanonicalValue(structured.executionReceipt, receiptLike)) errors.push('diagnosis.structuredDiagnosis.executionReceipt no corresponde al recibo exportado.');
      if (structured.rawResponseHash !== receipt.rawResponseHash) errors.push('diagnosis.structuredDiagnosis.rawResponseHash no corresponde al recibo.');
      if (structured.inputMode !== input.inputMode || structured.inputHash !== input.inputHash || structured.promptHash !== input.promptHash || structured.evidenceEnvelopeRef !== input.evidenceEnvelopeRef) {
        errors.push('diagnosis.structuredDiagnosis no corresponde al snapshot canónico.');
      }
      if (!isRecord(structured.metrics) || structured.metrics.model !== receipt.observedModel) {
        errors.push('diagnosis.structuredDiagnosis.metrics.model no corresponde al modelo observado.');
      }
    }
  } else {
    const failure = diagnostics.failureEvidence;
    if (isRecord(failure)) {
      if (failure.contractId !== 'aura.diagnosis-failure-evidence.v2') errors.push('diagnosis.failureEvidence no cumple aura.diagnosis-failure-evidence.v2.');
      if (typeof failure.code !== 'string' || !receipt.validationErrorCodes.includes(failure.code)) errors.push('diagnosis.failureEvidence.code no corresponde a los códigos del recibo.');
      if (typeof failure.message !== 'string' || typeof failure.path !== 'string') errors.push('diagnosis.failureEvidence debe incluir message y path.');
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

    const isLegacy20 = exportContract.version === AURA_EXPORT_LEGACY_VERSION;
    if (exportContract.version !== AURA_EXPORT_CONTRACT_VERSION && !isLegacy20) {
      errors.push(
        `exportContract.version debe ser ${AURA_EXPORT_LEGACY_VERSION} o ${AURA_EXPORT_CONTRACT_VERSION}.`,
      );
    }

    if (
      !Array.isArray(exportContract.canonicalBlocks) ||
      !exportContract.canonicalBlocks.includes('calibrationEvidence') ||
      !exportContract.canonicalBlocks.includes('artifactIdentity')
      || (!isLegacy20 && !exportContract.canonicalBlocks.includes('remediationExecution'))
    ) {
      errors.push(
        'exportContract.canonicalBlocks debe incluir artifactIdentity, calibrationEvidence y, desde 2.1, remediationExecution.',
      );
    }
    if (isLegacy20 && Array.isArray(exportContract.canonicalBlocks)
      && exportContract.canonicalBlocks.includes('remediationExecution')) {
      errors.push('El contrato histórico 2.0 no puede declarar remediationExecution en canonicalBlocks.');
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

  const artifactIdentity = packageLike.artifactIdentity;
  if (!isRecord(artifactIdentity)) {
    errors.push('El paquete debe incluir artifactIdentity.');
  } else {
    if (typeof artifactIdentity.runId !== 'string' || artifactIdentity.runId.length === 0) {
      errors.push('artifactIdentity.runId debe ser un string no vacío.');
    }
    if (typeof artifactIdentity.reportId !== 'string' || artifactIdentity.reportId.length === 0) {
      errors.push('artifactIdentity.reportId debe ser un string no vacío.');
    }
    if (artifactIdentity.datasetSha256 !== null && (
      typeof artifactIdentity.datasetSha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(artifactIdentity.datasetSha256)
    )) {
      errors.push('artifactIdentity.datasetSha256 debe ser null o SHA-256 hexadecimal.');
    }
    if (artifactIdentity.diagnosisReceiptHash !== null && typeof artifactIdentity.diagnosisReceiptHash !== 'string') {
      errors.push('artifactIdentity.diagnosisReceiptHash debe ser null o string.');
    }
    const canonicalReport = isRecord(packageLike.diagnosticReport)
      ? packageLike.diagnosticReport
      : isRecord(packageLike.profile) && isRecord(packageLike.profile.report)
        ? packageLike.profile.report
        : null;
    if (!canonicalReport || artifactIdentity.reportContentHash !== sha256hex(canonicalJson(canonicalReport))) {
      errors.push('artifactIdentity.reportContentHash no corresponde al reporte canónico.');
    }
    if (isRecord(packageLike.diagnosticReport) && isRecord(packageLike.diagnosticReport.metadata)
      && artifactIdentity.reportId !== packageLike.diagnosticReport.metadata.reportId) {
      errors.push('artifactIdentity.reportId no corresponde a diagnosticReport.metadata.reportId.');
    }
    if (isRecord(packageLike.profile) && isRecord(packageLike.profile.auditEvidence)
      && artifactIdentity.datasetSha256 !== packageLike.profile.auditEvidence.datasetSha256) {
      errors.push('artifactIdentity.datasetSha256 no corresponde a profile.auditEvidence.datasetSha256.');
    }
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
      if (typeof diagnostics.diagnosisText === 'string' && diagnostics.diagnosisText.trim().length > 0) {
        errors.push('diagnosis.diagnosisText debe estar vacío cuando status es not_run. Una respuesta sin recibo no puede exportarse como diagnóstico ejecutado.');
      }
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
      if (diagnostics.rawResponse !== null && diagnostics.rawResponse !== undefined) {
        errors.push('diagnosis.rawResponse debe ser null/ausente cuando status es not_run.');
      }
    }

    if (isRecord(artifactIdentity)) {
      const receiptHash = isRecord(diagnostics.executionReceipt)
        ? diagnostics.executionReceipt.receiptHash
        : null;
      if (artifactIdentity.diagnosisReceiptHash !== receiptHash) {
        errors.push('artifactIdentity.diagnosisReceiptHash no corresponde al recibo exportado.');
      }
    }
  }

  const script = packageLike.script;
  if (!isRecord(script)) {
    errors.push('El paquete debe incluir script.');
  } else {
    const generatedScript = script.generatedScript;
    const approvedScript = script.approvedScript;
    const approvalStatus = script.approvalStatus;
    if (typeof generatedScript !== 'string' || typeof approvedScript !== 'string') {
      errors.push('script.generatedScript y script.approvedScript deben ser strings.');
    }
    if (!['not_requested', 'pending', 'approved', 'unverified'].includes(String(approvalStatus))) {
      errors.push('script.approvalStatus no es un estado permitido.');
    }

    const contract = script.contract;
    const plan = script.remediationPlan;
    const verification = script.verification;
    const hasApprovedScript = typeof approvedScript === 'string' && approvedScript.trim().length > 0;

    if (hasApprovedScript && approvalStatus === 'unverified' && !isRecord(contract)) {
      warnings.push('El script revisado no tiene contrato aura.script.v2; se exporta como unverified y no como ejecución certificada.');
    } else if (hasApprovedScript) {
      if (!isRecord(contract)) errors.push('script.contract es obligatorio cuando existe un script aprobado.');
      if (!isRecord(plan)) errors.push('script.remediationPlan es obligatorio cuando existe un script aprobado.');
      if (!isRecord(verification)) errors.push('script.verification es obligatorio cuando existe un script aprobado.');
      if (approvalStatus !== 'approved') errors.push('script.approvalStatus debe ser approved cuando existe un script aprobado.');

      if (isRecord(contract)) {
        if (contract.contractId !== 'aura.script.v2' || contract.contractVersion !== '2.0.0') {
          errors.push('script.contract no cumple aura.script.v2.');
        }
        if (contract.scriptText !== approvedScript || generatedScript !== approvedScript) {
          errors.push('El script aprobado no coincide exactamente con el contrato y el script generado.');
        }
        if (isRecord(artifactIdentity) && contract.datasetFingerprint !== artifactIdentity.datasetSha256) {
          errors.push('script.contract.datasetFingerprint no corresponde al SHA-256 del dataset.');
        }
        try {
          if (contract.scriptHash !== computeScriptHashV2(contract as unknown as ScriptContractV2)) {
            errors.push('script.contract.scriptHash no corresponde al contrato canónico.');
          }
        } catch {
          errors.push('script.contract no contiene los campos necesarios para verificar su hash.');
        }
      }

      if (isRecord(verification) && verification.valid !== true) {
        errors.push('script.verification.valid debe ser true para un script aprobado.');
      }
      if (isRecord(plan) && isRecord(contract)) {
        if (contract.remediationRef !== plan.planId) {
          errors.push('script.contract.remediationRef no corresponde al plan exportado.');
        }
        const planActions = Array.isArray(plan.plan) ? plan.plan : [];
        const approvedActionIds = new Set(
          planActions
            .filter((action) => isRecord(action) && action.approvalStatus === 'approved' && typeof action.actionId === 'string')
            .map((action) => (action as Record<string, unknown>).actionId),
        );
        const acceptedActionIds = Array.isArray(contract.acceptedActionIds) ? contract.acceptedActionIds : [];
        if (!acceptedActionIds.every((actionId) => approvedActionIds.has(actionId))) {
          errors.push('script.contract contiene acciones aceptadas sin aprobación en remediationPlan.');
        }
      }
    } else if (approvalStatus === 'approved' || approvalStatus === 'unverified') {
      errors.push(`script.approvalStatus no puede ser ${String(approvalStatus)} sin script revisado.`);
    }
  }

  const contractVersion = isRecord(exportContract) ? exportContract.version : null;
  const remediation = packageLike.remediationExecution;
  if (contractVersion === AURA_EXPORT_LEGACY_VERSION && remediation === undefined) {
    // Historical 2.0 packages remain readable without inventing remediation.
  } else if (contractVersion === AURA_EXPORT_LEGACY_VERSION) {
    errors.push('El contrato histórico 2.0 no puede incluir el bloque remediationExecution.');
  } else if (!isRecord(remediation)) {
    errors.push('El contrato 2.1 debe incluir remediationExecution.');
  } else {
    const status = remediation.status;
    const allowed = ['not_run', 'prepared', 'invalid', 'verified', 'reaudited'];
    if (!allowed.includes(String(status))) errors.push('remediationExecution.status no es válido.');
    const bundle = isRecord(remediation.executionBundle)
      ? remediation.executionBundle as unknown as PythonExecutionBundleV1
      : null;
    const receipt = isRecord(remediation.pythonReceipt)
      ? remediation.pythonReceipt as unknown as PythonExecutionReceiptV1
      : null;
    const verification = isRecord(remediation.verification) ? remediation.verification : null;
    const corrected = isRecord(remediation.correctedDataset) ? remediation.correctedDataset : null;
    const limitations = Array.isArray(remediation.limitations)
      && remediation.limitations.every((item) => typeof item === 'string')
      ? remediation.limitations as string[]
      : null;
    if (!limitations) errors.push('remediationExecution.limitations debe ser string[].');

    if (status === 'not_run') {
      if (bundle || receipt || verification || corrected) errors.push('remediationExecution not_run no admite artefactos de ejecución.');
      if (!limitations?.includes(NOT_RUN_REMEDIATION_LIMITATION)) errors.push('remediationExecution not_run debe declarar la limitación canónica.');
    }
    if (status === 'prepared') {
      if (!bundle || receipt || verification || corrected) errors.push('remediationExecution prepared exige solo executionBundle.');
    }
    if (status === 'invalid') {
      if (verification || corrected) errors.push('remediationExecution invalid no puede certificar verificación ni dataset corregido.');
      if (!limitations?.length) errors.push('remediationExecution invalid debe explicar la limitación.');
    }
    if (status === 'verified' || status === 'reaudited') {
      if (!bundle || !receipt || !corrected) errors.push(`remediationExecution ${String(status)} exige bundle, recibo y correctedDataset.`);
      if (status === 'verified' && verification) errors.push('remediationExecution verified no admite reauditoría todavía.');
      if (status === 'reaudited' && !verification) errors.push('remediationExecution reaudited exige verification.');
    }

    if (bundle && status !== 'invalid') {
      try {
        validatePythonExecutionBundle(bundle).forEach((error) => errors.push(`remediationExecution.executionBundle: ${error}.`));
        if (bundle.bundleHash !== computePythonBundleHash(bundle)) errors.push('remediationExecution.executionBundle.bundleHash no es íntegro.');
      } catch {
        errors.push('remediationExecution.executionBundle no puede verificarse de forma canónica.');
      }
      if (isRecord(artifactIdentity) && bundle.beforeDatasetSha256 !== artifactIdentity.datasetSha256) {
        errors.push('remediationExecution.executionBundle.beforeDatasetSha256 no corresponde a artifactIdentity.');
      }
      if (isRecord(script) && isRecord(script.contract) && bundle.approvedScriptHash !== script.contract.scriptHash) {
        errors.push('remediationExecution.executionBundle.approvedScriptHash no corresponde al contrato aprobado.');
      }
      if (isRecord(artifactIdentity) && bundle.inputReceiptRef !== artifactIdentity.diagnosisReceiptHash) {
        errors.push('remediationExecution.executionBundle.inputReceiptRef no corresponde al recibo diagnóstico.');
      }
    }
    if (receipt && status !== 'invalid') {
      try {
        if (receipt.receiptHash !== computePythonReceiptHash(receipt)) errors.push('remediationExecution.pythonReceipt.receiptHash no es íntegro.');
      } catch {
        errors.push('remediationExecution.pythonReceipt no puede verificarse de forma canónica.');
      }
      if (!bundle || receipt.runId !== bundle.runId || receipt.bundleHash !== bundle.bundleHash
        || receipt.approvedScriptHash !== bundle.approvedScriptHash
        || receipt.beforeDatasetSha256 !== bundle.beforeDatasetSha256
        || receipt.inputReceiptRef !== bundle.inputReceiptRef
        || receipt.evidenceEnvelopeRef !== bundle.evidenceEnvelopeRef) {
        errors.push('remediationExecution.pythonReceipt no corresponde al bundle.');
      }
      const syntaxPassed = isRecord(receipt.syntax) && receipt.syntax.status === 'passed';
      const executionPassed = isRecord(receipt.execution) && receipt.execution.status === 'passed';
      if ((status === 'verified' || status === 'reaudited')
        && (!syntaxPassed || !executionPassed)) {
        errors.push(`remediationExecution ${String(status)} exige ejecución Python exitosa.`);
      }
    }
    if (corrected) {
      if (typeof corrected.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(corrected.sha256)
        || typeof corrected.rowCount !== 'number' || !Number.isInteger(corrected.rowCount) || corrected.rowCount < 0
        || typeof corrected.columnCount !== 'number' || !Number.isInteger(corrected.columnCount) || corrected.columnCount < 0
        || typeof corrected.includedInEvidenceArchive !== 'boolean') {
        errors.push('remediationExecution.correctedDataset es inválido.');
      }
      if (!receipt || corrected.sha256 !== receipt.afterDatasetSha256
        || corrected.rowCount !== receipt.output?.rowCount
        || corrected.columnCount !== receipt.output?.columnCount) {
        errors.push('remediationExecution.correctedDataset no corresponde al recibo Python.');
      }
    }
    if (verification) {
      const validSummary = (summary: unknown): boolean => isRecord(summary)
        && typeof summary.score === 'number' && Number.isFinite(summary.score) && summary.score >= 0 && summary.score <= 100
        && typeof summary.issueCount === 'number' && Number.isInteger(summary.issueCount) && summary.issueCount >= 0
        && typeof summary.rowCount === 'number' && Number.isInteger(summary.rowCount) && summary.rowCount >= 0
        && typeof summary.columnCount === 'number' && Number.isInteger(summary.columnCount) && summary.columnCount >= 0;
      const findings = isRecord(verification.findings) ? verification.findings : null;
      const structuralVerificationValid = verification.contractVersion === '1.0.0'
        && typeof verification.executionId === 'string' && verification.executionId.length > 0
        && verification.executionId === bundle?.executionId
        && verification.executionId === bundle?.runId
        && verification.executionId === receipt?.runId
        && typeof verification.executedAt === 'string' && verification.executedAt.length > 0
        && validSummary(verification.before)
        && validSummary(verification.after)
        && findings !== null
        && Array.isArray(findings.resolved)
        && Array.isArray(findings.persistent)
        && Array.isArray(findings.new)
        && ['improved', 'unchanged', 'worsened', 'inconclusive'].includes(String(verification.outcome))
        && Array.isArray(verification.limitations)
        && verification.limitations.every((item) => typeof item === 'string');
      if (!bundle || !receipt || !corrected
        || verification.contractId !== 'aura.remediation-verification.v1'
        || !structuralVerificationValid
        || verification.sourceDatasetSha256 !== bundle.beforeDatasetSha256
        || verification.correctedDatasetSha256 !== corrected.sha256
        || verification.approvedScriptHash !== bundle.approvedScriptHash
        || verification.executionBundleHash !== bundle.bundleHash
        || verification.pythonReceiptHash !== receipt.receiptHash
        || verification.diagnosisReceiptHash !== bundle.inputReceiptRef
        || verification.evidenceEnvelopeRef !== bundle.evidenceEnvelopeRef) {
        errors.push('remediationExecution.verification no corresponde a la cadena certificada.');
      }
    }
    if (bundle && isRecord(script) && script.approvalStatus !== 'approved') {
      errors.push('remediationExecution exige un script aprobado y enlazado al contrato V2.');
    }
  }

  const API_KEY_PATTERN = /^api[_-]?key$/i;
  const RAW_SECRET_PATTERN = /^(stdout|stderr|rawCsv|sourceCsv|correctedCsv)$/i;
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
      if (RAW_SECRET_PATTERN.test(key)) {
        errors.push(`Prohibido: contenido crudo ${key} encontrado en ${path}.${key}.`);
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
