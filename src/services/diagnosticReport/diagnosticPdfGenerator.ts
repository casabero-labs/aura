import jsPDF from 'jspdf';
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

const drawCover = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const { doc, theme } = ctx;
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const contentWidth = getContentWidth(ctx);
  const presentation = buildDiagnosticPresentation(report);

  doc.setFillColor(theme.colors.panel);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(theme.colors.accent);
  doc.text('AURA', theme.margin.left, 38);

  doc.setFontSize(28);
  doc.setTextColor(theme.colors.ink);
  doc.text('Informe diagnostico', theme.margin.left, 58);
  doc.text('de calidad del dato', theme.margin.left, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(theme.colors.muted);
  doc.text(truncateText(report.metadata.fileName ?? 'Dataset sin nombre de archivo', 88), theme.margin.left, 84);

  const decisionY = 108;
  doc.setFillColor(theme.colors.white);
  doc.setDrawColor(theme.colors.border);
  doc.roundedRect(theme.margin.left, decisionY, contentWidth, 64, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.accent);
  doc.text(presentation.decision.eyebrow.toUpperCase(), theme.margin.left + 8, decisionY + 12);
  doc.setFontSize(15);
  doc.setTextColor(theme.colors.ink);
  doc.text(doc.splitTextToSize(presentation.decision.title, contentWidth - 72), theme.margin.left + 8, decisionY + 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(theme.colors.muted);
  doc.text(doc.splitTextToSize(presentation.decision.body, contentWidth - 72), theme.margin.left + 8, decisionY + 39);

  const scoreX = pageWidth - theme.margin.right - 48;
  doc.setDrawColor(theme.colors.accentSoft);
  doc.roundedRect(scoreX, decisionY + 10, 40, 38, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.setTextColor(report.metadata.scoreBase >= 80 ? theme.colors.good : report.metadata.scoreBase >= 50 ? theme.colors.warning : theme.colors.critical);
  doc.text(`${report.metadata.scoreBase}`, scoreX + 20, decisionY + 27, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(theme.colors.faint);
  doc.text('score base', scoreX + 20, decisionY + 35, { align: 'center' });

  const kpis = [
    ['Fecha', report.metadata.generatedAt],
    ['Fingerprint', report.metadata.sourceDatasetFingerprint],
    ['Filas / columnas', `${formatNumber(report.metadata.rowCount)} / ${formatNumber(report.metadata.colCount)}`],
    ['Estado diagnóstico', formatDiagnosticStatusLabel(report.status.diagnosticStatus)],
  ];

  let y = 198;
  kpis.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.colors.accent);
    doc.text(label, theme.margin.left + 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(theme.colors.ink);
    doc.text(truncateText(value, 92), theme.margin.left + 62, y);
    y += 11;
  });

  doc.setFillColor(theme.colors.white);
  doc.setDrawColor(theme.colors.border);
  doc.roundedRect(theme.margin.left, pageHeight - 74, contentWidth, 28, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(theme.colors.ink);
  doc.text('Gobernanza del score', theme.margin.left + 6, pageHeight - 61);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.muted);
  doc.text('Score no modificado por IA. El diagnostico contextualiza evidencia, no recalcula la calificacion.', theme.margin.left + 6, pageHeight - 53);

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

export const generateDiagnosticPdfReport = ({
  diagnosticReport,
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

  applyPageChrome(doc, theme);

  const filename = buildFilename(diagnosticReport);
  const pageCount = doc.getNumberOfPages();
  save(doc, filename);
  return { filename, pageCount };
};
