import { jsPDF } from 'jspdf';
import { canonicalJson, sha256hex } from '../../contracts/llm';
import type { DiagnosticReport } from './types';
import { drawChartSpec } from './pdfCharts';
import {
  actionTypeLabel,
  addFindingsTable,
} from './pdfTables';
import {
  PdfLayoutContext,
  addBulletList,
  addGovernanceCallout,
  addKpiGrid,
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
  doc.text('Informe diagnóstico', theme.margin.left, 48);
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
  doc.text('Score no modificado por IA. El diagnóstico contextualiza evidencia, no recalcula la calificación.', theme.margin.left, pageHeight - 48);

  ctx.cursorY = pageHeight - theme.margin.bottom;
};

const addEvidenceCounts = (ctx: PdfLayoutContext, title: string, counts: Record<string, number>) => {
  const entries = Object.entries(counts);
  const translateCountLabel = (key: string) => {
    if (key === 'critical') return 'críticos';
    if (key === 'warning') return 'advertencias';
    if (key === 'info') return 'informativos';
    if (key === 'good') return 'correctos';
    return key;
  };
  addParagraph(
    ctx,
    entries.length === 0
      ? `${title}: sin datos.`
      : `${title}: ${entries.map(([key, value]) => `${translateCountLabel(key)}: ${formatNumber(value)}`).join(' · ')}`,
    { fontSize: 8.6 },
  );
};

const addTraceCertificate = (ctx: PdfLayoutContext, rows: Array<[string, string]>) => {
  const { doc, theme } = ctx;
  const labelWidth = 35;
  rows.forEach(([label, value]) => {
    const valueX = theme.margin.left + labelWidth;
    const valueWidth = getPageWidth(doc) - theme.margin.right - valueX;
    const valueFont = /hash|sha|receipt|envelope/i.test(label) ? 'courier' : 'helvetica';
    doc.setFont(valueFont, 'normal');
    doc.setFontSize(6.7);
    const valueLines = doc.splitTextToSize(value || 'no disponible', valueWidth) as string[];
    const rowHeight = Math.max(5, valueLines.length * 3.6 + 1.2);
    ensureSpace(ctx, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.7);
    doc.setTextColor(theme.colors.faint);
    doc.text(label, theme.margin.left, ctx.cursorY);
    doc.setFont(valueFont, 'normal');
    doc.setTextColor(theme.colors.muted);
    doc.text(valueLines, valueX, ctx.cursorY);
    ctx.cursorY += rowHeight;
  });
  ctx.cursorY += 2;
};

const addTechnicalProfile = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Perfil técnico base', 'evidencia determinista');
  addKpiGrid(ctx, [
    { label: 'Delimitador', value: report.metadata.delimiter },
    { label: 'Duplicados', value: formatNumber(report.evidenceBase.duplicateRows) },
    { label: 'Críticos', value: formatNumber(report.evidenceBase.criticalIssues) },
    { label: 'Advertencias', value: formatNumber(report.evidenceBase.warningIssues) },
  ]);
  addEvidenceCounts(ctx, 'Severidad', report.evidenceBase.severityCounts);
  addEvidenceCounts(ctx, 'Categoría', report.evidenceBase.categoryCounts);
};

const addCharts = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  addSectionTitle(ctx, 'Gráficos estadísticos reproducibles', 'vectores PDF');
  addParagraph(
    ctx,
    'Vectores PDF reproducibles derivados del reporte, sin imágenes externas.',
    { fontSize: 8.2 },
  );
  if (report.chartSpecs.length === 0) {
    addParagraph(ctx, 'Sin especificaciones de gráficos disponibles para este reporte.', { color: ctx.theme.colors.faint });
    return;
  }
  report.chartSpecs.slice(0, 6).forEach((chart) => {
    drawChartSpec(ctx, chart);
  });
};

const addExecutiveSummary = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const presentation = buildDiagnosticPresentation(report);
  addSectionTitle(ctx, 'Resumen ejecutivo', presentation.sourceLabel);
  addGovernanceCallout(ctx, presentation.decision.title, [presentation.decision.body]);
  addKpiGrid(ctx, presentation.metrics);
  addParagraph(ctx, presentation.executiveSummary);
  if (report.diagnosisSummary.inputReceiptRef) {
    addSectionTitle(ctx, 'Trazabilidad de ejecución LLM');
    addTraceCertificate(ctx, [
      ['Método', report.diagnosisSummary.inputMode ?? 'n/d'],
      ['Proveedor / modelo', `${report.diagnosisSummary.provider ?? 'n/d'} / ${report.diagnosisSummary.model ?? 'n/d'}`],
      ['Prompt hash', report.diagnosisSummary.promptHash ?? 'n/d'],
      ['Input hash', report.diagnosisSummary.inputHash ?? 'n/d'],
      ['Receipt hash', report.diagnosisSummary.inputReceiptRef],
      ['Evidence envelope', report.diagnosisSummary.evidenceEnvelopeRef ?? 'n/d'],
      ['Fecha', report.diagnosisSummary.executionCompletedAt ?? 'n/d'],
      ['Validación', report.diagnosisSummary.executionValidationStatus ?? 'n/d'],
    ]);
  }

  if (presentation.topRisks.length > 0) {
    addSectionTitle(ctx, 'Riesgos principales');
    addBulletList(ctx, presentation.topRisks.map((risk) => `${risk.title}: ${risk.evidenceSummary}`), 5);
  }

  addSectionTitle(ctx, 'Alcance de esta lectura');
  addBulletList(ctx, [
    'El score pertenece al motor determinista y no fue modificado por el modelo.',
    'La interpretación asistida no sustituye la evidencia ni autoriza correcciones automáticas.',
    ...report.diagnosisSummary.limitations.slice(0, 2),
  ], 4);
};

const addRisksAndFindings = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const confirmed = report.findingGroups.confirmedRisks;
  const visibleCount = Math.min(6, confirmed.length);
  addSectionTitle(ctx, 'Hallazgos confirmados principales', 'evidencia y alcance');
  addParagraph(ctx, `Se presentan ${visibleCount} de ${confirmed.length} hallazgos confirmados, priorizados por severidad. El detalle completo permanece en JSON y CSV; los falsos positivos documentados no aparecen aquí.`);
  addFindingsTable(ctx, confirmed, { maxRows: 6 });
};

const addRecommendations = (ctx: PdfLayoutContext, report: DiagnosticReport) => {
  const reportContentHash = sha256hex(canonicalJson(report));
  addSectionTitle(ctx, 'Revisión antes de corregir', 'decisión humana');
  addParagraph(ctx, 'Estos casos son posibles falsos positivos o dependen del contexto. No modifican el score y no deben corregirse automáticamente.');
  addBulletList(ctx, report.findingGroups.possibleFalsePositiveCandidates.slice(0, 3).map((finding) =>
    `${finding.title}. ${finding.evidenceSummary} Decisión: revisar humanamente; no modifica el score.`,
  ), 3);
  addSectionTitle(ctx, 'Plan de acción');
  addBulletList(ctx, report.recommendations.map((recommendation) => [
    `${recommendation.priority === 'high' ? 'Alta' : recommendation.priority === 'medium' ? 'Media' : 'Baja'} prioridad`,
    actionTypeLabel(recommendation.actionType),
    recommendation.title,
    recommendation.rationale,
  ].join(' - ')), 5);
  addParagraph(
    ctx,
    'Remediación opcional: el informe puede cerrarse sin script; cualquier corrección se realiza sobre una copia y con revisión humana.',
    { fontSize: 8.2 },
  );
  addSectionTitle(ctx, 'Certificado de trazabilidad');
  addTraceCertificate(ctx, [
    ['Run ID', report.metadata.runId ?? 'no disponible'],
    ['Report ID', report.metadata.reportId],
    ['SHA-256 dataset', report.metadata.datasetSha256 ?? 'no disponible'],
    ['SHA-256 reporte', reportContentHash],
    ['Receipt hash', report.metadata.diagnosisReceiptHash ?? report.diagnosisSummary.inputReceiptRef ?? 'no disponible'],
    ['Modelo solicitado', report.diagnosisSummary.executionReceipt?.requestedModel ?? report.diagnosisSummary.model ?? 'no disponible'],
    ['Modelo observado', report.diagnosisSummary.executionReceipt?.observedModel ?? 'no observado'],
    ['Método', report.diagnosisSummary.inputMode ?? 'no disponible'],
  ]);
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
  doc.setProperties({
    title: `AURA - Informe diagnóstico - ${diagnosticReport.metadata.fileName ?? diagnosticReport.metadata.reportId}`,
    subject: `Reporte verificable ${diagnosticReport.metadata.reportId}`,
    author: 'AURA',
    keywords: [
      'calidad de datos',
      diagnosticReport.metadata.reportId,
      diagnosticReport.metadata.runId,
      diagnosticReport.metadata.datasetSha256,
      diagnosticReport.metadata.diagnosisReceiptHash,
    ].filter((value): value is string => Boolean(value)).join(', '),
    creator: 'AURA',
  });
  const theme = createPdfTheme();
  const ctx: PdfLayoutContext = {
    doc,
    theme,
    cursorY: theme.margin.top + 8,
  };

  drawCover(ctx, diagnosticReport);

  addNewPage(ctx);
  const executivePage = doc.getCurrentPageInfo().pageNumber;
  addExecutiveSummary(ctx, diagnosticReport);

  if (doc.getCurrentPageInfo().pageNumber === executivePage) {
    addNewPage(ctx);
  } else {
    ctx.cursorY += 6;
  }
  addTechnicalProfile(ctx, diagnosticReport);
  addCharts(ctx, diagnosticReport);

  addNewPage(ctx);
  addRisksAndFindings(ctx, diagnosticReport);

  addNewPage(ctx);
  addRecommendations(ctx, diagnosticReport);
  if (pythonScript?.trim()) {
    addPythonScriptAppendix(ctx, pythonScript, pythonScriptApproved);
  }

  applyPageChrome(doc, theme);

  const filename = buildFilename(diagnosticReport);
  const pageCount = doc.getNumberOfPages();
  save(doc, filename);
  return { filename, pageCount };
};
