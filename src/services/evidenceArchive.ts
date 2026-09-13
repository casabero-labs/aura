import { strToU8, zipSync } from 'fflate';
import {
  exactDiagnosisPromptV2,
  type DiagnosisInputPackageV2,
} from '../contracts/llm';
import type { buildAuraExportPackage } from './exportPackage';
import type { VerifiedRemediationEvidence } from './remediationExecution/verifiedRemediationEvidence';
import { sha256BytesHex } from '../contracts/llm/hash';
import { EDITORIAL_ARTIFACT_THEME } from './editorialArtifactTheme';

export const AURA_EVIDENCE_PACKAGE_CONTRACT = 'aura.evidence-package.v1' as const;

type AuraTechnicalExport = ReturnType<typeof buildAuraExportPackage>;

export interface EvidenceArchiveInput {
  technicalExport: AuraTechnicalExport;
  issuesCsv: string;
  diagnosticPdf?: Uint8Array | null;
  activityLog?: Array<{ time: string; msg: string }>;
  verifiedExecution?: VerifiedRemediationEvidence | null;
  includeCorrectedDataset?: boolean;
}

export interface EvidenceArchiveManifestFile {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  description: string;
}

export interface EvidenceArchiveManifest {
  contractId: typeof AURA_EVIDENCE_PACKAGE_CONTRACT;
  contractVersion: '1.0.0';
  generatedAt: string;
  runId: string;
  reportId: string;
  datasetSha256: string | null;
  diagnosisReceiptHash: string | null;
  privacy: {
    rawDatasetIncluded: false;
    correctedDatasetIncluded: boolean;
    correctedDatasetMayContainPersonalData: boolean;
    note: string;
  };
  snapshots: {
    kind: 'reproducible_svg_evidence';
    browserScreenshots: false;
    note: string;
  };
  files: EvidenceArchiveManifestFile[];
}

export interface EvidenceArchiveResult {
  filename: string;
  bytes: Uint8Array;
  manifest: EvidenceArchiveManifest;
}

interface PendingFile {
  content: string | Uint8Array;
  mediaType: string;
  description: string;
}

const asBytes = (content: string | Uint8Array): Uint8Array =>
  typeof content === 'string' ? strToU8(content) : content;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeFilename = (value: unknown): string => {
  const normalized = String(value ?? 'dataset')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'dataset';
};

const sha256Bytes = async (content: Uint8Array): Promise<string> => {
  const stable = Uint8Array.from(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', stable);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const escapeXml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const truncate = (value: unknown, length = 88): string => {
  const text = String(value ?? 'n/d').replace(/\s+/g, ' ').trim();
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
};

export const buildSnapshotSvg = (
  eyebrow: string,
  title: string,
  rows: Array<[string, unknown]>,
): string => {
  const height = 190 + rows.length * 52;
  const body = rows.map(([label, value], index) => {
    const y = 190 + index * 52;
    return [
      `<text x="72" y="${y}" class="label">${escapeXml(label.toUpperCase())}</text>`,
      `<text x="330" y="${y}" class="value">${escapeXml(truncate(value))}</text>`,
      `<line x1="72" y1="${y + 18}" x2="1128" y2="${y + 18}" class="rule" />`,
    ].join('');
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
  <style>
    .bg { fill: ${EDITORIAL_ARTIFACT_THEME.colors.canvas}; }
    .ink { fill: ${EDITORIAL_ARTIFACT_THEME.colors.ink}; font-family: "Source Sans 3", Arial, sans-serif; }
    .eyebrow { fill: ${EDITORIAL_ARTIFACT_THEME.colors.muted}; font-family: "Courier New", monospace; font-size: 16px; letter-spacing: 3px; }
    .title { fill: ${EDITORIAL_ARTIFACT_THEME.colors.ink}; font-family: "Times New Roman", Times, serif; font-size: 42px; font-weight: 700; }
    .label { fill: ${EDITORIAL_ARTIFACT_THEME.colors.muted}; font-family: "Courier New", monospace; font-size: 14px; letter-spacing: 1px; }
    .value { fill: ${EDITORIAL_ARTIFACT_THEME.colors.ink}; font-family: "Source Sans 3", Arial, sans-serif; font-size: 18px; }
    .rule { stroke: ${EDITORIAL_ARTIFACT_THEME.colors.line}; stroke-width: 1; }
  </style>
  <rect class="bg" width="1200" height="${height}" />
  <text x="72" y="62" class="eyebrow">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="72" y="122" class="title">${escapeXml(title)}</text>
  <line x1="72" y1="148" x2="1128" y2="148" class="rule" />
  ${body}
</svg>\n`;
};

const addFile = (
  files: Record<string, PendingFile>,
  path: string,
  content: string | Uint8Array | null | undefined,
  mediaType: string,
  description: string,
) => {
  if (content === null || content === undefined || (typeof content === 'string' && content.length === 0)) return;
  files[path] = { content, mediaType, description };
};

export const buildEvidenceArchive = async ({
  technicalExport,
  issuesCsv,
  diagnosticPdf = null,
  activityLog = [],
  verifiedExecution = null,
  includeCorrectedDataset = false,
}: EvidenceArchiveInput): Promise<EvidenceArchiveResult> => {
  const files: Record<string, PendingFile> = {};
  const identity = technicalExport.artifactIdentity;
  const diagnosis = technicalExport.diagnosis;
  const script = technicalExport.script;
  const snapshot = isRecord(diagnosis.inputSnapshot)
    ? diagnosis.inputSnapshot as unknown as DiagnosisInputPackageV2
    : null;

  // ── Verified execution + reaudit gate ──
  // corrected.csv may only enter the ZIP after a verified execution AND a
  // completed reaudit. The original source.csv is never included.
  const hasVerifiedExecution = Boolean(
    verifiedExecution
    && verifiedExecution.bundle
    && verifiedExecution.receipt
    && verifiedExecution.correctedCsv
    && verifiedExecution.correctedCsv.byteLength > 0
    && verifiedExecution.reaudit
    && verifiedExecution.reaudit.beforeReport
    && verifiedExecution.reaudit.afterReport
    && verifiedExecution.beforeAfterSummary
    && technicalExport.remediationExecution.status === 'reaudited'
    && technicalExport.remediationExecution.verification?.pythonReceiptHash === verifiedExecution?.receipt.receiptHash
    && technicalExport.remediationExecution.verification?.executionBundleHash === verifiedExecution?.bundle.bundleHash
    && technicalExport.remediationExecution.correctedDataset?.sha256 === verifiedExecution?.verification.correctedDatasetSha256
    && technicalExport.remediationExecution.correctedDataset?.includedInEvidenceArchive === includeCorrectedDataset
    && sha256BytesHex(verifiedExecution?.correctedCsv ?? new Uint8Array()) === verifiedExecution?.verification.correctedDatasetSha256
  );
  const includesCorrectedDataset = hasVerifiedExecution && includeCorrectedDataset;

  const readme = [
    '# AURA - Paquete completo de evidencia',
    '',
    `Run ID: ${identity.runId}`,
    `Report ID: ${identity.reportId}`,
    `Dataset SHA-256: ${identity.datasetSha256 ?? 'no disponible'}`,
    `Recibo diagnóstico: ${identity.diagnosisReceiptHash ?? 'no disponible'}`,
    '',
    'Este ZIP reúne los artefactos de una misma sesión para revisión, auditoría y reproducción.',
    'No incluye el CSV original ni API keys. El dataset se identifica por su SHA-256.',
    'Puede incluir muestras visibles de los hallazgos y del payload; revísalo antes de compartirlo fuera del entorno autorizado.',
    'Las capturas SVG son vistas reproducibles generadas desde los contratos; no son screenshots del navegador.',
    'manifest.json contiene el SHA-256 y tamaño de cada archivo incluido.',
    '',
    '## Datasets',
    '',
    '- El CSV original (source.csv) NO está incluido en este ZIP; solo se conserva su SHA-256.',
    includesCorrectedDataset
      ? '- corrected.csv SÍ está incluido en remediation/ por decisión explícita y porque la corrida tiene ejecución Python y reauditoría verificadas.'
      : hasVerifiedExecution
        ? '- corrected.csv NO está incluido porque no se activó la opción explícita de incluir datos potencialmente personales.'
        : '- corrected.csv NO está incluido: esta corrida no completó una ejecución Python + reauditoría verificadas.',
    '- corrected.csv es el resultado de la remediación y puede conservar datos personales (PII); trátalo con el mismo cuidado que el original antes de compartirlo.',
    '',
  ].join('\n');

  if (verifiedExecution && !hasVerifiedExecution) {
    throw new Error('La evidencia de remediación no coincide con la cadena certificada del paquete técnico.');
  }
  if (technicalExport.remediationExecution.status === 'reaudited' && !verifiedExecution) {
    throw new Error('El paquete declara reauditoría, pero faltan los artefactos en memoria para construir el ZIP.');
  }

  addFile(files, 'README.md', readme, 'text/markdown', 'Guía humana y alcance de privacidad del expediente.');
  addFile(files, 'technical/aura-technical-export.json', json(technicalExport), 'application/json', 'Fuente técnica consolidada de la sesión.');
  addFile(files, 'profile/audit-report.json', json(technicalExport.profile.report), 'application/json', 'Reporte determinista original.');
  addFile(files, 'profile/audit-evidence.json', json(technicalExport.profile.auditEvidence), 'application/json', 'Trazas de carga, SHA-256 y ejecución del motor.');
  addFile(files, 'profile/deterministic-validation.json', technicalExport.deterministicValidation ? json(technicalExport.deterministicValidation) : null, 'application/json', 'Comparación contra ground truth cuando existe.');
  addFile(files, 'report/diagnostic-report.json', technicalExport.diagnosticReport ? json(technicalExport.diagnosticReport) : null, 'application/json', 'Modelo canónico usado para PDF y lectura humana.');
  addFile(files, 'report/diagnostic-report.pdf', diagnosticPdf, 'application/pdf', 'Informe diagnóstico Casabero Editorial.');
  addFile(files, 'findings/issues.csv', issuesCsv, 'text/csv', 'Hallazgos deterministas en formato tabular.');

  if (snapshot) {
    addFile(files, 'diagnosis/01-system-instruction.en.txt', snapshot.systemInstruction, 'text/plain', 'Instrucción técnica estable del contrato V2.');
    addFile(files, 'diagnosis/02-evidence-payload.json', snapshot.userPayload, 'application/json', 'Evidencia exacta entregada al modelo.');
    addFile(files, 'diagnosis/03-request-sent-once.txt', exactDiagnosisPromptV2(snapshot), 'text/plain', 'Solicitud exacta certificada por promptHash.');
    addFile(files, 'diagnosis/response-schema.json', json(snapshot.responseSchema), 'application/json', 'JSON Schema exigido a la respuesta.');
  }
  addFile(files, 'diagnosis/execution-receipt.json', diagnosis.executionReceipt ? json(diagnosis.executionReceipt) : null, 'application/json', 'Recibo de modelo, método, tiempos y hashes.');
  if (typeof diagnosis.rawResponse === 'string' && diagnosis.rawResponse.length > 0) {
    addFile(files, 'diagnosis/provider-response.raw.json', diagnosis.rawResponse, 'application/json', 'Respuesta exacta recibida del proveedor.');
  } else if (isRecord(diagnosis.structuredDiagnosis) && isRecord(diagnosis.structuredDiagnosis.diagnosis)) {
    addFile(files, 'diagnosis/provider-response.normalized.json', json(diagnosis.structuredDiagnosis.diagnosis), 'application/json', 'Respuesta estructurada normalizada; la sesión no conservó el cuerpo crudo.');
  }
  // AURA-CIERRE-DETERMINISTIC-HITL-02 — surface governance normalization
  // evidence so the technical export makes the intervention auditable.
  const normalizationEvidence = isRecord(diagnosis.structuredDiagnosis)
    ? diagnosis.structuredDiagnosis.normalizationEvidence
    : null;
  if (normalizationEvidence && normalizationEvidence.applied === true) {
    addFile(
      files,
      'diagnosis/governance-normalization.json',
      json(normalizationEvidence),
      'application/json',
      'AURA aplicó requiresHumanReview=true a los issueId indicados. La respuesta cruda del modelo y su hash se conservan sin cambios.',
    );
  }

  addFile(files, 'remediation/remediation-plan.json', script.remediationPlan ? json(script.remediationPlan) : null, 'application/json', 'Plan con decisiones humanas por acción.');
  addFile(files, 'remediation/script-contract.json', script.contract ? json(script.contract) : null, 'application/json', 'Contrato canónico del script, partición e identidad.');
  addFile(files, 'remediation/script-verification.json', script.verification ? json(script.verification) : null, 'application/json', 'Resultado de la verificación fresca del contrato.');
  addFile(
    files,
    'remediation/STATUS.md',
    `# Estado de remediación\n\nEstado: ${technicalExport.remediationExecution.status}\n\n${technicalExport.remediationExecution.limitations.join('\n')}\n`,
    'text/markdown',
    'Estado explícito de la rama opcional de remediación.',
  );
  const scriptPath = script.approvalStatus === 'approved'
    ? 'remediation/approved-script.py'
    : 'remediation/reviewed-script-unverified.py';
  const scriptDescription = script.approvalStatus === 'approved'
    ? 'Script exacto aprobado y enlazado al contrato aura.script.v2.'
    : 'Script revisado sin contrato aura.script.v2; no acredita ejecución ni procedencia contractual.';
  addFile(files, scriptPath, script.approvedScript, 'text/x-python', scriptDescription);
  addFile(files, 'activity/pipeline.log', activityLog.map((entry) => `${entry.time}\t${entry.msg}`).join('\n') + (activityLog.length ? '\n' : ''), 'text/plain', 'Secuencia local de eventos del flujo.');

  // ── Execution + reaudit artifacts (verified runs only) ──
  if (hasVerifiedExecution && verifiedExecution) {
    const reauditResult = {
      summary: verifiedExecution.reaudit.summary,
      output: verifiedExecution.reaudit.output,
      beforeReport: verifiedExecution.reaudit.beforeReport,
      afterReport: verifiedExecution.reaudit.afterReport,
    };
    addFile(files, 'remediation/execution-bundle.json', json(verifiedExecution.bundle), 'application/json', 'Bundle determinista aprobado y ejecutado en Python.');
    addFile(files, 'remediation/python-execution-receipt.json', json(verifiedExecution.receipt), 'application/json', 'Recibo criptográfico de la ejecución Python verificada.');
    addFile(files, 'remediation/verification-result.json', json(verifiedExecution.verification), 'application/json', 'Resultado canónico de verificación y clasificación antes/después.');
    addFile(files, 'remediation/reaudit-before.json', json(verifiedExecution.reaudit.beforeReport), 'application/json', 'Reporte determinista anterior a la remediación.');
    addFile(files, 'remediation/reaudit-after.json', json(verifiedExecution.reaudit.afterReport), 'application/json', 'Reporte determinista posterior a la remediación.');
    addFile(files, 'remediation/reaudit-summary.json', json(reauditResult), 'application/json', 'Resumen de reauditoría sin datos CSV crudos.');
    addFile(files, 'remediation/before-after-summary.json', json(verifiedExecution.beforeAfterSummary), 'application/json', 'Comparación score/hallazgos antes y después de la remediación.');
    if (includeCorrectedDataset) {
      addFile(files, 'remediation/corrected.csv', verifiedExecution.correctedCsv, 'text/csv', 'Dataset corregido incluido por acción explícita; puede contener PII.');
    }
    addFile(files, 'snapshots/remediation-verification.svg', buildSnapshotSvg('Remediación', 'Verificación antes / después', [
      ['Estado', verifiedExecution.verification.outcome],
      ['Score', `${verifiedExecution.verification.before.score} → ${verifiedExecution.verification.after.score}`],
      ['Hallazgos', `${verifiedExecution.verification.before.issueCount} → ${verifiedExecution.verification.after.issueCount}`],
      ['Bundle', verifiedExecution.verification.executionBundleHash],
      ['Recibo Python', verifiedExecution.verification.pythonReceiptHash],
      ['CSV corregido', verifiedExecution.verification.correctedDatasetSha256],
    ]), 'image/svg+xml', 'Vista vectorial reproducible de la verificación de remediación.');
  }

  const report = isRecord(technicalExport.diagnosticReport) ? technicalExport.diagnosticReport : null;
  const reportMetadata: Record<string, any> = report && isRecord(report.metadata) ? report.metadata : {};
  const evidenceBase: Record<string, any> = report && isRecord(report.evidenceBase) ? report.evidenceBase : {};
  const receipt: Record<string, any> = isRecord(diagnosis.executionReceipt) ? diagnosis.executionReceipt : {};
  const contract: Record<string, any> = isRecord(script.contract) ? script.contract : {};

  addFile(files, 'snapshots/diagnosis.svg', buildSnapshotSvg('Diagnóstico V2', 'Evidencia de inferencia', [
    ['Estado', diagnosis.status],
    ['Proveedor / modelo', `${receipt.provider ?? diagnosis.providerType} / ${receipt.observedModel ?? diagnosis.model}`],
    ['Método', receipt.effectiveInputMode ?? snapshot?.inputMode ?? 'n/d'],
    ['Hallazgos', isRecord(diagnosis.structuredDiagnosis) && isRecord(diagnosis.structuredDiagnosis.diagnosis) && Array.isArray(diagnosis.structuredDiagnosis.diagnosis.issues) ? diagnosis.structuredDiagnosis.diagnosis.issues.length : 0],
    ['Prompt hash', receipt.promptHash ?? diagnosis.rawResponseHash ?? 'n/d'],
    ['Receipt hash', receipt.receiptHash ?? 'n/d'],
  ]), 'image/svg+xml', 'Captura vectorial reproducible del diagnóstico.');
  addFile(files, 'snapshots/report.svg', buildSnapshotSvg('Informe', 'Resumen de evidencia', [
    ['Dataset', reportMetadata.fileName ?? technicalExport.manifest.dataset.name],
    ['Filas / columnas', `${reportMetadata.rowCount ?? technicalExport.manifest.dataset.rows} / ${reportMetadata.colCount ?? technicalExport.manifest.dataset.columns}`],
    ['Score base', reportMetadata.scoreBase ?? technicalExport.profile.report.score],
    ['Hallazgos', evidenceBase.totalIssues ?? technicalExport.profile.report.issues.length],
    ['Report ID', identity.reportId],
    ['Dataset SHA-256', identity.datasetSha256 ?? 'n/d'],
  ]), 'image/svg+xml', 'Captura vectorial reproducible del informe.');
  addFile(files, 'snapshots/script.svg', buildSnapshotSvg('Gobernanza HITL', 'Contrato de script', [
    ['Estado', script.approvalStatus],
    ['Acciones aceptadas', Array.isArray(contract.acceptedActionIds) ? contract.acceptedActionIds.length : 0],
    ['Acciones rechazadas', Array.isArray(contract.rejectedActionIds) ? contract.rejectedActionIds.length : 0],
    ['Acciones excluidas', Array.isArray(contract.excludedActionIds) ? contract.excludedActionIds.length : 0],
    ['Sintaxis Python', isRecord(contract.validationResult) && isRecord(contract.validationResult.pythonSyntax) ? contract.validationResult.pythonSyntax.state : 'n/d'],
    ['Script hash', contract.scriptHash ?? 'n/d'],
  ]), 'image/svg+xml', 'Captura vectorial reproducible de revisión y partición del script.');

  const manifestFiles: EvidenceArchiveManifestFile[] = [];
  for (const path of Object.keys(files).sort()) {
    const file = files[path];
    const content = asBytes(file.content);
    manifestFiles.push({
      path,
      mediaType: file.mediaType,
      bytes: content.byteLength,
      sha256: await sha256Bytes(content),
      description: file.description,
    });
  }

  const manifest: EvidenceArchiveManifest = {
    contractId: AURA_EVIDENCE_PACKAGE_CONTRACT,
    contractVersion: '1.0.0',
    generatedAt: technicalExport.exportContract.generatedAt,
    runId: identity.runId,
    reportId: identity.reportId,
    datasetSha256: identity.datasetSha256,
    diagnosisReceiptHash: identity.diagnosisReceiptHash,
    privacy: {
      rawDatasetIncluded: false,
      correctedDatasetIncluded: includesCorrectedDataset,
      correctedDatasetMayContainPersonalData: includesCorrectedDataset,
      note: includesCorrectedDataset
        ? 'El CSV original permanece fuera del ZIP; su identidad se verifica mediante datasetSha256. Se incluye corrected.csv de una ejecución verificada, que puede conservar datos personales (PII). El expediente puede conservar muestras visibles de la evidencia.'
        : 'El CSV original permanece fuera del ZIP; su identidad se verifica mediante datasetSha256. El expediente puede conservar muestras visibles de la evidencia.',
    },
    snapshots: {
      kind: 'reproducible_svg_evidence',
      browserScreenshots: false,
      note: 'Las vistas SVG se generan desde datos contractuales y evitan depender del estado visual del navegador.',
    },
    files: manifestFiles,
  };

  const zipped: Record<string, Uint8Array> = {};
  for (const [path, file] of Object.entries(files)) zipped[path] = asBytes(file.content);
  zipped['manifest.json'] = strToU8(json(manifest));

  const datasetName = technicalExport.manifest.dataset.name;
  return {
    filename: `aura_evidencia_${safeFilename(datasetName)}_${safeFilename(identity.runId)}.zip`,
    bytes: zipSync(zipped, { level: 6 }),
    manifest,
  };
};
