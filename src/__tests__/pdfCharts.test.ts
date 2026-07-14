import { jsPDF } from 'jspdf';
import { describe, expect, it, vi } from 'vitest';
import { drawChartSpec } from '../services/diagnosticReport/pdfCharts';
import {
  PdfLayoutContext,
  createPdfTheme,
} from '../services/diagnosticReport/pdfLayout';
import type { DiagnosticChartSpec } from '../services/diagnosticReport';

const renderChartText = (chart: DiagnosticChartSpec) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const theme = createPdfTheme();
  const ctx: PdfLayoutContext = { doc, theme, cursorY: theme.margin.top + 8 };
  const captured: string[] = [];
  const spy = vi.spyOn(doc, 'text').mockImplementation(((text: string | string[]) => {
    if (Array.isArray(text)) captured.push(...text);
    else captured.push(text);
    return doc;
  }) as typeof doc.text);
  drawChartSpec(ctx, chart);
  spy.mockRestore();
  return captured;
};

describe('drawChartSpec con kind sobrescrito por el diagnóstico LLM', () => {
  it('distribución por categoría (base horizontal_bar → pie) usa conteos reales y etiquetas humanas', () => {
    const chart: DiagnosticChartSpec = {
      id: 'diagnosis_viz-category-distribution',
      title: 'Distribución de Problemas por Categoría',
      description: 'Distribución de problemas por categoría para entender el impacto.',
      kind: 'pie',
      data: [
        { category: 'Integridad y Estructura', count: 5 },
        { category: 'Higiene de Texto', count: 4 },
        { category: 'Validez y Lógica de Negocio', count: 5 },
        { category: 'Semántica y Seguridad', count: 1 },
      ],
      xKey: 'count',
      yKey: 'category',
      source: 'diagnosis',
    };

    const text = renderChartText(chart);
    const joined = text.join('\n');

    expect(joined).toContain('Integridad y Estructura');
    expect(joined).toContain('Semántica y Seguridad');
    expect(text.some((line) => /^5\b/.test(line) || line.includes('5 · '))).toBe(true);
    expect(text.some((line) => line.includes('· 33.3%'))).toBe(true);
    expect(text.some((line) => line.includes('· 6.7%'))).toBe(true);
    expect(text.some((line) => line.includes('0 · 0.0%'))).toBe(false);
  });

  it('problemas con mayor impacto (base table → horizontal_bar) usa porcentajes reales y nombres de regla', () => {
    const chart: DiagnosticChartSpec = {
      id: 'diagnosis_viz-top-affected-issues',
      title: 'Problemas con Mayor Impacto en Filas',
      description: 'Identificar los problemas que afectan más filas.',
      kind: 'horizontal_bar',
      data: [
        { id: 'sec-pii-ip_acceso', ruleName: 'Datos Sensibles (PII)', severity: 'critical', affectedPercentage: 100, column: 'ip_acceso' },
        { id: 'integrity-dupes', ruleName: 'Filas Duplicadas', severity: 'critical', affectedPercentage: 6.67, column: null },
        { id: 'logic-outlier-salario', ruleName: 'Outliers Extremos (IQR 3x)', severity: 'warning', affectedPercentage: 13.33, column: 'salario' },
      ],
      xKey: 'ruleName',
      yKey: 'affectedPercentage',
      valueSuffix: '%',
      source: 'diagnosis',
    };

    const text = renderChartText(chart);

    expect(text).toContain('Datos Sensibles (PII)');
    expect(text).toContain('Filas Duplicadas');
    expect(text).toContain('100.0%');
    expect(text).toContain('13.3%');
    expect(text).toContain('6.67%');
    expect(text).not.toContain('0.00%');
  });

  it('columnas con nulos (base horizontal_bar → table) usa nombres de columna y porcentaje real', () => {
    const chart: DiagnosticChartSpec = {
      id: 'diagnosis_viz-top-null-columns',
      title: 'Columnas con Nulos',
      description: 'Identificar columnas con más nulos para limpieza.',
      kind: 'table',
      data: [
        { column: 'edad', nullCount: 1, nullPercentage: 6.67 },
        { column: 'email', nullCount: 1, nullPercentage: 6.67 },
        { column: 'estado', nullCount: 1, nullPercentage: 6.67 },
        { column: 'nombre', nullCount: 1, nullPercentage: 6.67 },
      ],
      xKey: 'nullPercentage',
      yKey: 'column',
      valueSuffix: '%',
      source: 'diagnosis',
    };

    const text = renderChartText(chart);

    expect(text).toContain('edad');
    expect(text).toContain('nombre');
    expect(text).toContain('6.67%');
    expect(text).not.toContain('0.00%');
  });

  it('barra vertical (severidad) conserva conteos reales y etiquetas humanas', () => {
    const chart: DiagnosticChartSpec = {
      id: 'diagnosis_viz-severity-critical',
      title: 'Problemas Críticos por Severidad',
      description: 'Visualizar los problemas críticos para priorizar el remedio.',
      kind: 'bar',
      data: [
        { severity: 'critical', count: 4 },
        { severity: 'warning', count: 11 },
      ],
      xKey: 'severity',
      yKey: 'count',
      source: 'diagnosis',
    };

    const text = renderChartText(chart);

    expect(text).toContain('Crítica');
    expect(text).toContain('Advertencia');
    expect(text).toContain('4');
    expect(text).toContain('11');
    expect(text).not.toContain('0.00%');
  });

  it('mantiene 0 real cuando el valor es genuinamente cero', () => {
    const chart: DiagnosticChartSpec = {
      id: 'zero-real',
      title: 'Conteo real cero',
      description: 'Categoría sin hallazgos.',
      kind: 'pie',
      data: [
        { category: 'Sin hallazgos', count: 0 },
        { category: 'Con hallazgos', count: 2 },
      ],
      xKey: 'count',
      yKey: 'category',
      source: 'diagnosis',
    };

    const text = renderChartText(chart);

    expect(text).toContain('Sin hallazgos');
    expect(text.some((line) => line.includes('0 · 0.0%'))).toBe(true);
  });
});
