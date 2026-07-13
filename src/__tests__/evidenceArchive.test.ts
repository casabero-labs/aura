import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildAuraExportPackage } from '../services/exportPackage';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import {
  AURA_EVIDENCE_PACKAGE_CONTRACT,
  buildEvidenceArchive,
  type EvidenceArchiveManifest,
} from '../services/evidenceArchive';
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
});
