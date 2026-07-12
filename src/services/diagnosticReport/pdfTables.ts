import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  DiagnosticFinding,
  DiagnosticRecommendation,
  DiagnosticReport,
} from './types';
import {
  PdfLayoutContext,
  addParagraph,
  ensureSpace,
  formatNumber,
  formatPercent,
  truncateText,
} from './pdfLayout';

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

const updateCursorAfterTable = (ctx: PdfLayoutContext) => {
  const finalY = (ctx.doc as AutoTableDoc).lastAutoTable?.finalY;
  ctx.cursorY = typeof finalY === 'number' ? finalY + 8 : ctx.cursorY + 8;
};

const commonStyles = (ctx: PdfLayoutContext) => ({
  font: 'helvetica',
  fontSize: 7.8,
  cellPadding: 2.4,
  overflow: 'linebreak' as const,
  lineColor: ctx.theme.colors.border,
  textColor: ctx.theme.colors.muted,
});

const headStyles = (ctx: PdfLayoutContext) => ({
  fillColor: ctx.theme.colors.panel,
  textColor: ctx.theme.colors.ink,
  fontStyle: 'bold' as const,
  lineWidth: 0.15,
});

const tableMargin = (ctx: PdfLayoutContext) => ({
  left: ctx.theme.margin.left,
  right: ctx.theme.margin.right,
  top: ctx.theme.margin.top + 8,
  bottom: ctx.theme.margin.bottom + 2,
});

const booleanLabel = (value: boolean) => (value ? 'Sí' : 'No');

const severityLabel = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === 'critical') return 'Crítica';
  if (normalized === 'warning') return 'Advertencia';
  if (normalized === 'info') return 'Info';
  if (normalized === 'good') return 'Correcto';
  return value;
};

const priorityLabel = (value: DiagnosticRecommendation['priority']) => {
  if (value === 'high') return 'Alta';
  if (value === 'medium') return 'Media';
  return 'Baja';
};

export const actionTypeLabel = (value: DiagnosticRecommendation['actionType']) => {
  if (value === 'inspect') return 'Inspeccionar';
  if (value === 'document') return 'Documentar';
  if (value === 'transform_optional') return 'Transformación opcional';
  if (value === 'generate_script_optional') return 'Generar script opcional';
  return 'No corregir automáticamente';
};

const addEmptyTableState = (ctx: PdfLayoutContext, message = 'Sin registros para esta sección.') => {
  addParagraph(ctx, message, { fontSize: 8.5, color: ctx.theme.colors.faint });
};

export const addTopIssuesTable = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  ensureSpace(ctx, 26);
  const rows = report.evidenceBase.topIssues.slice(0, 6).map((issue) => [
    truncateText(issue.ruleName, 54),
    severityLabel(issue.severity),
    truncateText(issue.category, 42),
    truncateText(issue.column ?? 'Dataset', 28),
    formatNumber(issue.count),
    formatPercent(issue.affectedPercentage),
    truncateText(issue.description, 120),
  ]);

  if (rows.length === 0) {
    addEmptyTableState(ctx, 'No se registraron hallazgos priorizados.');
    return;
  }

  autoTable(ctx.doc, {
    startY: ctx.cursorY,
    margin: tableMargin(ctx),
    head: [['Regla', 'Severidad', 'Categoría', 'Columna', 'Conteo', '% afectado', 'Descripción']],
    body: rows,
    theme: 'grid',
    styles: commonStyles(ctx),
    headStyles: headStyles(ctx),
    alternateRowStyles: { fillColor: [247, 244, 239] },
    rowPageBreak: 'avoid',
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 19 },
      2: { cellWidth: 31 },
      3: { cellWidth: 24 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 'auto' },
    },
  });
  updateCursorAfterTable(ctx);
};

export const addFindingsTable = (
  ctx: PdfLayoutContext,
  findings: DiagnosticFinding[] | undefined,
  options: { falsePositive?: boolean; maxRows?: number } = {},
) => {
  const safeFindings = findings ?? [];
  ensureSpace(ctx, 26);

  if (safeFindings.length === 0) {
    addEmptyTableState(ctx);
    return;
  }

  const rows = safeFindings.slice(0, options.maxRows ?? 8).map((finding) => [
    truncateText(finding.title, 58),
    severityLabel(finding.severity),
    truncateText(finding.columns.join(', ') || 'Dataset', 34),
    truncateText(finding.evidenceSummary, 120),
    truncateText(
      options.falsePositive
        ? `Posible, no definitivo. No modifica score. ${finding.contextualInterpretation}`
        : finding.contextualInterpretation,
      150,
    ),
    booleanLabel(finding.requiresHumanReview),
  ]);

  autoTable(ctx.doc, {
    startY: ctx.cursorY,
    margin: tableMargin(ctx),
    head: [['Hallazgo', 'Sev.', 'Columnas', 'Evidencia', 'Interpretación', 'Rev. humana']],
    body: rows,
    theme: 'grid',
    styles: commonStyles(ctx),
    headStyles: headStyles(ctx),
    alternateRowStyles: { fillColor: [247, 244, 239] },
    rowPageBreak: 'avoid',
    columnStyles: {
      0: { cellWidth: 33, fontStyle: 'bold' },
      1: { cellWidth: 15 },
      2: { cellWidth: 24 },
      3: { cellWidth: 43 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 18 },
    },
  });
  updateCursorAfterTable(ctx);
};

export const addRecommendationsTable = (
  ctx: PdfLayoutContext,
  recommendations: DiagnosticRecommendation[],
) => {
  ensureSpace(ctx, 26);

  if (recommendations.length === 0) {
    addEmptyTableState(ctx, 'No se registraron recomendaciones.');
    return;
  }

  const rows = recommendations.map((recommendation) => [
    priorityLabel(recommendation.priority),
    actionTypeLabel(recommendation.actionType),
    truncateText(recommendation.title, 64),
    truncateText(recommendation.rationale, 150),
    booleanLabel(recommendation.requiresScript),
    booleanLabel(recommendation.requiresHITL),
  ]);

  autoTable(ctx.doc, {
    startY: ctx.cursorY,
    margin: tableMargin(ctx),
    head: [['Prioridad', 'Acción', 'Recomendación', 'Fundamento', 'Script', 'HITL']],
    body: rows,
    theme: 'grid',
    styles: commonStyles(ctx),
    headStyles: headStyles(ctx),
    alternateRowStyles: { fillColor: [247, 244, 239] },
    rowPageBreak: 'avoid',
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 38 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 16 },
      5: { cellWidth: 16 },
    },
  });
  updateCursorAfterTable(ctx);
};

export const addTechnicalAnnexTables = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const metadataRows = [
    ['reportId', report.metadata.reportId],
    ...(report.metadata.runId ? [['runId', report.metadata.runId]] : []),
    ...(report.metadata.datasetSha256 ? [['datasetSha256', report.metadata.datasetSha256]] : []),
    ...(report.metadata.diagnosisReceiptHash ? [['diagnosisReceiptHash', report.metadata.diagnosisReceiptHash]] : []),
    ['generatedAt', report.metadata.generatedAt],
    ['version', report.metadata.version],
    ['sourceDatasetFingerprint', report.metadata.sourceDatasetFingerprint],
    ['fileName', report.metadata.fileName ?? 'Sin nombre de archivo'],
    ['rowCount', formatNumber(report.metadata.rowCount)],
    ['colCount', formatNumber(report.metadata.colCount)],
    ['delimiter', report.metadata.delimiter],
    ['scoreBase', String(report.metadata.scoreBase)],
    ['scoreModified', String(report.metadata.scoreModified)],
  ];

  autoTable(ctx.doc, {
    startY: ctx.cursorY,
    margin: tableMargin(ctx),
    head: [['Campo', 'Valor']],
    body: metadataRows.map(([key, value]) => [key, truncateText(value, 160)]),
    theme: 'grid',
    styles: commonStyles(ctx),
    headStyles: headStyles(ctx),
    alternateRowStyles: { fillColor: [247, 244, 239] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
  });
  updateCursorAfterTable(ctx);

  const chartRows = report.chartSpecs.map((chart) => [
    chart.id,
    chart.kind,
    chart.source,
    chart.data.length,
    truncateText(chart.description, 110),
  ]);
  autoTable(ctx.doc, {
    startY: ctx.cursorY,
    margin: tableMargin(ctx),
    head: [['Gráfico', 'Tipo', 'Fuente', 'Filas', 'Descripción']],
    body: chartRows,
    theme: 'grid',
    styles: commonStyles(ctx),
    headStyles: headStyles(ctx),
    alternateRowStyles: { fillColor: [247, 244, 239] },
  });
  updateCursorAfterTable(ctx);

  const nullRows = report.evidenceBase.topNullColumns.slice(0, 4).map((column) => [
    column.column,
    formatNumber(column.nullCount),
    formatPercent(column.nullPercentage),
    column.inferredType,
    column.semanticType ?? 'unknown',
  ]);
  if (nullRows.length > 0) {
    autoTable(ctx.doc, {
      startY: ctx.cursorY,
      margin: tableMargin(ctx),
      head: [['Top nulos', 'Nulos', '%', 'Tipo', 'Semántica']],
      body: nullRows,
      theme: 'grid',
      styles: commonStyles(ctx),
      headStyles: headStyles(ctx),
      alternateRowStyles: { fillColor: [247, 244, 239] },
    });
    updateCursorAfterTable(ctx);
  }

  const cardinalityRows = report.evidenceBase.topCardinalityColumns.slice(0, 4).map((column) => [
    column.column,
    formatNumber(column.uniqueCount),
    formatPercent(column.uniquePercentage),
    column.inferredType,
    column.semanticType ?? 'unknown',
  ]);
  if (cardinalityRows.length > 0) {
    autoTable(ctx.doc, {
      startY: ctx.cursorY,
      margin: tableMargin(ctx),
      head: [['Top cardinalidad', 'Únicos', '%', 'Tipo', 'Semántica']],
      body: cardinalityRows,
      theme: 'grid',
      styles: commonStyles(ctx),
      headStyles: headStyles(ctx),
      alternateRowStyles: { fillColor: [247, 244, 239] },
    });
    updateCursorAfterTable(ctx);
  }

  const outlierRows = report.evidenceBase.outlierColumns.slice(0, 4).map((column) => [
    column.column,
    formatNumber(column.outlierCount),
    formatPercent(column.outlierPercentage),
    column.outlierSeverity ? severityLabel(column.outlierSeverity) : 'sin dato',
    column.lowerFence === undefined ? 'no aplica' : String(column.lowerFence),
    column.upperFence === undefined ? 'no aplica' : String(column.upperFence),
  ]);
  if (outlierRows.length > 0) {
    ensureSpace(ctx, 38);
    autoTable(ctx.doc, {
      startY: ctx.cursorY,
      margin: tableMargin(ctx),
      head: [['Outlier', 'Conteo', '%', 'Sev.', 'Fence inf.', 'Fence sup.']],
      body: outlierRows,
      theme: 'grid',
      styles: commonStyles(ctx),
      headStyles: headStyles(ctx),
      alternateRowStyles: { fillColor: [247, 244, 239] },
    });
    updateCursorAfterTable(ctx);
  }

  if (report.findingGroups.optionalRemediationCandidates.length > 0) {
    addFindingsTable(ctx, report.findingGroups.optionalRemediationCandidates);
  }
};
