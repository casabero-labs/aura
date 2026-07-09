import { jsPDF } from 'jspdf';
import type { DiagnosticReport } from './types';
import { drawChartSpec } from './pdfCharts';
import {
  actionTypeLabel,
  addFindingsTable,
  addRecommendationsTable,
  addTechnicalAnnexTables,
  addTopIssuesTable,
} from './pdfTables';
import {
  PdfLayoutContext,
  addBulletList,
  addGovernanceCallout,
  addKpiGrid,
  addMethodologyNote,
  addNewPage,
  addParagraph,
  addSectionTitle,
  applyPageChrome,
  createPdfTheme,
  ensureSpace,
  formatNumber,
  getContentWidth,
  getPageHeight,
  getPageWidth,
  truncateText,
} from './pdfLayout';
import {
  buildDiagnosticPresentation,
  formatDiagnosticStatusLabel,
} from './presentation';

type SaveCallback = (doc: jsPDF, filename: string) => void;

export interface GenerateDiagnosticPdfReportParams {
  diagnosticReport: DiagnosticReport;
  pythonScript?: string | null;
  pythonScriptApproved?: boolean;
  save?: SaveCallback;
}

export interface GenerateDiagnosticPdfReportResult {
  filename: string;
  pageCount: number;
}

const defaultSave: SaveCallback = (doc, filename) => doc.save(filename);

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'dataset';

const buildFilename = (report: DiagnosticReport) => {
  const base = safeFilePart(report.metadata.fileName ?? report.metadata.reportId);
  return `aura_informe_diagnostico_${base}.pdf`;
};

const formatPdfDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return truncateText(value, 42);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const drawCover = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const { doc, theme } = ctx;
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const contentWidth = getContentWidth(ctx);
  const presentation = buildDiagnosticPresentation(report);

  doc.setFillColor(theme.colors.white);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(theme.colors.ink);
  doc.text('Informe diagnostico', theme.margin.left, 48);
  doc.text('de calidad del dato', theme.margin.left, 60);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(theme.colors.muted);
  doc.text(truncateText(report.metadata.fileName ?? 'Dataset sin nombre de archivo', 96), theme.margin.left, 75);

  doc.setDrawColor(theme.colors.border);
  doc.line(theme.margin.left, 87, pageWidth - theme.margin.right, 87);

  const decisionY = 108;
  const scoreX = pageWidth - theme.margin.right - 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.accent);
  doc.text(presentation.decision.eyebrow.toUpperCase(), theme.margin.left, decisionY);
  doc.setFontSize(15);
  doc.setTextColor(theme.colors.ink);
  doc.text(doc.splitTextToSize(presentation.decision.title, contentWidth - 64), theme.margin.left, decisionY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(theme.colors.muted);
  doc.text(doc.splitTextToSize(presentation.decision.body, contentWidth - 64), theme.margin.left, decisionY + 28);

  doc.setDrawColor(theme.colors.border);
  doc.rect(scoreX, decisionY - 2, 38, 32, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(report.metadata.scoreBase >= 80 ? theme.colors.good : report.metadata.scoreBase >= 50 ? theme.colors.warning : theme.colors.critical);
  doc.text(`${report.metadata.scoreBase}`, scoreX + 19, decisionY + 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(theme.colors.faint);
  doc.text('score base', scoreX + 19, decisionY + 23, { align: 'center' });

  const kpis = [
    ['Fecha', formatPdfDate(report.metadata.generatedAt)],
    ['Fingerprint', report.metadata.sourceDatasetFingerprint],
    ['Filas / columnas', `${formatNumber(report.metadata.rowCount)} / ${formatNumber(report.metadata.colCount)}`],
    ['Estado diagnóstico', formatDiagnosticStatusLabel(report.status.diagnosticStatus)],
  ];

  let y = 166;
  kpis.forEach(([label, value]) => {
    doc.setDrawColor(theme.colors.border);
    doc.setLineWidth(0.15);
    doc.line(theme.margin.left, y + 4, pageWidth - theme.margin.right, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.colors.faint);
    doc.text(label.toUpperCase(), theme.margin.left, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(theme.colors.ink);
    doc.text(truncateText(value, 92), theme.margin.left + 54, y);
    y += 12;
  });

  doc.setDrawColor(theme.colors.border);
  doc.line(theme.margin.left, pageHeight - 67, pageWidth - theme.margin.right, pageHeight - 67);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(theme.colors.ink);
  doc.text('Gobernanza del score', theme.margin.left, pageHeight - 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.muted);
  doc.text('Score no modificado por IA. El diagnostico contextualiza evidencia, no recalcula la calificacion.', theme.margin.left, pageHeight - 48);

  ctx.cursorY = pageHeight - theme.margin.bottom;
};

const addEvidenceCounts = (ctx: PdfLayoutContext, title: string, counts: Record<string, number>) => {
  const entries = Object.entries(counts);
  addParagraph(
    ctx,
    entries.length === 0
      ? `${title}: sin datos.`
      : `${title}: ${entries.map(([key, value]) => `${key}: ${formatNumber(value)}`).join(' · ')}`,
    { fontSize: 8.6 },
  );
};

const addTechnicalProfile = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Perfil técnico base', 'evidencia determinista');
  addKpiGrid(ctx, [
    { label: 'Score base', value: `${report.metadata.scoreBase}/100`, note: 'Sin modificación LLM' },
    { label: 'Filas', value: formatNumber(report.metadata.rowCount) },
    { label: 'Columnas', value: formatNumber(report.metadata.colCount) },
    { label: 'Delimitador', value: report.metadata.delimiter },
    { label: 'Duplicados', value: formatNumber(report.evidenceBase.duplicateRows) },
    { label: 'Hallazgos', value: formatNumber(report.evidenceBase.totalIssues) },
    { label: 'Críticos', value: formatNumber(report.evidenceBase.criticalIssues) },
    { label: 'Advertencias', value: formatNumber(report.evidenceBase.warningIssues) },
  ]);
  addEvidenceCounts(ctx, 'Severidad', report.evidenceBase.severityCounts);
  addEvidenceCounts(ctx, 'Categoría', report.evidenceBase.categoryCounts);
  addEvidenceCounts(ctx, 'Tipos inferidos', report.evidenceBase.columnTypeCounts);
  addEvidenceCounts(ctx, 'Tipos semánticos', report.evidenceBase.semanticTypeCounts);
};

const addCharts = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Gráficos estadísticos reproducibles', 'vectores PDF');
  addParagraph(
    ctx,
    'Los gráficos se dibujan como vectores PDF desde las especificaciones serializables del reporte. No dependen de imágenes externas, capturas ni DOM.',
  );
  if (report.chartSpecs.length === 0) {
    addParagraph(ctx, 'Sin especificaciones de gráficos disponibles para este reporte.', { color: ctx.theme.colors.faint });
    return;
  }
  report.chartSpecs.forEach((chart) => {
    drawChartSpec(ctx, chart);
  });
};

const addExecutiveSummary = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const presentation = buildDiagnosticPresentation(report);
  addSectionTitle(ctx, 'Resumen ejecutivo', presentation.sourceLabel);
  addGovernanceCallout(ctx, presentation.decision.title, [presentation.decision.body]);
  addKpiGrid(ctx, presentation.metrics);
  addParagraph(ctx, presentation.executiveSummary);

  if (presentation.topRisks.length > 0) {
    addSectionTitle(ctx, 'Riesgos principales');
    addBulletList(ctx, presentation.topRisks.map((risk) => `${risk.title}: ${risk.evidenceSummary}`), 5);
  }

  if (presentation.recommendations.length > 0) {
    addSectionTitle(ctx, 'Siguiente decision recomendada');
    addBulletList(ctx, presentation.recommendations.map((recommendation) => `${recommendation.title}: ${recommendation.rationale}`), 4);
  }

  addSectionTitle(ctx, 'Gobernanza y limitaciones');
  addBulletList(ctx, presentation.supportedClaims, 5);
  addBulletList(ctx, presentation.pendingClaims, 5);
  addBulletList(ctx, report.diagnosisSummary.limitations, 6);
  addMethodologyNote(ctx, report.diagnosisSummary.source);
};

const addRisksAndFindings = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Hallazgos priorizados', 'motor determinista');
  addTopIssuesTable(ctx, report);

  addSectionTitle(ctx, 'Riesgos confirmados');
  addFindingsTable(ctx, report.findingGroups.confirmedRisks);

  addSectionTitle(ctx, 'Posibles falsos positivos contextuales');
  addParagraph(ctx, 'Posible, no definitivo. No modifica score. Estos elementos requieren revisión humana antes de remediar, descartar o documentar.');
  addFindingsTable(ctx, report.findingGroups.possibleFalsePositiveCandidates, { falsePositive: true });
};

const addRecommendations = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Recomendaciones');
  addRecommendationsTable(ctx, report.recommendations);
};

const addOptionalActions = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Acciones opcionales', 'remediación');
  addGovernanceCallout(ctx, 'Cierre del análisis', [
    'El informe puede cerrarse sin script.',
    'La generación de script es una rama opcional.',
    'HITL solo es obligatorio si se genera/remedia con script.',
    'La reauditoría se usa para medir delta si el usuario decide remediar.',
  ]);

  if (report.findingGroups.optionalRemediationCandidates.length > 0) {
    addParagraph(
      ctx,
      `Candidatos de remediación opcional: ${report.findingGroups.optionalRemediationCandidates.map((finding) => truncateText(finding.title, 58)).join(' · ')}`,
      { fontSize: 8.6 },
    );
  } else {
    addParagraph(ctx, 'No se registraron candidatos de remediación opcional en el reporte.', { fontSize: 8.6 });
  }

  const scriptRecommendation = report.recommendations.find((recommendation) => recommendation.requiresScript);
  if (scriptRecommendation) {
    addParagraph(
      ctx,
      `Recomendación asociada a script: ${actionTypeLabel(scriptRecommendation.actionType)} - ${truncateText(scriptRecommendation.title, 120)}.`,
      { fontSize: 8.6 },
    );
  }
};

const addMethodologyLimitations = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Limitaciones metodológicas');
  addBulletList(ctx, [
    'El score pertenece al motor determinista.',
    'El diagnóstico asistido contextualiza, no reemplaza evidencia.',
    'El reporte no modifica el dataset.',
    'No hay corrección automática.',
    'Los posibles falsos positivos son candidatos, no conclusiones definitivas.',
    report.diagnosisSummary.source === 'unavailable'
      ? 'No hubo diagnóstico asistido; el reporte declara determinismo solamente.'
      : 'El diagnóstico asistido se presenta como interpretación contextual.',
    report.diagnosisSummary.source === 'legacy_text'
      ? 'El diagnóstico legacy no tiene garantías estructuradas v2.'
      : 'La evidencia estructurada o determinista queda separada de la interpretación.',
  ], 8);
};

const addTechnicalAnnex = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Anexo técnico');
  addParagraph(
    ctx,
    'El anexo resume metadatos, preparación de exportación, especificaciones de gráficos y listas técnicas derivadas del reporte. No incluye datos crudos completos.',
  );
  addTechnicalAnnexTables(ctx, report);
};

const addPythonScriptAppendix = (ctx: PdfLayoutContext, script: string, approved: boolean) => {
  const source = script.trimEnd();
  if (!source.trim()) return;

  const { doc, theme } = ctx;
  addNewPage(ctx);
  addSectionTitle(ctx, 'Anexo: script Python', approved ? 'script aprobado' : 'script generado');
  addParagraph(
    ctx,
    approved
      ? 'Script incluido como anexo operativo aprobado por revisión humana. El PDF no ejecuta el código; conserva la trazabilidad para revisión, reproducción y auditoría.'
      : 'Script incluido como anexo operativo generado, pendiente de aprobación humana. No debe ejecutarse sin revisión explícita.',
    { fontSize: 8.6 },
  );

  const blockX = theme.margin.left;
  const blockWidth = getContentWidth(ctx);
  const lineNumberWidth = 13;
  const codeX = blockX + lineNumberWidth + 6;
  const codeWidth = blockWidth - lineNumberWidth - 10;
  const headerHeight = 10;

  const drawCodeHeader = (continuation = false) => {
    ensureSpace(ctx, headerHeight + 4);
    doc.setFillColor(theme.colors.white);
    doc.setDrawColor(theme.colors.border);
    doc.rect(blockX, ctx.cursorY, blockWidth, headerHeight, 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(theme.colors.ink);
    doc.text(continuation ? 'limpieza_dataset.py (continuacion)' : 'limpieza_dataset.py', blockX + 4, ctx.cursorY + 6.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(theme.colors.faint);
    doc.text(approved ? 'Python - aprobado' : 'Python - pendiente HITL', blockX + blockWidth - 4, ctx.cursorY + 6.3, { align: 'right' });
    ctx.cursorY += headerHeight + 2;
  };

  const ensureCodeSpace = (neededHeight: number) => {
    if (ctx.cursorY + neededHeight > getPageHeight(doc) - theme.margin.bottom) {
      addNewPage(ctx);
      addSectionTitle(ctx, 'Script Python', 'continuación');
      drawCodeHeader(true);
    }
  };

  drawCodeHeader(false);

  source.replace(/\t/g, '  ').split(/\r?\n/).forEach((line, index) => {
    const wrapped = doc.splitTextToSize(line || ' ', codeWidth) as string[];
    const rowHeight = Math.max(4.4, wrapped.length * 4.4);
    ensureCodeSpace(rowHeight + 1.8);

    if (index % 2 === 0) {
      doc.setFillColor(theme.colors.panel);
      doc.rect(blockX, ctx.cursorY - 3.1, blockWidth, rowHeight + 1.8, 'F');
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(theme.colors.faint);
    doc.text(String(index + 1).padStart(3, '0'), blockX + lineNumberWidth - 2, ctx.cursorY, { align: 'right' });
    doc.setTextColor(theme.colors.ink);
    doc.text(wrapped, codeX, ctx.cursorY);
    ctx.cursorY += rowHeight + 1.8;
  });

  ctx.cursorY += 6;
};

export const generateDiagnosticPdfReport = ({
  diagnosticReport,
  pythonScript,
  pythonScriptApproved = false,
  save = defaultSave,
}: GenerateDiagnosticPdfReportParams): GenerateDiagnosticPdfReportResult => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const theme = createPdfTheme();
  const ctx: PdfLayoutContext = {
    doc,
    theme,
    cursorY: theme.margin.top + 8,
  };

  drawCover(ctx, diagnosticReport);

  addNewPage(ctx);
  addExecutiveSummary(ctx, diagnosticReport);

  ensureSpace(ctx, 20);
  addTechnicalProfile(ctx, diagnosticReport);
  addCharts(ctx, diagnosticReport);
  addRisksAndFindings(ctx, diagnosticReport);
  addRecommendations(ctx, diagnosticReport);
  addOptionalActions(ctx, diagnosticReport);
  addMethodologyLimitations(ctx, diagnosticReport);
  addTechnicalAnnex(ctx, diagnosticReport);
  if (pythonScript?.trim()) {
    addPythonScriptAppendix(ctx, pythonScript, pythonScriptApproved);
  }

  applyPageChrome(doc, theme);

  const filename = buildFilename(diagnosticReport);
  const pageCount = doc.getNumberOfPages();
  save(doc, filename);
  return { filename, pageCount };
};
