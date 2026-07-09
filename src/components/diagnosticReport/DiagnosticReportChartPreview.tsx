import * as d3 from 'd3';
import type { DiagnosticChartSpec } from '../../services/diagnosticReport';

interface DiagnosticReportChartPreviewProps {
  chartSpecs: DiagnosticChartSpec[];
}

const sourceLabels: Record<DiagnosticChartSpec['source'], string> = {
  audit_report: 'AuditReport',
  column_stats: 'columnStats',
  diagnosis: 'Diagnóstico',
};

const formatValue = (value: string | number | boolean | null | undefined, suffix = '') => {
  if (value === null || value === undefined) return 'Sin dato';
  if (typeof value === 'number') return `${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;
  return String(value);
};

const numericValue = (value: string | number | boolean | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const getSeriesValue = (chart: DiagnosticChartSpec, row: Record<string, string | number | boolean | null>) => {
  const primary = numericValue(row[chart.yKey]);
  if (primary > 0) return primary;
  return numericValue(row[chart.xKey]);
};

const getSeriesLabel = (chart: DiagnosticChartSpec, row: Record<string, string | number | boolean | null>) => {
  const labelKey = chart.kind === 'horizontal_bar' ? chart.yKey : chart.xKey;
  return formatValue(row[labelKey]);
};

const ChartRows = ({ chart }: { chart: DiagnosticChartSpec }) => {
  const maxValue = Math.max(1, ...chart.data.map((row) => getSeriesValue(chart, row)));
  const x = d3.scaleLinear().domain([0, maxValue]).range([4, 100]);

  if (chart.kind === 'table') {
    const headers = Array.from(new Set(chart.data.flatMap((row) => Object.keys(row))));
    return (
      <div className="diagnostic-chart-table-wrap">
        <table className="diagnostic-chart-table">
          <thead>
            <tr>
              {headers.map((header) => <th key={header}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {chart.data.map((row, index) => (
              <tr key={`${chart.id}-${index}`}>
                {headers.map((header) => (
                  <td key={header}>{formatValue(row[header], header === chart.yKey ? chart.valueSuffix : '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`diagnostic-chart-bars diagnostic-chart-bars--${chart.kind}`}>
      {chart.data.length === 0 && <p className="diagnostic-report-empty">Sin datos para previsualizar.</p>}
      {chart.data.map((row, index) => {
        const value = getSeriesValue(chart, row);
        const width = Math.round(x(value));
        return (
          <div className="diagnostic-chart-row" key={`${chart.id}-${index}`}>
            <div className="diagnostic-chart-row-head">
              <span>{getSeriesLabel(chart, row)}</span>
              <strong>{formatValue(value, chart.valueSuffix)}</strong>
            </div>
            <div className="diagnostic-chart-track" aria-hidden="true">
              <span className="diagnostic-chart-fill" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DiagnosticReportChartPreview = ({ chartSpecs }: DiagnosticReportChartPreviewProps) => (
  <section className="diagnostic-report-section" data-testid="diagnostic-report-chart-specs">
    <div className="diagnostic-report-section-head">
      <p className="sec-eye">visualización reproducible</p>
      <h3>Vista de gráficos</h3>
    </div>
    <div className="diagnostic-chart-grid">
      {chartSpecs.map((chart) => (
        <article className="diagnostic-chart-card" key={chart.id}>
          <div className="diagnostic-chart-card-head">
            <div>
              <span className="diagnostic-report-kicker">{chart.id}</span>
              <h4>{chart.title}</h4>
            </div>
            <span className="diagnostic-report-badge">{sourceLabels[chart.source]}</span>
          </div>
          <p>{chart.description}</p>
          <ChartRows chart={chart} />
        </article>
      ))}
    </div>
  </section>
);

export default DiagnosticReportChartPreview;
