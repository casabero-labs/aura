import type { DiagnosticChartSpec } from './types';
import {
  PdfLayoutContext,
  ensureSpace,
  formatNumber,
  getContentWidth,
  truncateText,
} from './pdfLayout';

const palette = ['#a26e3c', '#4f6f91', '#b97627', '#587a8c', '#8b6f9b', '#7b7b55', '#9b2f2f', '#47745a'];

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatValue = (value: number, suffix?: string) => {
  if (suffix === '%') return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
  return `${formatNumber(value)}${suffix ?? ''}`;
};

const labelFor = (row: Record<string, string | number | boolean | null>, key: string) =>
  truncateText(row[key], 38) || 'Sin etiqueta';

const valueFor = (row: Record<string, string | number | boolean | null>, key: string) =>
  asNumber(row[key]);

const drawEmptyState = (ctx: PdfLayoutContext) => {
  const { doc, theme } = ctx;
  ensureSpace(ctx, 15);
  doc.setFillColor(theme.colors.panel);
  doc.setDrawColor(theme.colors.border);
  doc.roundedRect(theme.margin.left, ctx.cursorY, getContentWidth(ctx), 12, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(theme.colors.faint);
  doc.text('Sin datos', theme.margin.left + 4, ctx.cursorY + 8);
  ctx.cursorY += 17;
};

const drawChartShell = (ctx: PdfLayoutContext, chart: DiagnosticChartSpec, height: number) => {
  const { doc, theme } = ctx;
  ensureSpace(ctx, height);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(theme.colors.ink);
  doc.text(chart.title, theme.margin.left, ctx.cursorY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(theme.colors.faint);
  doc.text(truncateText(chart.description, 120), theme.margin.left, ctx.cursorY + 5);
  ctx.cursorY += 10;
};

export const drawHorizontalBarChart = (ctx: PdfLayoutContext, chart: DiagnosticChartSpec) => {
  const rows = chart.data.slice(0, 8);
  drawChartShell(ctx, chart, Math.max(32, rows.length * 8 + 18));
  if (rows.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const { doc, theme } = ctx;
  const labelWidth = 44;
  const valueWidth = 22;
  const barWidth = getContentWidth(ctx) - labelWidth - valueWidth - 8;
  const maxValue = Math.max(...rows.map((row) => valueFor(row, chart.xKey)), 1);

  rows.forEach((row, index) => {
    ensureSpace(ctx, 8);
    const value = valueFor(row, chart.xKey);
    const bar = Math.max(2, (value / maxValue) * barWidth);
    const y = ctx.cursorY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(theme.colors.muted);
    doc.text(labelFor(row, chart.yKey), theme.margin.left, y + 4);
    doc.setFillColor('#eee8df');
    doc.rect(theme.margin.left + labelWidth, y, barWidth, 4.5, 'F');
    doc.setFillColor(palette[index % palette.length]);
    doc.rect(theme.margin.left + labelWidth, y, bar, 4.5, 'F');
    doc.setTextColor(theme.colors.ink);
    doc.text(formatValue(value, chart.valueSuffix), theme.margin.left + labelWidth + barWidth + 4, y + 4);
    ctx.cursorY += 8;
  });
  ctx.cursorY += 4;
};

export const drawVerticalBarChart = (ctx: PdfLayoutContext, chart: DiagnosticChartSpec) => {
  const rows = chart.data.slice(0, 8);
  drawChartShell(ctx, chart, 62);
  if (rows.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const { doc, theme } = ctx;
  const width = getContentWidth(ctx);
  const chartHeight = 34;
  const baseY = ctx.cursorY + chartHeight;
  const barGap = 3;
  const barWidth = Math.max(8, (width - barGap * (rows.length - 1)) / rows.length);
  const maxValue = Math.max(...rows.map((row) => valueFor(row, chart.yKey)), 1);

  doc.setDrawColor(theme.colors.border);
  doc.line(theme.margin.left, baseY, theme.margin.left + width, baseY);

  rows.forEach((row, index) => {
    const value = valueFor(row, chart.yKey);
    const barHeight = Math.max(2, (value / maxValue) * chartHeight);
    const x = theme.margin.left + index * (barWidth + barGap);
    const y = baseY - barHeight;
    doc.setFillColor(palette[index % palette.length]);
    doc.rect(x, y, barWidth, barHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(theme.colors.ink);
    doc.text(formatValue(value, chart.valueSuffix), x + barWidth / 2, y - 2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(theme.colors.faint);
    doc.text(labelFor(row, chart.xKey), x + barWidth / 2, baseY + 5, { align: 'center', maxWidth: barWidth });
  });

  ctx.cursorY = baseY + 13;
};

export const drawDistributionList = (ctx: PdfLayoutContext, chart: DiagnosticChartSpec) => {
  const rows = chart.data.slice(0, 8);
  drawChartShell(ctx, chart, Math.max(30, rows.length * 8 + 16));
  if (rows.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const { doc, theme } = ctx;
  const total = rows.reduce((sum, row) => sum + valueFor(row, chart.yKey), 0) || 1;
  const width = getContentWidth(ctx);

  rows.forEach((row, index) => {
    ensureSpace(ctx, 8);
    const value = valueFor(row, chart.yKey);
    const share = (value / total) * 100;
    doc.setFillColor(palette[index % palette.length]);
    doc.circle(theme.margin.left + 2.5, ctx.cursorY + 2.5, 2.2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(theme.colors.muted);
    doc.text(labelFor(row, chart.xKey), theme.margin.left + 8, ctx.cursorY + 4);
    doc.setTextColor(theme.colors.ink);
    doc.text(`${formatValue(value, chart.valueSuffix)} · ${share.toFixed(1)}%`, theme.margin.left + width, ctx.cursorY + 4, { align: 'right' });
    ctx.cursorY += 8;
  });
  ctx.cursorY += 4;
};

export const drawChartTable = (ctx: PdfLayoutContext, chart: DiagnosticChartSpec) => {
  const rows = chart.data.slice(0, 8);
  drawChartShell(ctx, chart, Math.max(28, rows.length * 7 + 16));
  if (rows.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const { doc, theme } = ctx;
  const width = getContentWidth(ctx);
  const labelWidth = width * 0.56;
  rows.forEach((row, index) => {
    ensureSpace(ctx, 8);
    const y = ctx.cursorY;
    if (index % 2 === 0) {
      doc.setFillColor(theme.colors.panel);
      doc.rect(theme.margin.left, y - 2, width, 7, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(theme.colors.muted);
    doc.text(labelFor(row, chart.xKey), theme.margin.left + 2, y + 3, { maxWidth: labelWidth });
    doc.setTextColor(theme.colors.ink);
    doc.text(formatValue(valueFor(row, chart.yKey), chart.valueSuffix), theme.margin.left + width - 4, y + 3, { align: 'right' });
    const column = row.column === null || row.column === undefined ? '' : String(row.column);
    if (column) {
      doc.setTextColor(theme.colors.faint);
      doc.text(truncateText(column, 26), theme.margin.left + labelWidth + 4, y + 3);
    }
    ctx.cursorY += 8;
  });
  ctx.cursorY += 4;
};

export const drawChartSpec = (ctx: PdfLayoutContext, chart: DiagnosticChartSpec) => {
  if (chart.kind === 'bar') {
    drawVerticalBarChart(ctx, chart);
    return;
  }
  if (chart.kind === 'horizontal_bar') {
    drawHorizontalBarChart(ctx, chart);
    return;
  }
  if (chart.kind === 'pie') {
    drawDistributionList(ctx, chart);
    return;
  }
  drawChartTable(ctx, chart);
};
