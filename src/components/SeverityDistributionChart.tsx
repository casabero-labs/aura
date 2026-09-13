import * as d3 from 'd3';
import { IssueSeverity } from '../types';

interface SeverityDistributionChartProps {
  critical: number;
  warning: number;
  info: number;
}

const severityRows = [
  { key: IssueSeverity.CRITICAL, label: 'Crítico', tone: 'critical' },
  { key: IssueSeverity.WARNING, label: 'Advertencia', tone: 'warning' },
  { key: IssueSeverity.INFO, label: 'Informativo', tone: 'info' },
] as const;

const SeverityDistributionChart = ({ critical, warning, info }: SeverityDistributionChartProps) => {
  const counts: Record<IssueSeverity.CRITICAL | IssueSeverity.WARNING | IssueSeverity.INFO, number> = {
    [IssueSeverity.CRITICAL]: critical,
    [IssueSeverity.WARNING]: warning,
    [IssueSeverity.INFO]: info,
  };
  const max = Math.max(1, d3.max(severityRows, (row) => counts[row.key]) ?? 1);
  const x = d3.scaleLinear().domain([0, max]).range([0, 168]);

  return (
    <div className="severity-distribution" data-testid="severity-distribution-chart">
      {severityRows.map((row, index) => {
        const count = counts[row.key];
        return (
          <div className="severity-distribution-row" key={row.key}>
            <span className="severity-distribution-label">{row.label}</span>
            <svg
              className="severity-distribution-svg"
              viewBox="0 0 190 18"
              role="img"
              aria-label={`${row.label}: ${count}`}
            >
              <rect x="0" y="6" width="168" height="6" rx="3" className="severity-distribution-track" />
              <rect
                x="0"
                y="6"
                width={x(count)}
                height="6"
                rx="3"
                className={`severity-distribution-fill severity-distribution-fill--${row.tone}`}
              />
              <text x="188" y="12" textAnchor="end" className="severity-distribution-count">
                {count}
              </text>
            </svg>
            {index < severityRows.length - 1 && <span className="severity-distribution-rule" />}
          </div>
        );
      })}
    </div>
  );
};

export default SeverityDistributionChart;
