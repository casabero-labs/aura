// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DiagnosticReportStep from '../components/DiagnosticReportStep';
import type { DiagnosticFinding, DiagnosticReport } from '../services/diagnosticReport';
import { IssueCategory, IssueSeverity } from '../types';

const finding = (overrides: Partial<DiagnosticFinding>): DiagnosticFinding => ({
  id: 'finding-default',
  title: 'Age: valores nulos relevantes',
  severity: IssueSeverity.WARNING,
  category: IssueCategory.INTEGRITY,
  sourceIssueIds: ['issue-null-age'],
  columns: ['Age'],
  evidenceSummary: 'Age tiene 177 valores nulos sobre 891 filas.',
  contextualInterpretation: 'La ausencia puede sesgar análisis por edad; requiere revisión de dominio.',
  confidence: 'medium',
  scoreModified: false,
  requiresHumanReview: true,
  canGenerateScript: false,
  ...overrides,
});

const diagnosticReport: DiagnosticReport = {
  metadata: {
    reportId: 'diag-report-test',
    generatedAt: '2026-07-07T12:00:00.000Z',
    version: '0.1.0-l13d-test',
    sourceDatasetFingerprint: 'titanic-891x12',
    fileName: 'titanic.csv',
    rowCount: 891,
    colCount: 12,
    delimiter: ',',
    scoreBase: 72,
    scoreModified: false,
  },
  status: {
    diagnosticStatus: 'llm_diagnosis_available',
    scriptRecommended: true,
    scriptRequired: false,
    hitlRequiredForMainReport: false,
    hitlRequiredForRemediation: true,
  },
  evidenceBase: {
    severityCounts: { warning: 2, critical: 1 },
    categoryCounts: { [IssueCategory.INTEGRITY]: 1, [IssueCategory.TYPES]: 1 },
    columnTypeCounts: { number: 2, string: 1 },
    semanticTypeCounts: { currency: 1, number: 1 },
    duplicateRows: 0,
    totalIssues: 3,
    criticalIssues: 1,
    warningIssues: 2,
    infoIssues: 0,
    topIssues: [],
    topNullColumns: [],
    topCardinalityColumns: [],
    numericProfileSummary: {
      numericColumns: 2,
      columnsWithOutliers: 1,
      columnsWithDistributionStats: 2,
      averageNullPercentage: 12.4,
    },
    outlierColumns: [],
  },
  diagnosisSummary: {
    source: 'structured_v2',
    provider: 'ollama',
    model: 'qwen2.5:3b',
    latencyMs: 1200,
    evidenceEnvelopeRef: 'env-test',
    promptHash: 'prompt-test',
    executiveSummary: 'El dataset presenta riesgos de ausencia y outliers que deben revisarse antes de remediar.',
    observations: [],
    limitations: ['El diagnóstico contextualiza evidencia y no modifica el score.'],
  },
  findingGroups: {
    confirmedRisks: [
      finding({
        id: 'risk-age-nulls',
        title: 'Age: ausencia con impacto analítico',
      }),
    ],
    possibleFalsePositiveCandidates: [
      finding({
        id: 'fp-fare-outlier',
        title: 'Fare: posible falso positivo contextual',
        category: IssueCategory.TYPES,
        columns: ['Fare'],
        evidenceSummary: 'Fare contiene valores altos que pueden representar tarifas válidas.',
        contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
      }),
    ],
    humanReviewRequired: [
      finding({
        id: 'review-cabin-nulls',
        title: 'Cabin: revisar patrón de ausencia',
        columns: ['Cabin'],
      }),
    ],
    optionalRemediationCandidates: [
      finding({
        id: 'script-trim-name',
        title: 'Name: normalización opcional de texto',
        category: IssueCategory.HYGIENE,
        columns: ['Name'],
        canGenerateScript: true,
      }),
    ],
  },
  recommendations: [
    {
      id: 'rec-inspect-nulls',
      priority: 'high',
      title: 'Inspeccionar patrón de ausencia antes de imputar',
      rationale: 'Los nulos pueden representar ausencia informativa o sesgo de captura.',
      actionType: 'inspect',
      sourceIssueIds: ['issue-null-age'],
      requiresScript: false,
      requiresHITL: false,
    },
  ],
  chartSpecs: [
    {
      id: 'severity_counts',
      title: 'Hallazgos por severidad',
      description: 'Conteo de hallazgos deterministas por severidad.',
      kind: 'bar',
      data: [
        { severity: 'warning', count: 2 },
        { severity: 'critical', count: 1 },
      ],
      xKey: 'severity',
      yKey: 'count',
      source: 'audit_report',
    },
    {
      id: 'top_affected_issues',
      title: 'Hallazgos con mayor afectación',
      description: 'Hallazgos ordenados por porcentaje afectado.',
      kind: 'table',
      data: [
        { ruleName: 'Valores nulos', affectedPercentage: 77.1, column: 'Cabin' },
      ],
      xKey: 'ruleName',
      yKey: 'affectedPercentage',
      valueSuffix: '%',
      source: 'audit_report',
    },
  ],
  exportReadiness: {
    pdfReady: true,
    jsonReady: true,
    issuesCsvReady: true,
    scriptExportsReady: false,
    missingInputs: [],
  },
};

const renderStep = (callbacks = {
  onExportMain: vi.fn(),
  onGenerateScript: vi.fn(),
  onBackToDiagnosis: vi.fn(),
}, evaluationSummary?: React.ComponentProps<typeof DiagnosticReportStep>['evaluationSummary']) => {
  render(
    <DiagnosticReportStep
      diagnosticReport={diagnosticReport}
      evaluationSummary={evaluationSummary}
      onExportMain={callbacks.onExportMain}
      onGenerateScript={callbacks.onGenerateScript}
      onBackToDiagnosis={callbacks.onBackToDiagnosis}
    />,
  );
  return callbacks;
};

describe('DiagnosticReportStep', () => {
  it('shows real evaluation values and keeps unavailable values as not measured', () => {
    renderStep(undefined, {
      contractErrorsCount: 2,
      unsupportedClaimsCount: null,
      anchoredBadSampleRefsCount: 3,
      syntaxValid: null,
      pythonExecutionStatus: null,
      reauditSummary: null,
    });
    const evaluation = screen.getByTestId('diagnostic-invocation-evaluation');
    expect(evaluation.textContent).toContain('2 errores');
    expect(evaluation.textContent).toContain('Muestras problemáticas ancladas');
    expect(evaluation.textContent).toContain('3 referencias');
    expect(evaluation.textContent).not.toContain('muestras inválidas');
    expect(evaluation.textContent).toContain('No medido');
  });
  it('renderiza header y resumen principal', () => {
    renderStep();

    expect(screen.getByTestId('diagnostic-report-header').textContent).toContain('Informe diagnóstico de calidad del dato');
    const summary = screen.getByTestId('diagnostic-report-summary-strip');
    expect(summary.textContent).toContain('72/100');
    expect(summary.textContent).toContain('891');
    expect(summary.textContent).toContain('12');
    expect(summary.textContent).toContain('hallazgos');
  });

  it('no muestra estados técnicos crudos como llm_diagnosis_available', () => {
    renderStep();

    const stageText = screen.getByTestId('diagnostic-report-stage').textContent ?? '';
    expect(stageText).toContain('Diagnóstico estructurado');
    expect(stageText).not.toContain('llm_diagnosis_available');
  });

  it('muestra que score base no fue modificado', () => {
    renderStep();

    expect(screen.getByTestId('diagnostic-report-governance').textContent).toContain('Score base calculado por motor determinista.');
  });

  it('muestra que script es opcional', () => {
    renderStep();

    const stageText = screen.getByTestId('diagnostic-report-stage').textContent ?? '';
    expect(stageText).toContain('El informe principal puede cerrarse sin generar script.');
    expect(stageText).toContain('El cierre no exige script de limpieza.');
    expect(stageText).toContain('La exportación del informe no depende de un script.');
  });

  it('renderiza resumen ejecutivo', () => {
    renderStep();

    const summary = screen.getByTestId('diagnostic-report-executive-summary');
    expect(summary.textContent).toContain('Diagnóstico estructurado');
    expect(summary.textContent).toContain('El dataset presenta riesgos de ausencia y outliers');
  });

  it('renderiza una decisión ejecutiva antes del detalle técnico', () => {
    renderStep();

    const decision = screen.getByTestId('diagnostic-report-decision');
    expect(decision.textContent).toContain('Revisión humana antes de publicar o corregir datos');
    expect(decision.textContent).toContain('Exportar resultados');
  });

  it('mantiene detalle secundario bajo revelación progresiva', () => {
    renderStep();

    expect(screen.getByTestId('diagnostic-report-chart-disclosure').tagName).toBe('DETAILS');
    expect(screen.getByTestId('diagnostic-report-findings-disclosure').tagName).toBe('DETAILS');
    expect(screen.getByTestId('diagnostic-report-recommendations-disclosure').tagName).toBe('DETAILS');
    expect(screen.getByTestId('diagnostic-report-remediation-disclosure').tagName).toBe('DETAILS');
  });

  it('renderiza al menos una chartSpec', () => {
    renderStep();

    const charts = screen.getByTestId('diagnostic-report-chart-specs');
    expect(charts.textContent).toContain('severity_counts');
    expect(charts.textContent).toContain('Hallazgos por severidad');
  });

  it('renderiza riesgo confirmado', () => {
    renderStep();

    const confirmedRisks = screen.getByTestId('diagnostic-report-confirmed-risks');
    expect(confirmedRisks.textContent).toContain('Age: ausencia con impacto analítico');
  });

  it('renderiza posible falso positivo con texto conservador', () => {
    renderStep();

    const candidates = screen.getByTestId('diagnostic-report-false-positive-candidates');
    expect(candidates.textContent).toContain('Fare: posible falso positivo contextual');
    expect(candidates.textContent).toContain('Posible, no definitivo. No modifica score.');
  });

  it('renderiza recomendación', () => {
    renderStep();

    const recommendations = screen.getByTestId('diagnostic-report-recommendations');
    expect(recommendations.textContent).toContain('Inspeccionar patrón de ausencia antes de imputar');
    expect(recommendations.textContent).toContain('Inspeccionar');
  });

  it('botón export principal llama callback', () => {
    const callbacks = renderStep();

    fireEvent.click(screen.getByTestId('diagnostic-report-export-main'));

    expect(callbacks.onExportMain).toHaveBeenCalledTimes(1);
  });

  it('botón generar script llama callback', () => {
    const callbacks = renderStep();

    fireEvent.click(screen.getByTestId('diagnostic-report-generate-script'));

    expect(callbacks.onGenerateScript).toHaveBeenCalledTimes(1);
  });

  it('botón volver diagnóstico llama callback', () => {
    const callbacks = renderStep();

    fireEvent.click(screen.getByTestId('diagnostic-report-back-diagnosis'));

    expect(callbacks.onBackToDiagnosis).toHaveBeenCalledTimes(1);
  });
});
