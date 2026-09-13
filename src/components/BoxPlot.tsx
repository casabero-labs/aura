/**
 * BoxPlot — Visualización IQR con D3
 * 
 * Muestra Q1, mediana, Q3, bigotes y outliers para cada columna numérica.
 * Referencia: §3.3.3 OE1 — Motor Determinista
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ColumnStats } from '../types';

interface BoxPlotProps {
  columnStats: Record<string, ColumnStats>;
}

const BoxPlot: React.FC<BoxPlotProps> = ({ columnStats }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const numericCols = Object.values(columnStats).filter(
      c => c.inferredType === 'number' && c.q1 !== undefined && c.iqr !== undefined && c.iqr > 0
    );

    if (numericCols.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 30, bottom: 100, left: 60 };
    const width = Math.max(400, numericCols.length * 120) - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // CSS var-aware colors
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#60a5fa';
    const ink = style.getPropertyValue('--ink').trim() || '#1e293b';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#94a3b8';
    const warning = style.getPropertyValue('--warning').trim() || '#f59e0b';

    // Prepare data
    const boxData = numericCols.map(c => ({
      name: c.name,
      min: c.min as number,
      q1: c.q1!,
      median: c.mean!, // approx; ideally use actual median
      q3: c.q3!,
      max: c.max as number,
      iqr: c.iqr!,
      lowerFence: c.lowerFence ?? c.q1! - 3 * c.iqr!,
      upperFence: c.upperFence ?? c.q3! + 3 * c.iqr!,
      outliers: c.outlierCount ?? 0,
    }));

    // Scales
    const xScale = d3.scaleBand()
      .domain(boxData.map(d => d.name))
      .range([0, width])
      .padding(0.4);

    const allValues = boxData.flatMap(d => [d.lowerFence, d.upperFence]);
    const yMin = Math.min(0, d3.min(allValues) ?? 0);
    const yMax = d3.max(allValues) ?? 100;
    const yScale = d3.scaleLinear()
      .domain([yMin - (yMax - yMin) * 0.1, yMax + (yMax - yMin) * 0.1])
      .range([height, 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-20)')
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('fill', textMuted);

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6))
      .selectAll('text')
      .attr('font-size', 10)
      .attr('fill', textMuted);

    // Box plots
    const boxWidth = xScale.bandwidth();

    const boxes = g.selectAll('.box')
      .data(boxData)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${xScale(d.name)! + boxWidth / 2},0)`);

    // Whiskers (lower)
    boxes.append('line')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', d => yScale(d.lowerFence))
      .attr('y2', d => yScale(d.q1))
      .attr('stroke', accent)
      .attr('stroke-width', 1.5);

    // Whiskers (upper)
    boxes.append('line')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', d => yScale(d.q3))
      .attr('y2', d => yScale(d.upperFence))
      .attr('stroke', accent)
      .attr('stroke-width', 1.5);

    // Whisker caps
    [-1, 1].forEach(side => {
      boxes.append('line')
        .attr('x1', -boxWidth * 0.2).attr('x2', boxWidth * 0.2)
        .attr('y1', d => side < 0 ? yScale(d.lowerFence) : yScale(d.upperFence))
        .attr('y2', d => side < 0 ? yScale(d.lowerFence) : yScale(d.upperFence))
        .attr('stroke', accent)
        .attr('stroke-width', 1.5);
    });

    // Box (Q1 to Q3)
    boxes.append('rect')
      .attr('x', -boxWidth * 0.35)
      .attr('width', boxWidth * 0.7)
      .attr('y', d => yScale(d.q3))
      .attr('height', d => yScale(d.q1) - yScale(d.q3))
      .attr('fill', accent)
      .attr('opacity', 0.3)
      .attr('stroke', accent)
      .attr('stroke-width', 1.5)
      .attr('rx', 2);

    // Median line
    boxes.append('line')
      .attr('x1', -boxWidth * 0.35).attr('x2', boxWidth * 0.35)
      .attr('y1', d => yScale(d.median))
      .attr('y2', d => yScale(d.median))
      .attr('stroke', ink)
      .attr('stroke-width', 2);

    // Outlier count label
    boxes.append('text')
      .attr('y', d => yScale(d.upperFence) - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', d => d.outliers > 0 ? warning : textMuted)
      .text(d => d.outliers > 0 ? `${d.outliers} outlier${d.outliers !== 1 ? 's' : ''}` : '');

    // IQR label
    boxes.append('text')
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', textMuted)
      .text(d => `IQR: ${d.iqr.toFixed(1)}`);

  }, [columnStats]);

  return (
    <div className="boxplot-container">
      <p className="sec-eye" style={{ marginBottom: 8 }}>DISTRIBUCIÓN IQR POR COLUMNA NUMÉRICA</p>
      <svg ref={svgRef} style={{ width: '100%', overflow: 'visible' }} />
    </div>
  );
};

export default BoxPlot;