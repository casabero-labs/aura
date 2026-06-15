import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { BenchmarkResult } from '../types';

// =============================================================================
// Theme helpers — reads CSS variables from computed styles
// =============================================================================

const getCSSVar = (name: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const getThemeColors = () => ({
  bg: getCSSVar('--bg') || '#0D0D0C',
  surface: getCSSVar('--surface') || '#141413',
  ink: getCSSVar('--ink') || '#ECE6DA',
  ink2: getCSSVar('--ink2') || '#B8B0A4',
  ink3: getCSSVar('--ink3') || '#6A645C',
  border: getCSSVar('--border') || 'rgba(236,230,218,0.08)',
  borderStrong: getCSSVar('--border-strong') || 'rgba(236,230,218,0.15)',
  error: getCSSVar('--error') || '#D45A4A',
  success: getCSSVar('--success') || '#5A9C7A',
});

// =============================================================================
// Color palette for models
// =============================================================================

const MODEL_COLORS: Record<string, string> = {
  'WebLLM': '#ECE6DA',
  'Gemini': '#7B9FEF',
  'Groq': '#F5A623',
  'DeepSeek': '#6BCB77',
  'OpenRouter': '#C084FC',
  'MiniMax': '#F472B6',
};

const getModelColor = (provider: string): string => {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (provider.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return getCSSVar('--ink2') || '#B8B0A4';
};

// =============================================================================
// Chart 1: Horizontal Bar Chart — Composite Score by Model
// =============================================================================

interface ScoreBarChartProps {
  results: BenchmarkResult[];
  width?: number;
  height?: number;
}

export const ScoreBarChart: React.FC<ScoreBarChartProps> = ({
  results,
  width = 520,
  height = 320,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const completed = results
      .filter(r => r.status === 'completed' && r.compositeScore != null)
      .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

    if (completed.length === 0) return;

    const margin = { top: 20, right: 60, bottom: 30, left: 140 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerW]);

    const y = d3.scaleBand()
      .domain(completed.map((r, i) => `${i}`))
      .range([0, innerH])
      .padding(0.3);

    const colors = getThemeColors();

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${(d as number * 100).toFixed(0)}`))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text').attr('fill', colors.ink3).attr('font-size', '10px'));

    // Y axis labels
    g.append('g')
      .call(d3.axisLeft(y).tickFormat((d, i) => {
        const r = completed[parseInt(d as string)];
        return `${r.provider} · ${r.model.split('-').slice(0, 2).join('-')}`;
      }))
      .call(sel => sel.select('.domain').attr('stroke', 'none'))
      .call(sel => sel.selectAll('.tick line').attr('stroke', 'none'))
      .call(sel => sel.selectAll('.tick text')
        .attr('fill', colors.ink2)
        .attr('font-size', '10px')
        .attr('font-family', 'var(--mono)'));

    // Bars
    g.selectAll('.score-bar')
      .data(completed)
      .join('rect')
      .attr('class', 'score-bar')
      .attr('x', 0)
      .attr('y', (_, i) => y(`${i}`)!)
      .attr('width', 0)
      .attr('height', y.bandwidth())
      .attr('fill', d => getModelColor(d.provider))
      .attr('rx', 0)
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr('width', d => x(d.compositeScore ?? 0));

    // Score labels
    g.selectAll('.score-label')
      .data(completed)
      .join('text')
      .attr('class', 'score-label')
      .attr('x', d => x(d.compositeScore ?? 0) + 6)
      .attr('y', (_, i) => y(`${i}`)! + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('fill', colors.ink)
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('font-family', 'var(--mono)')
      .text(d => (d.compositeScore ?? 0).toFixed(3));
  }, [results, width, height]);

  useEffect(() => { draw(); }, [draw]);

  return <svg ref={svgRef} style={{ display: 'block', maxWidth: '100%' }} />;
};

// =============================================================================
// Chart 2: Radar Chart — Multi-dimensional Metrics
// =============================================================================

interface RadarChartProps {
  results: BenchmarkResult[];
  width?: number;
  height?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  results,
  width = 400,
  height = 360,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const completed = results.filter(r => r.status === 'completed');
    if (completed.length === 0) return;

    const margin = 50;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - margin;

    const dimensions = [
      { key: 'contractCompliance', label: 'Contrato', accessor: (r: BenchmarkResult) => (r.contractCompliance ?? r.formatCompliance) ? 1 : 0 },
      { key: 'hallucination', label: 'Anti-Hall.', accessor: (r: BenchmarkResult) => {
        const cols = Object.keys(r.hallucinatedColumns || []).length;
        return Math.max(0, 1 - cols * 0.2);
      }},
      { key: 'latency', label: 'Latencia', accessor: (r: BenchmarkResult) => {
        const maxLat = Math.max(...completed.map(c => c.latencyMs), 1);
        return 1 - (r.latencyMs / maxLat);
      }},
      { key: 'tokens', label: 'Tokens/s', accessor: (r: BenchmarkResult) => {
        const maxTok = Math.max(...completed.map(c => c.tokensPerSecond), 1);
        return Math.min(1, r.tokensPerSecond / maxTok);
      }},
      { key: 'script', label: 'Script', accessor: (r: BenchmarkResult) => r.pythonScriptIncluded ? 1 : 0 },
      { key: 'claims', label: 'Claims', accessor: (r: BenchmarkResult) => {
        const maxClaims = Math.max(...completed.map(c => c.unsupportedClaims), 1);
        return 1 - (r.unsupportedClaims / (maxClaims + 1));
      }},
    ];

    const angleSlice = (Math.PI * 2) / dimensions.length;
    const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

    const colors = getThemeColors();
    const g = svg.attr('width', width).attr('height', height).append('g')
      .attr('transform', `translate(${cx},${cy})`);

    // Grid circles
    const levels = 5;
    for (let level = 1; level <= levels; level++) {
      const r = (radius / levels) * level;
      g.append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', colors.border)
        .attr('stroke-width', level === levels ? 1 : 0.5);
    }

    // Axis lines
    dimensions.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(angle) * radius)
        .attr('y2', Math.sin(angle) * radius)
        .attr('stroke', colors.borderStrong)
        .attr('stroke-width', 0.5);

      // Labels
      const labelX = Math.cos(angle) * (radius + 20);
      const labelY = Math.sin(angle) * (radius + 20);
      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', colors.ink3)
        .attr('font-size', '9px')
        .attr('font-family', 'var(--mono)')
        .text(dim.label);
    });

    // Draw polygons for each result (limit to 4 for readability)
    const displayResults = completed.slice(0, 4);

    displayResults.forEach(result => {
      const line = d3.lineRadial<BenchmarkResult>()
        .radius(d => {
          const values = dimensions.map(dim => dim.accessor(d));
          return rScale(values[dimensions.indexOf(dimensions[0])]);
        })
        .angle((_, i) => i * angleSlice);

      // Build points manually for proper radial mapping
      const points = dimensions.map(dim => {
        const val = dim.accessor(result);
        const angle = angleSlice * dimensions.indexOf(dim) - Math.PI / 2;
        return [Math.cos(angle) * rScale(val), Math.sin(angle) * rScale(val)] as [number, number];
      });

      const color = getModelColor(result.provider);

      g.append('polygon')
        .datum(points)
        .attr('points', d => d.map(p => p.join(',')).join(' '))
        .attr('fill', color)
        .attr('fill-opacity', 0.12)
        .attr('stroke', color)
        .attr('stroke-width', 1.5);

      // Dots
      points.forEach(p => {
        g.append('circle')
          .attr('cx', p[0])
          .attr('cy', p[1])
          .attr('r', 3)
          .attr('fill', color);
      });
    });

    // Legend
    const legendG = g.append('g')
      .attr('transform', `translate(${-radius},${radius + 30})`);

    displayResults.forEach((result, i) => {
      const lg = legendG.append('g').attr('transform', `translate(${i * 110},0)`);
      lg.append('rect')
        .attr('width', 10).attr('height', 10)
        .attr('fill', getModelColor(result.provider));
      lg.append('text')
        .attr('x', 14).attr('y', 9)
        .attr('fill', colors.ink2)
        .attr('font-size', '9px')
        .attr('font-family', 'var(--mono)')
        .text(`${result.provider} ${result.model.split('-').slice(0, 2).join('-')}`);
    });
  }, [results, width, height]);

  useEffect(() => { draw(); }, [draw]);

  return <svg ref={svgRef} style={{ display: 'block', maxWidth: '100%' }} />;
};

// =============================================================================
// Chart 3: Scatter Plot — Latency vs Composite Score
// =============================================================================

interface ScatterPlotProps {
  results: BenchmarkResult[];
  width?: number;
  height?: number;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  results,
  width = 520,
  height = 320,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const completed = results.filter(r => r.status === 'completed' && r.compositeScore != null);
    if (completed.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 45, left: 55 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const colors = getThemeColors();

    const x = d3.scaleLinear()
      .domain([0, d3.max(completed, d => d.latencyMs) ?? 1000])
      .nice()
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([innerH, 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${d}ms`))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text').attr('fill', colors.ink3).attr('font-size', '10px'));

    // X label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', colors.ink3)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--mono)')
      .text('Latencia');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d as number * 100).toFixed(0)}`))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text').attr('fill', colors.ink3).attr('font-size', '10px'));

    // Y label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .attr('fill', colors.ink3)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--mono)')
      .text('Score Compuesto');

    // Grid lines
    g.selectAll('.grid-h')
      .data(y.ticks(5))
      .join('line')
      .attr('class', 'grid-h')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', colors.border)
      .attr('stroke-width', 0.5);

    // Dots
    g.selectAll('.scatter-dot')
      .data(completed)
      .join('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', d => x(d.latencyMs))
      .attr('cy', d => y(d.compositeScore ?? 0))
      .attr('r', 0)
      .attr('fill', d => getModelColor(d.provider))
      .attr('stroke', d => getModelColor(d.provider))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3)
      .transition()
      .duration(500)
      .ease(d3.easeCubicOut)
      .attr('r', 7);

    // Labels on dots
    g.selectAll('.scatter-label')
      .data(completed)
      .join('text')
      .attr('class', 'scatter-label')
      .attr('x', d => x(d.latencyMs) + 10)
      .attr('y', d => y(d.compositeScore ?? 0) + 4)
      .attr('fill', colors.ink2)
      .attr('font-size', '9px')
      .attr('font-family', 'var(--mono)')
      .text(d => `${d.provider} ${d.model.split('-').slice(0, 2).join('-')}`);
  }, [results, width, height]);

  useEffect(() => { draw(); }, [draw]);

  return <svg ref={svgRef} style={{ display: 'block', maxWidth: '100%' }} />;
};

// =============================================================================
// Chart 4: Grouped Bar Chart — Hallucination & Claims by Model
// =============================================================================

interface HallucinationChartProps {
  results: BenchmarkResult[];
  width?: number;
  height?: number;
}

export const HallucinationChart: React.FC<HallucinationChartProps> = ({
  results,
  width = 520,
  height = 280,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const completed = results.filter(r => r.status === 'completed');
    if (completed.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 60, left: 45 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const colors = getThemeColors();

    const maxVal = d3.max(completed, d => Math.max(d.hallucinatedColumns.length, d.unsupportedClaims)) ?? 1;

    const x0 = d3.scaleBand()
      .domain(completed.map((_, i) => `${i}`))
      .range([0, innerW])
      .padding(0.25);

    const x1 = d3.scaleBand()
      .domain(['halluc', 'claims'])
      .range([0, x0.bandwidth()])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, Math.max(maxVal, 1)])
      .nice()
      .range([innerH, 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x0).tickFormat((d, i) => {
        const r = completed[parseInt(d as string)];
        return `${r.provider} ${r.model.split('-').slice(0, 2).join('-')}`;
      }))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text')
        .attr('fill', colors.ink3)
        .attr('font-size', '9px')
        .attr('transform', 'rotate(-25)')
        .attr('text-anchor', 'end'));

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(4))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text').attr('fill', colors.ink3).attr('font-size', '10px'));

    // Bars
    completed.forEach((result, i) => {
      const xPos = x0(`${i}`)!;

      // Hallucinated columns bar
      g.append('rect')
        .attr('x', xPos + x1('halluc')!)
        .attr('y', y(result.hallucinatedColumns.length))
        .attr('width', x1.bandwidth())
        .attr('height', innerH - y(result.hallucinatedColumns.length))
        .attr('fill', colors.error)
        .attr('opacity', 0.8);

      // Unsupported claims bar
      g.append('rect')
        .attr('x', xPos + x1('claims')!)
        .attr('y', y(result.unsupportedClaims))
        .attr('width', x1.bandwidth())
        .attr('height', innerH - y(result.unsupportedClaims))
        .attr('fill', colors.ink3)
        .attr('opacity', 0.6);
    });

    // Legend
    const legendG = g.append('g').attr('transform', `translate(${innerW - 160}, -10)`);
    legendG.append('rect').attr('width', 10).attr('height', 10).attr('fill', colors.error).attr('opacity', 0.8);
    legendG.append('text').attr('x', 14).attr('y', 9).attr('fill', colors.ink2).attr('font-size', '9px').attr('font-family', 'var(--mono)').text('Columnas alucinadas');
    legendG.append('rect').attr('x', 110).attr('width', 10).attr('height', 10).attr('fill', colors.ink3).attr('opacity', 0.6);
    legendG.append('text').attr('x', 124).attr('y', 9).attr('fill', colors.ink2).attr('font-size', '9px').attr('font-family', 'var(--mono)').text('Claims sin soporte');
  }, [results, width, height]);

  useEffect(() => { draw(); }, [draw]);

  return <svg ref={svgRef} style={{ display: 'block', maxWidth: '100%' }} />;
};

// =============================================================================
// Chart 5: Latency Comparison — Grouped by Provider Type
// =============================================================================

interface LatencyChartProps {
  results: BenchmarkResult[];
  width?: number;
  height?: number;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  results,
  width = 520,
  height = 260,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const completed = results
      .filter(r => r.status === 'completed')
      .sort((a, b) => a.latencyMs - b.latencyMs);

    if (completed.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 60, left: 55 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const colors = getThemeColors();

    const x = d3.scaleBand()
      .domain(completed.map((_, i) => `${i}`))
      .range([0, innerW])
      .padding(0.35);

    const y = d3.scaleLinear()
      .domain([0, d3.max(completed, d => d.latencyMs) ?? 1000])
      .nice()
      .range([innerH, 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((d, i) => {
        const r = completed[parseInt(d as string)];
        const short = r.model.split('-').slice(0, 2).join('-');
        return `${short}`;
      }))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text')
        .attr('fill', colors.ink3)
        .attr('font-size', '9px')
        .attr('transform', 'rotate(-30)')
        .attr('text-anchor', 'end'));

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}ms`))
      .call(sel => sel.select('.domain').attr('stroke', colors.borderStrong))
      .call(sel => sel.selectAll('.tick line').attr('stroke', colors.border))
      .call(sel => sel.selectAll('.tick text').attr('fill', colors.ink3).attr('font-size', '10px'));

    // Bars
    g.selectAll('.latency-bar')
      .data(completed)
      .join('rect')
      .attr('class', 'latency-bar')
      .attr('x', (_, i) => x(`${i}`)!)
      .attr('y', d => y(d.latencyMs))
      .attr('width', x.bandwidth())
      .attr('height', d => innerH - y(d.latencyMs))
      .attr('fill', d => getModelColor(d.provider))
      .attr('opacity', d => d.providerType === 'local' ? 1 : 0.7);

    // Value labels
    g.selectAll('.latency-val')
      .data(completed)
      .join('text')
      .attr('class', 'latency-val')
      .attr('x', (_, i) => x(`${i}`)! + x.bandwidth() / 2)
      .attr('y', d => y(d.latencyMs) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', colors.ink)
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('font-family', 'var(--mono)')
      .text(d => `${d.latencyMs}ms`);

    // Provider type indicator
    g.selectAll('.provider-dot')
      .data(completed)
      .join('circle')
      .attr('class', 'provider-dot')
      .attr('cx', (_, i) => x(`${i}`)! + x.bandwidth() / 2)
      .attr('cy', d => y(d.latencyMs) + (innerH - y(d.latencyMs)) + 14)
      .attr('r', 3)
      .attr('fill', d => d.providerType === 'local' ? colors.ink : colors.ink3);
  }, [results, width, height]);

  useEffect(() => { draw(); }, [draw]);

  return <svg ref={svgRef} style={{ display: 'block', maxWidth: '100%' }} />;
};
