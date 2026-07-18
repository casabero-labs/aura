import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildAuraExportPackage } from '../services/exportPackage';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import {
  AURA_EVIDENCE_PACKAGE_CONTRACT,
  buildEvidenceArchive,
  type EvidenceArchiveManifest,
} from '../services/evidenceArchive';
import {
  buildPythonExecutionBundle,
  buildPythonExecutionReceipt,
} from '../services/remediationExecution/pythonExecutionContract';
import { buildVerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import type { VerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import { sha256hex, sha256BytesHex } from '../contracts/llm/hash';
import type { AuditReport } from '../types';

const report: AuditReport = {
  score: 74,
  rowCount: 15,
  colCount: 2,
  duplicateRows: 1,
  issues: [],
  columnStats: {},
  scoreBreakdown: [],
  delimiterDetected: ',',
};

const buildTechnicalExport = () => buildAuraExportPackage({
  manifest: buildEvidenceManifest({ auditEvidence: null, benchmarkResults: [] }),
  profile: { report, auditEvidence: null },
  deterministicValidation: null,
  diagnosticReport: null,
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
    rawResponse: null,
  },
  script: {
    generatedScript: '',
    scriptValidation: null,
    approvedScript: '',
  },
  benchmarkResults: [],
  improvementRun: null,
});

const APPROVED_SCRIPT = 'import pandas as pd\n\ndef clean_dataset(df):\n    return df\n';
const SCRIPT_HASH = sha256hex(JSON.stringify({ scriptText: APPROVED_SCRIPT }));
const BEFORE_CSV = 'id,name,email\n1,John,not_an_email\n2,Jane,jane@example.com\n';
const AFTER_CSV = 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com\n';
const ENVELOPE_REF = 'env:' + 'c'.repeat(64);
const encode = (text: string) => new TextEncoder().encode(text);
const BEFORE_BYTES = encode(BEFORE_CSV);
const AFTER_BYTES = encode(AFTER_CSV);
const FINGERPRINT = sha256BytesHex(BEFORE_BYTES);

const buildApprovedTechnicalExport = (includedInEvidenceArchive = false) => {
  const technicalExport = buildTechnicalExport() as any;
  const evidence = buildVerifiedEvidence();
  technicalExport.script = {
    generatedScript: APPROVED_SCRIPT,
    scriptValidation: null,
    approvedScript: APPROVED_SCRIPT,
    remediationPlan: { planId: 'plan-1', plan: [] },
    contract: {
      acceptedActionIds: [], rejectedActionIds: [], excludedActionIds: [],
      scriptHash: SCRIPT_HASH,
    },
    verification: { valid: true, errors: [] },
    approvalStatus: 'approved',
  };
  technicalExport.artifactIdentity.datasetSha256 = evidence.bundle.beforeDatasetSha256;
  technicalExport.artifactIdentity.diagnosisReceiptHash = evidence.bundle.inputReceiptRef;
  technicalExport.remediationExecution = {
    status: 'reaudited',
    executionBundle: evidence.bundle,
    pythonReceipt: evidence.receipt,
    verification: evidence.verification,
    correctedDataset: {
      sha256: evidence.verification.correctedDatasetSha256,
      rowCount: evidence.verification.after.rowCount,
      columnCount: evidence.verification.after.columnCount,
      includedInEvidenceArchive,
    },
    limitations: evidence.verification.limitations,
  };
  return technicalExport;
};

const buildVerifiedEvidence = (): VerifiedRemediationEvidence => {
  const bundle = buildPythonExecutionBundle({
    generatedAt: '2026-07-13T12:00:00.000Z',
    executionId: 'run:verified',
    approvedScriptHash: SCRIPT_HASH,
    beforeDatasetSha256: FINGERPRINT,
    scriptText: APPROVED_SCRIPT,
    scriptHashPayload: { scriptText: APPROVED_SCRIPT },
    inputReceiptRef: 'b'.repeat(64),
    evidenceEnvelopeRef: ENVELOPE_REF,
  });
  const receipt = buildPythonExecutionReceipt({
    contractId: 'aura.python-execution-receipt.v1',
    contractVersion: '1.0.0',
    runId: bundle.runId,
    approvedScriptHash: bundle.approvedScriptHash,
    scriptTextSha256: bundle.scriptTextSha256,
    beforeDatasetSha256: bundle.beforeDatasetSha256,
    afterDatasetSha256: sha256BytesHex(AFTER_BYTES),
    pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'darwin',
    bundleHash: bundle.bundleHash,
    inputReceiptRef: bundle.inputReceiptRef,
    evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
    syntax: { status: 'passed', error: null },
    execution: {
      status: 'passed', startedAt: '2026-07-13T12:01:00.000Z', completedAt: '2026-07-13T12:01:01.000Z',
      durationMs: 1000, stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
    },
    output: { rowCount: 2, columnCount: 3 },
  });
  return buildVerifiedRemediationEvidence({
    bundle,
    receipt,
    sourceCsv: BEFORE_BYTES,
    correctedCsv: AFTER_BYTES,
    evidenceEnvelopeRef: ENVELOPE_REF,
  });
};

describe('buildEvidenceArchive', () => {
  it('consolida el expediente sin incluir el dataset original', async () => {
    const result = await buildEvidenceArchive({
      technicalExport: buildTechnicalExport(),
      issuesCsv: 'id,ruleId\nissue-1,rule:test\n',
      diagnosticPdf: new Uint8Array([37, 80, 68, 70]),
      activityLog: [{ time: '10:00:00', msg: 'Diagnóstico completado' }],
    });
    const files = unzipSync(result.bytes);
    const paths = Object.keys(files).sort();
    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as EvidenceArchiveManifest;

    expect(result.filename).toMatch(/^aura_evidencia_.*\.zip$/);
    expect(paths).toEqual(expect.arrayContaining([
      'README.md',
      'manifest.json',
      'technical/aura-technical-export.json',
      'profile/audit-report.json',
      'report/diagnostic-report.pdf',
      'findings/issues.csv',
      'activity/pipeline.log',
      'snapshots/diagnosis.svg',
      'snapshots/report.svg',
      'snapshots/script.svg',
    ]));
    expect(paths.some(path => /source\.csv|raw.*\.csv|dataset.*\.csv/i.test(path))).toBe(false);
    expect(manifest.contractId).toBe(AURA_EVIDENCE_PACKAGE_CONTRACT);
    expect(manifest.privacy.rawDatasetIncluded).toBe(false);
    expect(manifest.snapshots.browserScreenshots).toBe(false);
    expect(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(manifest.files.some(file => file.path === 'report/diagnostic-report.pdf')).toBe(true);
    expect(strFromU8(files['README.md'])).toContain('No incluye el CSV original');
  });

  it('un paquete diagnóstico sin remediación no incluye execution/* y declara que no hubo ejecución', async () => {
    const result = await buildEvidenceArchive({
      technicalExport: buildTechnicalExport(),
      issuesCsv: 'id,ruleId\nissue-1,rule:test\n',
    });
    const files = unzipSync(result.bytes);
    const paths = Object.keys(files);
    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as EvidenceArchiveManifest;

    expect(paths).toContain('remediation/STATUS.md');
    expect(paths).not.toContain('remediation/corrected.csv');
    expect(manifest.privacy.correctedDatasetIncluded).toBe(false);
    expect(manifest.privacy.correctedDatasetMayContainPersonalData).toBe(false);
    expect(strFromU8(files['README.md'])).toContain('corrected.csv NO está incluido');
    // Diagnostic-only package is still a valid expediente.
    expect(manifest.contractId).toBe(AURA_EVIDENCE_PACKAGE_CONTRACT);
    expect(manifest.files.some(file => file.path === 'findings/issues.csv')).toBe(true);
  });

  it('incluye respuesta exacta y gobierno de remediación cuando están disponibles', async () => {
    const technicalExport = buildTechnicalExport() as any;
    technicalExport.diagnosis.status = 'valid';
    technicalExport.diagnosis.rawResponse = '{"contractId":"aura.diagnosis.v2"}';
    technicalExport.diagnosis.executionReceipt = { receiptHash: 'receipt-1' };
    technicalExport.script = {
      generatedScript: 'print("ok")\n',
      scriptValidation: null,
      approvedScript: 'print("ok")\n',
      remediationPlan: { planId: 'plan-1', plan: [] },
      contract: {
        acceptedActionIds: [], rejectedActionIds: [], excludedActionIds: [],
        scriptHash: 'script-hash',
      },
      verification: { valid: true, errors: [] },
      approvalStatus: 'approved',
    };

    const result = await buildEvidenceArchive({
      technicalExport,
      issuesCsv: 'id\n',
    });
    const files = unzipSync(result.bytes);

    expect(strFromU8(files['diagnosis/provider-response.raw.json'])).toBe('{"contractId":"aura.diagnosis.v2"}');
    expect(files).toHaveProperty('remediation/remediation-plan.json');
    expect(files).toHaveProperty('remediation/script-contract.json');
    expect(files).toHaveProperty('remediation/script-verification.json');
    expect(strFromU8(files['remediation/approved-script.py'])).toBe('print("ok")\n');
  });

  describe('verified execution + reaudit artifacts', () => {
    it('incluye los seis artefactos obligatorios de una corrida verificada', async () => {
      const result = await buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(),
        issuesCsv: 'id\n',
        verifiedExecution: buildVerifiedEvidence(),
      });
      const files = unzipSync(result.bytes);

      expect(files).toHaveProperty('remediation/approved-script.py');
      expect(files).toHaveProperty('remediation/execution-bundle.json');
      expect(files).toHaveProperty('remediation/python-execution-receipt.json');
      expect(files).toHaveProperty('remediation/verification-result.json');
      expect(files).toHaveProperty('remediation/reaudit-before.json');
      expect(files).toHaveProperty('remediation/reaudit-after.json');
      expect(files).toHaveProperty('snapshots/remediation-verification.svg');
      expect(files).not.toHaveProperty('remediation/corrected.csv');
    });

    it('corrected.csv conserva los bytes exactos', async () => {
      const result = await buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(true),
        issuesCsv: 'id\n',
        verifiedExecution: buildVerifiedEvidence(),
        includeCorrectedDataset: true,
      });
      const files = unzipSync(result.bytes);
      expect(files['remediation/corrected.csv']).toEqual(AFTER_BYTES);
      expect(strFromU8(files['remediation/corrected.csv'])).toBe(AFTER_CSV);
    });

    it('manifest registra tamaño y SHA-256 correctos de corrected.csv', async () => {
      const result = await buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(true),
        issuesCsv: 'id\n',
        verifiedExecution: buildVerifiedEvidence(),
        includeCorrectedDataset: true,
      });
      const files = unzipSync(result.bytes);
      const manifest = JSON.parse(strFromU8(files['manifest.json'])) as EvidenceArchiveManifest;
      const entry = manifest.files.find(file => file.path === 'remediation/corrected.csv');

      expect(entry).toBeDefined();
      expect(entry!.bytes).toBe(AFTER_BYTES.byteLength);
      expect(entry!.sha256).toBe(sha256BytesHex(AFTER_BYTES));
      expect(manifest.privacy.correctedDatasetIncluded).toBe(true);
      expect(manifest.privacy.correctedDatasetMayContainPersonalData).toBe(true);
    });

    it('nunca incluye source.csv ni el dataset original en una corrida verificada', async () => {
      const result = await buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(true),
        issuesCsv: 'id\n',
        verifiedExecution: buildVerifiedEvidence(),
        includeCorrectedDataset: true,
      });
      const files = unzipSync(result.bytes);
      const paths = Object.keys(files);

      expect(paths).not.toContain('source.csv');
      expect(paths).not.toContain('remediation/source.csv');
      expect(paths.some(path => /source\.csv|raw.*\.csv|dataset.*\.csv/i.test(path))).toBe(false);
      // corrected.csv must not carry the original before-remediation bytes.
      expect(strFromU8(files['remediation/corrected.csv'])).not.toBe(BEFORE_CSV);
    });

    it('reaudit-result.json solo contiene summary/output/beforeReport/afterReport sin datos crudos', async () => {
      const result = await buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(),
        issuesCsv: 'id\n',
        verifiedExecution: buildVerifiedEvidence(),
      });
      const files = unzipSync(result.bytes);
      const raw = strFromU8(files['remediation/reaudit-summary.json']);
      const parsed = JSON.parse(raw);

      expect(Object.keys(parsed).sort()).toEqual(['afterReport', 'beforeReport', 'output', 'summary']);
      expect(parsed).not.toHaveProperty('beforeOutput');
      expect(parsed).not.toHaveProperty('afterOutput');
      expect(raw).not.toContain('rawCsv');
      expect(raw).not.toContain('beforeOutput');
      expect(raw).not.toContain('afterOutput');
    });

    it('una ejecución incompleta falla cerrado sin construir el ZIP', async () => {
      const incomplete = buildVerifiedEvidence();
      // Drop the corrected CSV bytes → run is no longer verifiable.
      const tampered = { ...incomplete, correctedCsv: new Uint8Array(0) } as VerifiedRemediationEvidence;

      await expect(buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(), issuesCsv: 'id\n',
        verifiedExecution: tampered,
      })).rejects.toThrow('no coincide con la cadena certificada');
    });

    it('cada entrada del manifest coincide en bytes y SHA-256 con el ZIP', async () => {
      const result = await buildEvidenceArchive({
        technicalExport: buildApprovedTechnicalExport(true), issuesCsv: 'id\n',
        verifiedExecution: buildVerifiedEvidence(), includeCorrectedDataset: true,
      });
      const files = unzipSync(result.bytes);
      for (const entry of result.manifest.files) {
        expect(files[entry.path], entry.path).toBeDefined();
        expect(files[entry.path].byteLength, entry.path).toBe(entry.bytes);
        expect(sha256BytesHex(files[entry.path]), entry.path).toBe(entry.sha256);
      }
    });

    it('provider-response.normalized.json no aparece duplicado en el manifest', async () => {
      const technicalExport = buildTechnicalExport() as any;
      technicalExport.diagnosis.structuredDiagnosis = { diagnosis: { contractId: 'aura.diagnosis.v2' } };
      const result = await buildEvidenceArchive({ technicalExport, issuesCsv: 'id\n' });
      expect(result.manifest.files.filter(file => file.path === 'diagnosis/provider-response.normalized.json')).toHaveLength(1);
    });
  });

  describe('governance normalization artifact', () => {
    it('includes diagnosis/governance-normalization.json when normalization applied', async () => {
      const technicalExport = buildTechnicalExport() as any;
      technicalExport.diagnosis.status = 'valid';
      technicalExport.diagnosis.rawResponse = '{"contractId":"aura.diagnosis.v2","raw":true}';
      technicalExport.diagnosis.executionReceipt = {
        receiptHash: 'receipt-test',
        rawResponseHash: 'raw-hash',
      };
      technicalExport.diagnosis.structuredDiagnosis = {
        normalizationEvidence: {
          applied: true,
          field: 'requiresHumanReview',
          reason: 'AURA_GOVERNANCE_ENFORCED',
          policy: 'aura.human-review-policy.v2',
          policyVersion: '1.0.0',
          normalizedIssueIds: ['integrity-dupes', 'hygiene-ghost-Name'],
          originalValuesByIssueId: { 'integrity-dupes': false, 'hygiene-ghost-Name': false },
          effectiveValuesByIssueId: { 'integrity-dupes': true, 'hygiene-ghost-Name': true },
        },
      };

      const result = await buildEvidenceArchive({
        technicalExport,
        issuesCsv: 'id\n',
      });
      const files = unzipSync(result.bytes);

      expect(files).toHaveProperty('diagnosis/governance-normalization.json');
      const parsed = JSON.parse(strFromU8(files['diagnosis/governance-normalization.json']));
      expect(parsed.applied).toBe(true);
      expect(parsed.field).toBe('requiresHumanReview');
      expect(parsed.reason).toBe('AURA_GOVERNANCE_ENFORCED');
      expect(parsed.policy).toBe('aura.human-review-policy.v2');
      expect(parsed.policyVersion).toBe('1.0.0');
      expect(parsed.normalizedIssueIds).toEqual(['integrity-dupes', 'hygiene-ghost-Name']);
      expect(parsed.originalValuesByIssueId).toEqual({ 'integrity-dupes': false, 'hygiene-ghost-Name': false });
      expect(parsed.effectiveValuesByIssueId).toEqual({ 'integrity-dupes': true, 'hygiene-ghost-Name': true });
    });

    it('provider-response.raw.json remains unchanged when normalization is applied', async () => {
      const rawBody = '{"contractId":"aura.diagnosis.v2","raw":true}';
      const technicalExport = buildTechnicalExport() as any;
      technicalExport.diagnosis.status = 'valid';
      technicalExport.diagnosis.rawResponse = rawBody;
      technicalExport.diagnosis.executionReceipt = {
        receiptHash: 'receipt-test',
        rawResponseHash: 'r'.repeat(64),
      };
      technicalExport.diagnosis.structuredDiagnosis = {
        diagnosis: { contractId: 'aura.diagnosis.v2' },
        normalizationEvidence: {
          applied: true,
          field: 'requiresHumanReview',
          reason: 'AURA_GOVERNANCE_ENFORCED',
          policy: 'aura.human-review-policy.v2',
          policyVersion: '1.0.0',
          normalizedIssueIds: ['is-1'],
          originalValuesByIssueId: { 'is-1': false },
          effectiveValuesByIssueId: { 'is-1': true },
        },
      };

      const result = await buildEvidenceArchive({
        technicalExport,
        issuesCsv: 'id\n',
      });
      const files = unzipSync(result.bytes);

      expect(files).toHaveProperty('diagnosis/provider-response.raw.json');
      expect(strFromU8(files['diagnosis/provider-response.raw.json'])).toBe(rawBody);
    });

    it('rawResponseHash in receipt matches the raw provider response', async () => {
      const rawBody = '{"contractId":"aura.diagnosis.v2","raw":true}';
      const technicalExport = buildTechnicalExport() as any;
      technicalExport.diagnosis.status = 'valid';
      technicalExport.diagnosis.rawResponse = rawBody;
      technicalExport.diagnosis.executionReceipt = {
        receiptHash: 'receipt-test',
        rawResponseHash: sha256hex(rawBody),
      };
      technicalExport.diagnosis.structuredDiagnosis = {
        normalizationEvidence: {
          applied: true,
          field: 'requiresHumanReview',
          reason: 'AURA_GOVERNANCE_ENFORCED',
          policy: 'aura.human-review-policy.v2',
          policyVersion: '1.0.0',
          normalizedIssueIds: ['is-1'],
          originalValuesByIssueId: { 'is-1': false },
          effectiveValuesByIssueId: { 'is-1': true },
        },
      };

      const result = await buildEvidenceArchive({
        technicalExport,
        issuesCsv: 'id\n',
      });
      const files = unzipSync(result.bytes);
      const manifest = JSON.parse(strFromU8(files['manifest.json'])) as EvidenceArchiveManifest;

      const rawFile = manifest.files.find(f => f.path === 'diagnosis/provider-response.raw.json');
      expect(rawFile).toBeDefined();
      expect(rawFile!.sha256).toBe(sha256hex(rawBody));
    });

    it('no source CSV is added to the ZIP when normalization is applied', async () => {
      const technicalExport = buildTechnicalExport() as any;
      technicalExport.diagnosis.status = 'valid';
      technicalExport.diagnosis.rawResponse = '{}';
      technicalExport.diagnosis.executionReceipt = { receiptHash: 'receipt-test' };
      technicalExport.diagnosis.structuredDiagnosis = {
        normalizationEvidence: {
          applied: true,
          field: 'requiresHumanReview',
          reason: 'AURA_GOVERNANCE_ENFORCED',
          policy: 'aura.human-review-policy.v2',
          policyVersion: '1.0.0',
          normalizedIssueIds: ['is-1'],
          originalValuesByIssueId: { 'is-1': false },
          effectiveValuesByIssueId: { 'is-1': true },
        },
      };

      const result = await buildEvidenceArchive({
        technicalExport,
        issuesCsv: 'id\n',
      });
      const files = unzipSync(result.bytes);
      const paths = Object.keys(files);

      expect(paths.some(path => /source\.csv|raw.*\.csv|dataset.*\.csv/i.test(path))).toBe(false);
    });

    it('an execution without normalization does not invent governance-normalization.json', async () => {
      const technicalExport = buildTechnicalExport() as any;
      technicalExport.diagnosis.status = 'valid';
      technicalExport.diagnosis.rawResponse = '{}';
      technicalExport.diagnosis.executionReceipt = { receiptHash: 'receipt-test' };
      technicalExport.diagnosis.structuredDiagnosis = {
        normalizationEvidence: {
          applied: false,
          field: 'requiresHumanReview',
          reason: 'AURA_GOVERNANCE_ENFORCED',
          policy: 'aura.human-review-policy.v2',
          policyVersion: '1.0.0',
          normalizedIssueIds: [],
          originalValuesByIssueId: {},
          effectiveValuesByIssueId: {},
        },
      };

      const result = await buildEvidenceArchive({
        technicalExport,
        issuesCsv: 'id\n',
      });
      const files = unzipSync(result.bytes);

      expect(files).not.toHaveProperty('diagnosis/governance-normalization.json');
    });
  });
});
