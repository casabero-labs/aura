import { jsPDF } from 'jspdf';

export interface PdfTheme {
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  colors: {
    ink: string;
    muted: string;
    faint: string;
    border: string;
    panel: string;
    accent: string;
    accentSoft: string;
    critical: string;
    warning: string;
    info: string;
    good: string;
    white: string;
  };
}

export interface PdfLayoutContext {
  doc: jsPDF;
  theme: PdfTheme;
  cursorY: number;
}

export interface KpiItem {
  label: string;
  value: string;
  note?: string;
}

export const createPdfTheme = (): PdfTheme => ({
  margin: {
    top: 22,
    right: 18,
    bottom: 22,
    left: 18,
  },
  colors: {
    ink: '#1e1e1c',
    muted: '#4a4540',
    faint: '#8a857e',
    border: '#d9d4ca',
    panel: '#f5f1e8',
    accent: '#3a3632',
    accentSoft: '#ebe6db',
    critical: '#8f302b',
    warning: '#a66a24',
    info: '#5f6b64',
    good: '#456554',
    white: '#faf8f4',
  },
});

export const getPageWidth = (doc: jsPDF) => doc.internal.pageSize.getWidth();

export const getPageHeight = (doc: jsPDF) => doc.internal.pageSize.getHeight();

export const getContentWidth = (ctx: PdfLayoutContext) =>
  getPageWidth(ctx.doc) - ctx.theme.margin.left - ctx.theme.margin.right;

export const truncateText = (value: unknown, maxLength = 140) => {
  const text = value === undefined || value === null ? '' : String(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString('es-ES') : '0';

export const formatPercent = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(value >= 10 ? 1 : 2)}%` : '0%';

export const addNewPage = (ctx: PdfLayoutContext) => {
  ctx.doc.addPage();
  ctx.cursorY = ctx.theme.margin.top + 8;
};

export const ensureSpace = (ctx: PdfLayoutContext, neededHeight: number) => {
  const pageHeight = getPageHeight(ctx.doc);
  if (ctx.cursorY + neededHeight > pageHeight - ctx.theme.margin.bottom) {
    addNewPage(ctx);
  }
};

export const addPageHeader = (doc: jsPDF, theme: PdfTheme, title = 'AURA - Informe diagnóstico') => {
  const pageWidth = getPageWidth(doc);
  doc.setDrawColor(theme.colors.border);
  doc.setLineWidth(0.2);
  doc.line(theme.margin.left, 13, pageWidth - theme.margin.right, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.accent);
  doc.text('AURA', theme.margin.left, 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(theme.colors.faint);
  doc.text(title, pageWidth - theme.margin.right, 9.5, { align: 'right' });
};

export const addPageFooter = (doc: jsPDF, theme: PdfTheme, pageNumber: number, pageCount: number) => {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  doc.setDrawColor(theme.colors.border);
  doc.setLineWidth(0.2);
  doc.line(theme.margin.left, pageHeight - 16, pageWidth - theme.margin.right, pageHeight - 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.faint);
  doc.text('AURA - Informe diagnóstico', theme.margin.left, pageHeight - 10);
  doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - theme.margin.right, pageHeight - 10, { align: 'right' });
};

export const applyPageChrome = (doc: jsPDF, theme: PdfTheme) => {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    addPageHeader(doc, theme);
    addPageFooter(doc, theme, page, pageCount);
  }
};

export const addSectionTitle = (ctx: PdfLayoutContext, title: string, eyebrow?: string) => {
  ensureSpace(ctx, eyebrow ? 22 : 16);
  const { doc, theme } = ctx;
  if (eyebrow) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(theme.colors.accent);
    doc.text(eyebrow.toUpperCase(), theme.margin.left, ctx.cursorY);
    ctx.cursorY += 5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(theme.colors.ink);
  doc.text(title, theme.margin.left, ctx.cursorY);
  const titleWidth = doc.getTextWidth(title);
  const lineStart = Math.min(theme.margin.left + titleWidth + 8, getPageWidth(doc) - theme.margin.right - 24);
  doc.setDrawColor(theme.colors.border);
  doc.setLineWidth(0.3);
  doc.line(lineStart, ctx.cursorY - 1.5, getPageWidth(doc) - theme.margin.right, ctx.cursorY - 1.5);
  ctx.cursorY += 11;
};

export const addParagraph = (ctx: PdfLayoutContext, text: string, options: { fontSize?: number; color?: string; leading?: number } = {}) => {
  const { doc, theme } = ctx;
  const fontSize = options.fontSize ?? 9.5;
  const leading = options.leading ?? 5;
  const lines = doc.splitTextToSize(text || 'Sin información disponible.', getContentWidth(ctx));
  for (const line of lines) {
    ensureSpace(ctx, leading + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(options.color ?? theme.colors.muted);
    doc.text(line, theme.margin.left, ctx.cursorY);
    ctx.cursorY += leading;
  }
  ctx.cursorY += 3;
};

export const addBulletList = (ctx: PdfLayoutContext, items: string[], maxItems = 8) => {
  const visibleItems = items.length > 0 ? items.slice(0, maxItems) : ['Sin limitaciones registradas.'];
  const { doc, theme } = ctx;
  for (const item of visibleItems) {
    const lines = doc.splitTextToSize(truncateText(item, 260), getContentWidth(ctx) - 6);
    ensureSpace(ctx, lines.length * 4.8 + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.7);
    doc.setTextColor(theme.colors.muted);
    doc.text('•', theme.margin.left + 1, ctx.cursorY);
    doc.text(lines, theme.margin.left + 6, ctx.cursorY);
    ctx.cursorY += lines.length * 4.8 + 2;
  }
  ctx.cursorY += 2;
};

export const addKpiGrid = (ctx: PdfLayoutContext, items: KpiItem[]) => {
  ensureSpace(ctx, 34);
  const { doc, theme } = ctx;
  const gap = 4;
  const columns = 4;
  const width = (getContentWidth(ctx) - gap * (columns - 1)) / columns;
  const rowHeight = 24;
  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = theme.margin.left + col * (width + gap);
    const y = ctx.cursorY + row * (rowHeight + gap);
    doc.setFillColor(theme.colors.white);
    doc.setDrawColor(theme.colors.border);
    doc.rect(x, y, width, rowHeight, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(theme.colors.ink);
    doc.text(truncateText(item.value, 18), x + 4, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(theme.colors.faint);
    doc.text(truncateText(item.label, 30), x + 4, y + 15);
    if (item.note) {
      doc.setFontSize(6.8);
      doc.text(truncateText(item.note, 34), x + 4, y + 20);
    }
  });
  const rows = Math.ceil(items.length / columns);
  ctx.cursorY += rows * rowHeight + Math.max(0, rows - 1) * gap + 8;
};

export const addGovernanceCallout = (ctx: PdfLayoutContext, title: string, items: string[]) => {
  const { doc, theme } = ctx;
  const width = getContentWidth(ctx);
  const itemLines = items.map((item) => doc.splitTextToSize(item, width - 12));
  const height = 14 + itemLines.reduce((sum, lines) => sum + Math.max(1, lines.length) * 4.8 + 1, 0);
  ensureSpace(ctx, height + 4);
  doc.setFillColor(theme.colors.white);
  doc.setDrawColor(theme.colors.border);
  doc.rect(theme.margin.left, ctx.cursorY, width, height, 'FD');
  doc.setDrawColor(theme.colors.accent);
  doc.setLineWidth(0.8);
  doc.line(theme.margin.left, ctx.cursorY, theme.margin.left, ctx.cursorY + height);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(theme.colors.ink);
  doc.text(title, theme.margin.left + 5, ctx.cursorY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(theme.colors.muted);
  let y = ctx.cursorY + 13;
  itemLines.forEach((lines) => {
    doc.text('-', theme.margin.left + 5, y);
    doc.text(lines, theme.margin.left + 9, y);
    y += lines.length * 4.8 + 1;
  });
  ctx.cursorY += height + 8;
};
