import { jsPDF } from 'jspdf';
import { describe, expect, it, vi } from 'vitest';
import { generateDiagnosticPdfReport } from '../services/diagnosticReport';
import type {
  DiagnosticChartSpec,
  DiagnosticFinding,
  GenerateDiagnosticPdfReportParams,
  DiagnosticRecommendation,
  DiagnosticReport,
} from '../services/diagnosticReport';
import { IssueCategory, IssueSeverity } from '../types';
import { createPdfTheme } from '../services/diagnosticReport/pdfLayout';

const finding = (overrides: Partial<DiagnosticFinding> = {}): DiagnosticFinding => ({
  id: 'finding-age-nulls',
  title: 'Age: valores nulos relevantes',
  severity: IssueSeverity.WARNING,
  category: IssueCategory.INTEGRITY,
  sourceIssueIds: ['issue-null-age'],
  columns: ['Age'],
  evidenceSummary: 'Age tiene 177 valores nulos sobre 891 filas.',
  contextualInterpretation: 'Riesgo observado por regla determinista; requiere revisión de dominio.',
  confidence: 'medium',
  scoreModified: false,
  requiresHumanReview: true,
  canGenerateScript: false,
  ...overrides,
});

const recommendation = (overrides: Partial<DiagnosticRecommendation> = {}): DiagnosticRecommendation => ({
  id: 'rec-inspect-nulls',
  priority: 'high',
  title: 'Inspeccionar patrón de ausencia antes de imputar',
  rationale: 'Los nulos pueden representar ausencia informativa o sesgo de captura.',
  actionType: 'inspect',
  sourceIssueIds: ['issue-null-age'],
  requiresScript: false,
  requiresHITL: false,
  ...overrides,
});

const chartSpecs: DiagnosticChartSpec[] = [
  {
    id: 'severity_counts',
    title: 'Hallazgos por severidad',
    description: 'Conteo de hallazgos deterministas agrupados por severidad.',
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
    id: 'top_null_columns',
    title: 'Columnas con más nulos',
    description: 'Columnas ordenadas por porcentaje de nulos.',
    kind: 'horizontal_bar',
    data: [
      { column: 'Cabin', nullPercentage: 77.1, nullCount: 687 },
      { column: 'Age', nullPercentage: 19.87, nullCount: 177 },
    ],
    xKey: 'nullPercentage',
    yKey: 'column',
    valueSuffix: '%',
    source: 'column_stats',
  },
  {
    id: 'column_type_counts',
    title: 'Columnas por tipo inferido',
    description: 'Distribución de tipos inferidos.',
    kind: 'pie',
    data: [
      { type: 'number', count: 2 },
      { type: 'string', count: 3 },
    ],
    xKey: 'type',
    yKey: 'count',
    source: 'column_stats',
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
];

type DiagnosticReportFixtureOverrides =
  Partial<Omit<DiagnosticReport, 'metadata' | 'status' | 'evidenceBase' | 'diagnosisSummary' | 'findingGroups' | 'exportReadiness'>> & {
    metadata?: Partial<DiagnosticReport['metadata']>;
    status?: Partial<DiagnosticReport['status']>;
    evidenceBase?: Partial<DiagnosticReport['evidenceBase']>;
    diagnosisSummary?: Partial<DiagnosticReport['diagnosisSummary']>;
    findingGroups?: Partial<DiagnosticReport['findingGroups']>;
    exportReadiness?: Partial<DiagnosticReport['exportReadiness']>;
  };

const buildDiagnosticReportFixture = (overrides: DiagnosticReportFixtureOverrides = {}): DiagnosticReport => {
  const possibleFalsePositive = finding({
    id: 'fp-fare-outlier',
    title: 'Fare: posible falso positivo contextual',
    category: IssueCategory.TYPES,
    columns: ['Fare'],
    evidenceSummary: 'Fare contiene valores altos que pueden representar tarifas válidas.',
    contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
    confidence: 'low',
    canGenerateScript: false,
  });

  const base: DiagnosticReport = {
    metadata: {
      reportId: 'diag-report-test',
      generatedAt: '2026-07-07T12:00:00.000Z',
      version: '0.1.0-l13e-test',
      sourceDatasetFingerprint: 'titanic-891x12',
      fileName: 'titanic.csv',
      rowCount: 891,
      colCount: 12,
      delimiter: ',',
      scoreBase: 72,
      scoreModified: false,
    },
    status: {
      diagnosticStatus: 'deterministic_only',
      scriptRecommended: true,
      scriptRequired: false,
      hitlRequiredForMainReport: false,
      hitlRequiredForRemediation: true,
    },
    evidenceBase: {
      severityCounts: { warning: 2, critical: 1 },
      categoryCounts: { [IssueCategory.INTEGRITY]: 1, [IssueCategory.TYPES]: 1 },
      columnTypeCounts: { number: 2, string: 3 },
      semanticTypeCounts: { currency: 1, number: 1, string: 3 },
      duplicateRows: 0,
      totalIssues: 3,
      criticalIssues: 1,
      warningIssues: 2,
      infoIssues: 0,
      topIssues: [
        {
          id: 'issue-null-cabin',
          ruleId: 'rule:null-values',
          ruleName: 'Valores nulos',
          severity: IssueSeverity.CRITICAL,
          category: IssueCategory.INTEGRITY,
          column: 'Cabin',
          count: 687,
          affectedPercentage: 77.1,
          description: 'Cabin tiene una proporción alta de valores nulos.',
        },
      ],
      topNullColumns: [
        { column: 'Cabin', nullCount: 687, nullPercentage: 77.1, inferredType: 'string', semanticType: 'string' },
        { column: 'Age', nullCount: 177, nullPercentage: 19.87, inferredType: 'number', semanticType: 'number' },
      ],
      topCardinalityColumns: [
        { column: 'PassengerId', uniqueCount: 891, uniquePercentage: 100, inferredType: 'number', semanticType: 'uuid' },
        { column: 'Ticket', uniqueCount: 681, uniquePercentage: 76.43, inferredType: 'string', semanticType: 'string' },
      ],
      numericProfileSummary: {
        numericColumns: 2,
        columnsWithOutliers: 1,
        columnsWithDistributionStats: 2,
        averageNullPercentage: 12.4,
      },
      outlierColumns: [
        {
          column: 'Fare',
          outlierCount: 9,
          outlierPercentage: 1.01,
          outlierSeverity: 'WARNING',
          lowerFence: -26.72,
          upperFence: 65.63,
        },
      ],
    },
    diagnosisSummary: {
      source: 'unavailable',
      provider: null,
      model: null,
      executiveSummary: 'Reporte determinista con riesgos de ausencia y outliers que requieren revisión antes de remediar.',
      observations: [],
      limitations: ['Diagnóstico asistido no disponible; reporte generado solo con evidencia determinista.'],
    },
    findingGroups: {
      confirmedRisks: [finding()],
      possibleFalsePositiveCandidates: [possibleFalsePositive],
      humanReviewRequired: [finding({ id: 'review-cabin-nulls', title: 'Cabin: revisar patrón de ausencia', columns: ['Cabin'] })],
      optionalRemediationCandidates: [finding({ id: 'script-trim-name', title: 'Name: normalización opcional de texto', columns: ['Name'], canGenerateScript: true })],
    },
    recommendations: [
      recommendation(),
      recommendation({
        id: 'rec-script-optional',
        priority: 'low',
        title: 'Generar script solo como rama opcional',
        rationale: 'El reporte principal no requiere script.',
        actionType: 'generate_script_optional',
        requiresScript: true,
        requiresHITL: true,
      }),
    ],
    chartSpecs,
    exportReadiness: {
      pdfReady: true,
      jsonReady: true,
      issuesCsvReady: true,
      scriptExportsReady: false,
      missingInputs: [],
    },
  };

  return {
    ...base,
    ...overrides,
    metadata: { ...base.metadata, ...overrides.metadata },
    status: { ...base.status, ...overrides.status },
    evidenceBase: { ...base.evidenceBase, ...overrides.evidenceBase },
    diagnosisSummary: { ...base.diagnosisSummary, ...overrides.diagnosisSummary },
    findingGroups: { ...base.findingGroups, ...overrides.findingGroups },
    exportReadiness: { ...base.exportReadiness, ...overrides.exportReadiness },
  };
};

const renderPdf = (
  diagnosticReport: DiagnosticReport,
  options: Partial<Omit<GenerateDiagnosticPdfReportParams, 'diagnosticReport' | 'save'>> = {},
) => {
  let capturedDoc: jsPDF | null = null;
  let capturedFilename = '';
  const save = vi.fn((doc: jsPDF, filename: string) => {
    capturedDoc = doc;
    capturedFilename = filename;
  });

  const result = generateDiagnosticPdfReport({ diagnosticReport, save, ...options });

  return { result, save, capturedDoc, capturedFilename };
};

describe('generateDiagnosticPdfReport', () => {
  it('usa la paleta Casabero Editorial sin superficies warm', () => {
    const theme = createPdfTheme();

    expect(theme.colors).toEqual(expect.objectContaining({
      ink: '#191919',
      muted: '#6B6B67',
      border: '#D9D9D4',
      panel: '#F7F7F4',
      white: '#FFFFFF',
    }));
    expect(theme.fonts).toEqual({ reading: 'times', operation: 'helvetica', data: 'courier' });
    expect(Object.values(theme.colors)).not.toContain('#faf8f4');
    expect(Object.values(theme.colors)).not.toContain('#f5f1e8');
  });
  it('genera PDF con solo DiagnosticReport determinista', () => {
    const { result, capturedDoc } = renderPdf(buildDiagnosticReportFixture());

    expect(result.pageCount).toBe(5);
    expect(capturedDoc?.getNumberOfPages()).toBe(result.pageCount);
  });

  it('retorna filename con extensión .pdf', () => {
    const { result } = renderPdf(buildDiagnosticReportFixture());

    expect(result.filename).toMatch(/\.pdf$/);
  });

  it('retorna pageCount mayor o igual a 1', () => {
    const { result } = renderPdf(buildDiagnosticReportFixture());

    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('invoca save callback', () => {
    const { save, capturedFilename } = renderPdf(buildDiagnosticReportFixture());

    expect(save).toHaveBeenCalledTimes(1);
    expect(capturedFilename).toMatch(/aura_informe_diagnostico_titanic\.pdf/);
  });

  it('no muta DiagnosticReport original', () => {
    const diagnosticReport = buildDiagnosticReportFixture();
    const before = JSON.stringify(diagnosticReport);

    renderPdf(diagnosticReport);

    expect(JSON.stringify(diagnosticReport)).toBe(before);
  });

  it('soporta chartSpecs vacíos sin fallar', () => {
    const diagnosticReport = buildDiagnosticReportFixture({ chartSpecs: [] });

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
  });

  it('soporta possibleFalsePositiveCandidates', () => {
    const diagnosticReport = buildDiagnosticReportFixture();

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
    expect(diagnosticReport.findingGroups.possibleFalsePositiveCandidates[0].title).toContain('Fare');
  });

  it('soporta recommendations', () => {
    const diagnosticReport = buildDiagnosticReportFixture({
      recommendations: [recommendation({ actionType: 'do_not_auto_fix', requiresHITL: true })],
    });

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
  });

  it('funciona con diagnosisSummary source unavailable', () => {
    const diagnosticReport = buildDiagnosticReportFixture({
      diagnosisSummary: { source: 'unavailable' },
      status: { diagnosticStatus: 'deterministic_only' },
    });

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
  });

  it('funciona con diagnosisSummary source structured_v2', () => {
    const diagnosticReport = buildDiagnosticReportFixture({
      status: { diagnosticStatus: 'llm_diagnosis_available' },
      diagnosisSummary: {
        source: 'structured_v2',
        provider: 'ollama',
        model: 'qwen2.5:3b',
        latencyMs: 1200,
        executiveSummary: 'Diagnóstico estructurado sobre evidencia determinista.',
        limitations: ['Limitación estructurada de prueba.'],
      },
    });

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
  });

  it('funciona con textos largos sin lanzar excepción', () => {
    const longText = Array.from({ length: 80 }, (_, index) => `Observación larga ${index + 1} con evidencia y contexto.`).join(' ');
    const diagnosticReport = buildDiagnosticReportFixture({
      diagnosisSummary: {
        executiveSummary: longText,
        limitations: [longText, longText],
      },
      recommendations: [recommendation({ rationale: longText, title: longText })],
    });

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
  });

  it('funciona sin optionalRemediationCandidates', () => {
    const diagnosticReport = buildDiagnosticReportFixture({
      findingGroups: { optionalRemediationCandidates: [] },
      status: { scriptRecommended: false, hitlRequiredForRemediation: false },
      recommendations: [recommendation()],
    });

    expect(() => renderPdf(diagnosticReport)).not.toThrow();
  });

  it('incluye script Python como anexo final cuando existe', () => {
    const diagnosticReport = buildDiagnosticReportFixture();
    const pythonScript = [
      'import pandas as pd',
      '',
      'def limpiar_dataset(df: pd.DataFrame) -> pd.DataFrame:',
      '    resultado = df.copy()',
      '    resultado = resultado.drop_duplicates()',
      '    return resultado',
    ].join('\n');

    const { result, capturedDoc } = renderPdf(diagnosticReport, {
      pythonScript,
      pythonScriptApproved: true,
    });

    expect(result.pageCount).toBeGreaterThanOrEqual(2);
    expect(capturedDoc?.getNumberOfPages()).toBe(result.pageCount);
  });

  it('pinta fondo blanco completo en todas las páginas, incluidas las creadas por anexos y tablas', () => {
    const pythonScript = 'import pandas as pd\n\n'
      + Array.from({ length: 60 }, (_, i) => `# linea larga ${i} de anexo para forzar salto de pagina`).join('\n');

    const { capturedDoc } = renderPdf(buildDiagnosticReportFixture(), {
      pythonScript,
      pythonScriptApproved: true,
    });

    expect(capturedDoc).not.toBeNull();
    const doc = capturedDoc as unknown as jsPDF;
    const pageCount = doc.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(3);

    const scale = doc.internal.scaleFactor;
    const pageWidthPt = doc.internal.pageSize.getWidth() * scale;
    const pageHeightPt = doc.internal.pageSize.getHeight() * scale;
    const internal = doc.internal as unknown as { pages: string[][] };

    for (let page = 1; page <= pageCount; page += 1) {
      const stream = internal.pages[page].join('\n');
      const rectMatches = [...stream.matchAll(/(-?\d+(?:\.\d*)?) (-?\d+(?:\.\d*)?) (-?\d+(?:\.\d*)?) (-?\d+(?:\.\d*)?) re\s*\n\s*f/g)];
      const paintsFullWhitePage = rectMatches.some((match) => {
        const width = Math.abs(Number(match[3]));
        const height = Math.abs(Number(match[4]));
        return Math.abs(width - pageWidthPt) < 1 && Math.abs(height - pageHeightPt) < 1;
      });
      const declaresWhiteFill = /\b1\.?0*\s+g\b/.test(stream) || /\b1\.?0*\s+1\.?0*\s+1\.?0*\s+rg\b/.test(stream);
      expect(paintsFullWhitePage, `página ${page} pinta un rectángulo A4 completo`).toBe(true);
      expect(declaresWhiteFill, `página ${page} declara relleno blanco`).toBe(true);
    }
  });
});
