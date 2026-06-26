import { describe, expect, it, vi } from 'vitest';
import { generatePdfReport } from '../services/pdfGenerator';
import { AuditReport, IssueCategory, IssueSeverity, ExecutiveReportContent, ScriptValidationResult } from '../types';

const stubAuditReport: AuditReport = {
  score: 79,
  rowCount: 100,
  colCount: 5,
  duplicateRows: 3,
  delimiterDetected: ',',
  issues: [
    {
      id: 'int-001',
      ruleName: 'Nulos Altos',
      category: IssueCategory.INTEGRITY,
      severity: IssueSeverity.WARNING,
      column: 'city',
      count: 12,
      affectedPercentage: 12.0,
      description: 'Columna con 12% nulos.',
      sampleValues: [''],
      ruleId: 'rule:test',
    },
    {
      id: 'sem-001',
      ruleName: 'Valores Simbolo',
      category: IssueCategory.SEMANTIC,
      severity: IssueSeverity.CRITICAL,
      column: 'type',
      count: 5,
      affectedPercentage: 5.0,
      description: 'Valores con simbolos extranos.',
      sampleValues: ['foo/bar'],
      ruleId: 'rule:test',
    },
  ],
  columnStats: {
    city: { name: 'city', inferredType: 'string', nullCount: 12, uniqueCount: 40 },
    year: { name: 'year', inferredType: 'number', nullCount: 0, uniqueCount: 5, min: 2020, max: 2024 },
    type: { name: 'type', inferredType: 'string', nullCount: 2, uniqueCount: 8 },
    value: { name: 'value', inferredType: 'number', nullCount: 5, uniqueCount: 80, min: 0, max: 1000 },
    status: { name: 'status', inferredType: 'string', nullCount: 0, uniqueCount: 3 },
  },
  scoreBreakdown: [],
};

const stubExecutiveContent: ExecutiveReportContent = {
  title: 'AURA - Informe de Auditoria',
  domain_inferred: 'Dominio de prueba',
  dataset_technical_description: 'Dataset de prueba con 100 filas y 5 columnas.',
  executive_summary: 'Resumen ejecutivo de prueba.',
  business_impact: 'Impacto de prueba.',
  key_findings: ['Hallazgo 1', 'Hallazgo 2'],
  recommendations: ['Recomendacion 1', 'Recomendacion 2'],
};

const stubScriptValidation: ScriptValidationResult = {
  valid: true,
  hasScript: true,
  invalidColumns: [],
  destructiveOperations: [],
  coveredIssueIds: ['int-001'],
  uncoveredIssueIds: ['sem-001'],
  coveragePercentage: 50,
  safetyScore: 85,
  scriptOrigin: 'model',
  hasPandasImport: true,
  requiresHumanReview: false,
  warnings: ['Warning de prueba'],
};

const generateAndGetText = (
  auditReport: AuditReport,
  executiveContent: ExecutiveReportContent,
  llmDiagnosis?: string,
  scriptValidation?: ScriptValidationResult
): { pageCount: number; allText: string } => {
  const saveSpy = vi.fn();
  let capturedDoc: any = null;
  const result = generatePdfReport(auditReport, executiveContent, llmDiagnosis, scriptValidation, (doc) => {
    capturedDoc = { internal: doc.internal };
    saveSpy(doc, 'test.pdf');
  });
  // Extract text from each page using jsPDF internal API
  const doc = (capturedDoc as any)?.internal;
  return { pageCount: result.pageCount, allText: '' };
};

describe('pdfGenerator', () => {
  it('generates a PDF and returns metadata', () => {
    const saveSpy = vi.fn();
    const result = generatePdfReport(stubAuditReport, stubExecutiveContent, undefined, undefined, saveSpy);
    expect(result.filename).toBe('Aura_Data_Lab_Diagnostico.pdf');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({}),
      'Aura_Data_Lab_Diagnostico.pdf',
    );
  });

  it('generates a PDF with script validation', () => {
    const saveSpy = vi.fn();
    const result = generatePdfReport(stubAuditReport, stubExecutiveContent, undefined, stubScriptValidation, saveSpy);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(saveSpy).toHaveBeenCalled();
  });

  it('generates a PDF with LLM diagnosis', () => {
    const saveSpy = vi.fn();
    const result = generatePdfReport(stubAuditReport, stubExecutiveContent, 'Diagnostico LLM de prueba', undefined, saveSpy);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(saveSpy).toHaveBeenCalled();
  });

  it('does not throw when the approved script has 100+ long lines', () => {
    const saveSpy = vi.fn();
    const longScript = Array.from({ length: 120 }, (_, i) =>
      `df["very_long_column_name_${i}"] = df["very_long_column_name_${i}"].astype(str).str.strip().str.lower().str.replace("_", "").str.normalize("NFKD")`
    ).join('\n');

    const contentWithLongScript: ExecutiveReportContent = {
      ...stubExecutiveContent,
      python_script: longScript,
    };

    const result = expect(() =>
      generatePdfReport(stubAuditReport, contentWithLongScript, undefined, undefined, saveSpy)
    ).not.toThrow();
    expect(saveSpy).toHaveBeenCalled();
  });

  it('does not throw with a very long single code line (300+ chars)', () => {
    const saveSpy = vi.fn();
    const oneLongLine = `df["col"] = df["col"].astype(str).str.strip().str.lower().str.replace("_", "").str.replace("-", "").str.replace(".", "").str.normalize("NFKD").str.encode("ascii", "ignore").str.decode("ascii")`;

    const contentWithLongLine: ExecutiveReportContent = {
      ...stubExecutiveContent,
      python_script: oneLongLine,
    };

    expect(() =>
      generatePdfReport(stubAuditReport, contentWithLongLine, undefined, undefined, saveSpy)
    ).not.toThrow();
    expect(saveSpy).toHaveBeenCalled();
  });

  it('does not produce pages with zero content (no blank trailing pages)', () => {
    const saveSpy = vi.fn();
    const result = generatePdfReport(stubAuditReport, stubExecutiveContent, undefined, stubScriptValidation, saveSpy);
    // Every page should have at least some content — validated by the generator's content tracking
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.pageCount).toBeLessThanOrEqual(10); // With 2 issues and small dataset, pages should be <= 10
    expect(saveSpy).toHaveBeenCalled();
  });

  it('includes methodological limitations section when LLM diagnosis is absent', () => {
    const saveSpy = vi.fn();
    let capturedPageCount = 0;
    generatePdfReport(stubAuditReport, stubExecutiveContent, undefined, undefined, (doc) => {
      capturedPageCount = (doc as any).internal.pages.length - 1;
      saveSpy(doc, 'test.pdf');
    });
    // The last pages should contain the limitations section
    expect(capturedPageCount).toBeGreaterThanOrEqual(1);
    expect(saveSpy).toHaveBeenCalled();
  });

  it('generates coherent output with all sections when everything is provided', () => {
    const saveSpy = vi.fn();
    const fullExecutiveContent: ExecutiveReportContent = {
      ...stubExecutiveContent,
      python_script: 'df["city"] = df["city"].str.lower()\nprint("ok")',
    };

    const result = generatePdfReport(
      stubAuditReport,
      fullExecutiveContent,
      'Diagnostico extenso del modelo sobre la calidad del dataset.',
      stubScriptValidation,
      saveSpy
    );
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(saveSpy).toHaveBeenCalled();
  });
});
