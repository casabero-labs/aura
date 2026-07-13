import { describe, expect, it } from 'vitest';
import { buildDiagnosticReport } from '../services/diagnosticReport';
import { AuditExecutionEvidence, AuditReport, IssueCategory, IssueSeverity, QualityIssue } from '../types';
import type { DiagnosisExecutionResult } from '../contracts/llm';

const issue = (overrides: Partial<QualityIssue>): QualityIssue => ({
  id: 'issue-default',
  column: 'Age',
  ruleId: 'rule:null-values',
  ruleName: 'Valores nulos',
  category: IssueCategory.INTEGRITY,
  description: 'Valores ausentes detectados.',
  severity: IssueSeverity.WARNING,
  count: 1,
  affectedPercentage: 1,
  sampleValues: [null],
  automaticAuthorization: {
    actionType: 'inspect_missingness',
    authorized: false,
    conditionsMet: [],
    reason: 'Los nulos requieren interpretacion de dominio.',
  },
  ...overrides,
});

const buildTitanicReport = (): AuditReport => ({
  score: 72,
  rowCount: 891,
  colCount: 12,
  duplicateRows: 0,
  delimiterDetected: ',',
  scoreBreakdown: [],
  issues: [
    issue({
      id: 'issue-null-cabin',
      column: 'Cabin',
      severity: IssueSeverity.CRITICAL,
      count: 687,
      affectedPercentage: 77.1,
      description: 'Cabin tiene una proporcion alta de valores nulos.',
    }),
    issue({
      id: 'issue-null-age',
      column: 'Age',
      severity: IssueSeverity.WARNING,
      count: 177,
      affectedPercentage: 19.87,
      description: 'Age tiene valores ausentes que requieren inspeccion antes de imputar.',
    }),
    issue({
      id: 'issue-outlier-fare',
      column: 'Fare',
      ruleId: 'rule:mild-outliers',
      ruleName: 'Outliers leves',
      category: IssueCategory.TYPES,
      description: 'Fare tiene valores altos detectados como outliers leves.',
      severity: IssueSeverity.WARNING,
      count: 9,
      affectedPercentage: 1.01,
      sampleValues: [512.3292],
      automaticAuthorization: {
        actionType: 'review_outlier',
        authorized: false,
        conditionsMet: [],
        reason: 'Los outliers monetarios pueden ser validos.',
      },
    }),
  ],
  columnStats: {
    PassengerId: {
      name: 'PassengerId',
      inferredType: 'number',
      semanticType: 'uuid',
      nullCount: 0,
      uniqueCount: 891,
    },
    Name: {
      name: 'Name',
      inferredType: 'string',
      semanticType: 'string',
      nullCount: 0,
      uniqueCount: 891,
    },
    Ticket: {
      name: 'Ticket',
      inferredType: 'string',
      semanticType: 'string',
      nullCount: 0,
      uniqueCount: 681,
    },
    Age: {
      name: 'Age',
      inferredType: 'number',
      semanticType: 'number',
      nullCount: 177,
      uniqueCount: 88,
      mean: 29.7,
      median: 28,
      q1: 20,
      q3: 38,
      iqr: 18,
    },
    Cabin: {
      name: 'Cabin',
      inferredType: 'string',
      semanticType: 'string',
      nullCount: 687,
      uniqueCount: 148,
    },
    Fare: {
      name: 'Fare',
      inferredType: 'number',
      semanticType: 'currency',
      nullCount: 0,
      uniqueCount: 248,
      mean: 32.2,
      median: 14.45,
      q1: 7.91,
      q3: 31,
      iqr: 23.09,
      lowerFence: -26.72,
      upperFence: 65.63,
      outlierCount: 9,
      outlierSeverity: 'WARNING',
    },
  },
});

const auditEvidence: AuditExecutionEvidence = {
  id: 'audit-titanic',
  fileName: 'titanic.csv',
  fileSize: 61194,
  datasetFingerprint: 'titanic-891x12',
  startedAt: '2026-07-07T10:00:00.000Z',
  completedAt: '2026-07-07T10:00:01.000Z',
  parseDurationMs: 250,
  auditDurationMs: 400,
  totalDurationMs: 650,
  rowsProcessed: 891,
  columnsProcessed: 12,
  delimiter: ',',
  truncated: false,
  ingestionStatus: 'success',
  issueCount: 3,
  score: 72,
  trace: [],
};

const structuredDiagnosis: DiagnosisExecutionResult = {
  version: 2,
  evidenceEnvelopeRef: 'env-titanic',
  promptHash: 'prompt-hash-1',
  promptVersion: 'diagnosis-v2-test',
  rawResponseHash: 'raw-hash-1',
  inputMode: 'recommended',
  inputHash: 'input-hash-1',
  executionReceipt: {
    receiptHash: 'receipt-input-1', completedAt: '2026-07-07T10:00:02.000Z', validationStatus: 'valid',
  } as unknown as NonNullable<DiagnosisExecutionResult['executionReceipt']>,
  metrics: {
    latencyMs: 1234,
    tokensGenerated: 321,
    firstTokenMs: 150,
    model: 'qwen2.5:3b',
    provider: 'ollama',
    isLocal: true,
  },
  diagnosis: {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: 'env-titanic',
    responseId: 'diag-titanic',
    generatedAt: '2026-07-07T10:00:02.000Z',
    limitations: ['No se reviso contexto historico del dataset.'],
    issues: [
      {
        issueId: 'issue-null-age',
        evidenceRefs: ['ev-age-null'],
        hypothesis: 'Age puede faltar por patron de captura.',
        confidence: 0.74,
        requiresHumanReview: true,
        limits: ['No inferir causa sin dominio.'],
      },
    ],
    diagnosisBlocks: [
      {
        issueId: 'issue-null-age',
        ruleId: 'rule:null-values',
        columnId: 'Age',
        scope: 'column',
        observation: 'Age concentra valores ausentes que pueden sesgar analisis por edad.',
        recommendation: 'Inspeccionar patron de ausencia antes de imputar.',
      },
    ],
  },
  remediationContext: {
    evidenceEnvelopeRef: 'env-titanic',
    datasetFingerprint: 'titanic-891x12',
    columns: [],
    issues: [],
  },
};

describe('buildDiagnosticReport', () => {
  it('keeps documented deterministic false positives out of confirmed risks', () => {
    const report = buildTitanicReport();
    const falsePositiveIssue = report.issues[0];
    const diagnosticReport = buildDiagnosticReport({
      report,
      auditEvidence: null,
      deterministicValidation: {
        datasetName: 'fixture.csv',
        groundTruthMatched: true,
        perRuleMetrics: [{
          ruleId: falsePositiveIssue.id,
          ruleName: falsePositiveIssue.ruleName,
          category: falsePositiveIssue.category,
          tp: 0,
          fp: 1,
          fn: 0,
          precision: 0,
          recall: 1,
          f1: 0,
          expectedTP: 0,
          actualDetected: falsePositiveIssue.count,
          status: 'expected_fp',
        }],
        summary: {
          totalTP: 0,
          totalFP: 1,
          totalFN: 0,
          macroPrecision: 0,
          macroRecall: 1,
          macroF1: 0,
          rulesMatched: 0,
          rulesPartial: 0,
          rulesMissed: 0,
          rulesUnexpectedFP: 0,
        },
      },
    });

    expect(diagnosticReport.findingGroups.confirmedRisks
      .some((finding) => finding.sourceIssueIds.includes(falsePositiveIssue.id))).toBe(false);
    expect(diagnosticReport.findingGroups.possibleFalsePositiveCandidates
      .some((finding) => finding.sourceIssueIds.includes(falsePositiveIssue.id))).toBe(true);
  });

  it('construye reporte con solo AuditReport', () => {
    const report = buildTitanicReport();
    const diagnosticReport = buildDiagnosticReport({ report, auditEvidence: null });

    expect(diagnosticReport.metadata.rowCount).toBe(891);
    expect(diagnosticReport.metadata.colCount).toBe(12);
    expect(diagnosticReport.status.diagnosticStatus).toBe('deterministic_only');
    expect(diagnosticReport.diagnosisSummary.source).toBe('unavailable');
    expect(diagnosticReport.diagnosisSummary.limitations.join(' ')).toContain('evidencia determinista');
  });

  it('scoreModified siempre es false', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis,
    });

    expect(diagnosticReport.metadata.scoreModified).toBe(false);
    expect(diagnosticReport.findingGroups.confirmedRisks.every((finding) => finding.scoreModified === false)).toBe(true);
    expect(diagnosticReport.findingGroups.possibleFalsePositiveCandidates.every((finding) => finding.scoreModified === false)).toBe(true);
  });

  it('PDF ready es true sin script', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence: null,
    });

    expect(diagnosticReport.exportReadiness.pdfReady).toBe(true);
    expect(diagnosticReport.exportReadiness.scriptExportsReady).toBe(false);
  });

  it('scriptRequired es false', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
    });

    expect(diagnosticReport.status.scriptRequired).toBe(false);
  });

  it('HITL no bloquea el reporte principal', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis,
    });

    expect(diagnosticReport.status.hitlRequiredForMainReport).toBe(false);
    expect(diagnosticReport.exportReadiness.pdfReady).toBe(true);
  });

  it('integra structuredDiagnosis cuando existe', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis,
    });

    expect(diagnosticReport.status.diagnosticStatus).toBe('llm_diagnosis_available');
    expect(diagnosticReport.diagnosisSummary.source).toBe('structured_v2');
    expect(diagnosticReport.diagnosisSummary.provider).toBe('ollama');
    expect(diagnosticReport.diagnosisSummary.model).toBe('qwen2.5:3b');
    expect(diagnosticReport.diagnosisSummary.evidenceEnvelopeRef).toBe('env-titanic');
    expect(diagnosticReport.diagnosisSummary.inputReceiptRef).toBe('receipt-input-1');
    expect(diagnosticReport.diagnosisSummary).toEqual(expect.objectContaining({
      inputMode: 'recommended', inputHash: 'input-hash-1',
      executionCompletedAt: '2026-07-07T10:00:02.000Z', executionValidationStatus: 'valid',
    }));
    expect(diagnosticReport.diagnosisSummary.executionReceipt?.receiptHash).toBe('receipt-input-1');
    expect(diagnosticReport.diagnosisSummary.observations[0].sourceIssueId).toBe('issue-null-age');
    expect(diagnosticReport.findingGroups.confirmedRisks
      .find((finding) => finding.sourceIssueIds.includes('issue-null-age'))
      ?.contextualInterpretation).toContain('Age concentra valores ausentes');
  });

  it('usa fecha e identidad del recibo y no valores inventados por el modelo', () => {
    const first = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis,
    });
    const modelTampered: DiagnosisExecutionResult = {
      ...structuredDiagnosis,
      diagnosis: {
        ...structuredDiagnosis.diagnosis,
        responseId: 'response:1234567890abcdef',
        generatedAt: '2023-09-25T12:00:00.000Z',
      },
    };
    const second = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis: modelTampered,
    });

    expect(second.metadata.generatedAt).toBe('2026-07-07T10:00:02.000Z');
    expect(second.metadata.reportId).toBe(first.metadata.reportId);
  });

  it('usa aiAnalysis legacy cuando no hay structuredDiagnosis', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      aiAnalysis: 'El dataset tiene nulos importantes en Age. Fare requiere revisar contexto antes de recortar valores altos.',
    });

    expect(diagnosticReport.status.diagnosticStatus).toBe('llm_diagnosis_available');
    expect(diagnosticReport.diagnosisSummary.source).toBe('legacy_text');
    expect(diagnosticReport.diagnosisSummary.executiveSummary).toContain('Age');
    expect(diagnosticReport.diagnosisSummary.observations.length).toBeGreaterThan(0);
  });

  it('cura markdown crudo en diagnósticos legacy antes de presentarlo', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      aiAnalysis: [
        '## Estado de ejecución',
        'Análisis completo del registro técnico.',
        '* **Regla:** Valores nulos **Columna:** Age **Riesgo:** Sesgo analítico.',
      ].join('\n'),
    });

    expect(diagnosticReport.diagnosisSummary.executiveSummary).toContain('AURA consolidó');
    expect(diagnosticReport.diagnosisSummary.executiveSummary).not.toContain('##');
    expect(diagnosticReport.diagnosisSummary.executiveSummary).not.toContain('**');
    expect(diagnosticReport.diagnosisSummary.observations.map((observation) => observation.text).join(' ')).not.toContain('**');
  });

  it('genera chartSpecs serializables', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
    });

    expect(() => JSON.stringify(diagnosticReport.chartSpecs)).not.toThrow();
    expect(diagnosticReport.chartSpecs.map((chart) => chart.id)).toEqual([
      'severity_counts',
      'category_counts',
      'column_type_counts',
      'top_null_columns',
      'top_affected_issues',
      'top_cardinality_columns',
    ]);
    expect(diagnosticReport.chartSpecs.every((chart) => Array.isArray(chart.data))).toBe(true);
  });

  it('usa la decision LLM para seleccionar graficas del PDF cuando visualizations existe', () => {
    const diagnosisWithVisualization: DiagnosisExecutionResult = {
      ...structuredDiagnosis,
      diagnosis: {
        ...structuredDiagnosis.diagnosis,
        visualizations: [
          {
            visualizationId: 'missingness-focus',
            includeInPdf: true,
            dataSource: 'top_null_columns',
            kind: 'horizontal_bar',
            title: 'Ausencia prioritaria',
            rationale: 'La ausencia domina el diagnostico y debe verse en el PDF.',
            issueIds: ['issue-null-age'],
          },
          {
            visualizationId: 'unused-category-chart',
            includeInPdf: false,
            dataSource: 'category_counts',
            kind: 'bar',
            title: 'Categoria no necesaria',
            rationale: 'No aporta mas claridad ejecutiva.',
            issueIds: [],
          },
        ],
      },
    };

    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis: diagnosisWithVisualization,
    });

    expect(diagnosticReport.chartSpecs).toHaveLength(1);
    expect(diagnosticReport.chartSpecs[0]).toMatchObject({
      id: 'diagnosis_missingness-focus',
      title: 'Ausencia prioritaria',
      kind: 'horizontal_bar',
      source: 'diagnosis',
      xKey: 'nullPercentage',
      yKey: 'column',
    });
    expect(diagnosticReport.chartSpecs[0].data[0]).toHaveProperty('column', 'Cabin');
    expect(diagnosticReport.chartSpecs[0].notes?.join(' ')).toContain('Seleccionada por diagnóstico asistido');
  });

  it('respeta visualizations vacio como decision de no incluir graficas asistidas', () => {
    const diagnosisWithoutCharts: DiagnosisExecutionResult = {
      ...structuredDiagnosis,
      diagnosis: {
        ...structuredDiagnosis.diagnosis,
        visualizations: [],
      },
    };

    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
      structuredDiagnosis: diagnosisWithoutCharts,
    });

    expect(diagnosticReport.chartSpecs).toEqual([]);
  });

  it('ordena topNullColumns correctamente', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
    });

    expect(diagnosticReport.evidenceBase.topNullColumns.map((column) => column.column)).toEqual([
      'Cabin',
      'Age',
    ]);
    expect(diagnosticReport.evidenceBase.topNullColumns[0].nullPercentage).toBeGreaterThan(
      diagnosticReport.evidenceBase.topNullColumns[1].nullPercentage,
    );
  });

  it('ordena topIssues por severidad y affectedPercentage', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
    });

    expect(diagnosticReport.evidenceBase.topIssues.map((topIssue) => topIssue.id)).toEqual([
      'issue-null-cabin',
      'issue-null-age',
      'issue-outlier-fare',
    ]);
  });

  it('marca Fare outlier como possibleFalsePositiveCandidate en fixture tipo Titanic', () => {
    const diagnosticReport = buildDiagnosticReport({
      report: buildTitanicReport(),
      auditEvidence,
    });

    const fareCandidate = diagnosticReport.findingGroups.possibleFalsePositiveCandidates.find((finding) =>
      finding.columns.includes('Fare'),
    );

    expect(fareCandidate).toBeDefined();
    expect(fareCandidate!.contextualInterpretation).toContain('posible falso positivo contextual');
    expect(fareCandidate!.contextualInterpretation).toContain('requiere revisión humana');
    expect(fareCandidate!.contextualInterpretation).toContain('no modifica score');
    expect(fareCandidate!.contextualInterpretation).toContain('no corregir automáticamente');
    expect(fareCandidate!.requiresHumanReview).toBe(true);
    expect(fareCandidate!.canGenerateScript).toBe(false);
  });

  it('no muta el AuditReport original', () => {
    const report = buildTitanicReport();
    const before = JSON.parse(JSON.stringify(report));

    buildDiagnosticReport({
      report,
      auditEvidence,
      structuredDiagnosis,
      aiAnalysis: 'Texto legacy que no debe modificar el reporte original.',
    });

    expect(report).toEqual(before);
  });
});
