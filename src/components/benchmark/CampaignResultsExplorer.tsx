import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ExperimentCellScores } from '../../services/benchmark/experimentDecisionSupport';
import type { ExperimentCampaignEvidenceDocumentV1 } from '../../services/benchmark/experimentReport';
import {
  OE4_INPUT_MODE_LABELS,
  type OE4InputMode,
  type OE4ModelId,
} from '../../services/benchmark/finalEvaluationProtocol';

interface CampaignResultsExplorerProps {
  evidenceDocument: ExperimentCampaignEvidenceDocumentV1;
  selectedCellId?: string;
  onSelectedCellIdChange?: (cellId: string) => void;
}

type ExplorerView = 'overview' | 'dimensions' | 'quality_speed';

interface DimensionDatum {
  key: keyof Pick<
    ExperimentCellScores,
    'accuracy' | 'reliability' | 'contractCompliance' | 'evidenceSupport' | 'hallucinationSafety' | 'efficiency'
  >;
  label: string;
  value: number | null;
  weight: number;
}

const VIEW_LABELS: Record<ExplorerView, string> = {
  overview: 'Panorama',
  dimensions: 'Dimensiones',
  quality_speed: 'Calidad y velocidad',
};

const MODEL_ORDER: OE4ModelId[] = [
  'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL',
];

const INPUT_ORDER: OE4InputMode[] = ['prompt_libre', 'smart_sample', 'recommended'];

const modelName = (modelId: string): string => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return 'Qwen3.5 4B';
  if (modelId.includes('gemma-4-E4B')) return 'Gemma 4 E4B';
  if (modelId.includes('SmolLM3-3B')) return 'SmolLM3 3B';
  return modelId;
};

const inputShortLabel: Record<OE4InputMode, string> = {
  prompt_libre: 'Mínimo',
  smart_sample: 'Equilibrado',
  recommended: 'Completo',
};

const inputSymbol: Record<OE4InputMode, string> = {
  prompt_libre: 'M',
  smart_sample: 'E',
  recommended: 'C',
};

const formatScore = (value: number | null): string => value === null ? 'n/d' : value.toFixed(1);

const scoreBand = (value: number | null): string => {
  if (value === null) return 'is-missing';
  if (value >= 80) return 'is-high';
  if (value >= 60) return 'is-medium';
  return 'is-low';
};

const modelClass = (modelId: string): string => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return 'is-qwen';
  if (modelId.includes('gemma-4-E4B')) return 'is-gemma';
  return 'is-smol';
};

const modelSymbol = (modelId: string): d3.SymbolType => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return d3.symbolCircle;
  if (modelId.includes('gemma-4-E4B')) return d3.symbolSquare;
  return d3.symbolTriangle;
};

const chartDescription = (view: ExplorerView): string => {
  if (view === 'overview') {
    return 'Matriz de nueve combinaciones. Cada celda muestra el índice equilibrado calculado por AURA; seleccionarla actualiza el detalle.';
  }
  if (view === 'dimensions') {
    return 'Barras de cero a cien para las seis dimensiones de la combinación seleccionada. Los pesos pertenecen al índice equilibrado.';
  }
  return 'Diagrama de dispersión. El eje horizontal muestra latencia mediana, el vertical alineación con el ground truth y el tamaño representa fiabilidad. Las formas distinguen modelos.';
};

const CampaignResultsExplorer: React.FC<CampaignResultsExplorerProps> = ({
  evidenceDocument,
  selectedCellId: selectedCellIdProp,
  onSelectedCellIdChange,
}) => {
  const chartId = useId().replaceAll(':', '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<ExplorerView>('overview');
  const scores = evidenceDocument.decisionSupport.scores;
  const aggregationByCell = useMemo(() => new Map(
    evidenceDocument.aggregation.matrix.cells.map((cell) => [cell.cellId, cell]),
  ), [evidenceDocument.aggregation.matrix.cells]);
  const balancedRecommendation = evidenceDocument.decisionSupport.recommendations
    .find((recommendation) => recommendation.useCase === 'balanced');
  const initialCellId = scores.find((entry) =>
    entry.modelId === balancedRecommendation?.modelId
      && entry.inputMode === balancedRecommendation.inputMode)?.cellId ?? scores[0]?.cellId ?? '';
  const [selectedCellId, setSelectedCellId] = useState(selectedCellIdProp ?? initialCellId);
  const selectCell = useCallback((cellId: string) => {
    setSelectedCellId(cellId);
    onSelectedCellIdChange?.(cellId);
  }, [onSelectedCellIdChange]);

  // J13 — pestañas con flechas (WAI-APG): el roving tabindex ya existe.
  const viewOrder = useMemo(() => Object.keys(VIEW_LABELS) as ExplorerView[], []);
  const handleTablistKeyDown = useCallback((event: React.KeyboardEvent) => {
    const current = viewOrder.indexOf(view);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % viewOrder.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + viewOrder.length) % viewOrder.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = viewOrder.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = viewOrder[next];
    setView(target);
    document.getElementById(`oe4-results-tab-${target}`)?.focus();
  }, [view, viewOrder]);
  const selectedScore = scores.find((entry) => entry.cellId === selectedCellId) ?? scores[0];
  const selectedAggregation = selectedScore ? aggregationByCell.get(selectedScore.cellId) : undefined;
  const weights = evidenceDocument.decisionSupport.methodology.balancedWeights;
  const dimensions = useMemo<DimensionDatum[]>(() => selectedScore ? [
    { key: 'accuracy', label: 'Alineación con GT', value: selectedScore.accuracy, weight: weights.accuracy },
    { key: 'reliability', label: 'Fiabilidad', value: selectedScore.reliability, weight: weights.reliability },
    { key: 'contractCompliance', label: 'Contrato', value: selectedScore.contractCompliance, weight: weights.contractCompliance },
    { key: 'evidenceSupport', label: 'Soporte de evidencia', value: selectedScore.evidenceSupport, weight: weights.evidenceSupport },
    { key: 'hallucinationSafety', label: 'Sin alucinaciones', value: selectedScore.hallucinationSafety, weight: weights.hallucinationSafety },
    { key: 'efficiency', label: 'Eficiencia', value: selectedScore.efficiency, weight: weights.efficiency },
  ] : [], [selectedScore, weights]);

  useEffect(() => {
    if (selectedCellIdProp && scores.some((entry) => entry.cellId === selectedCellIdProp)) {
      setSelectedCellId(selectedCellIdProp);
      return;
    }
    if (scores.some((entry) => entry.cellId === selectedCellId)) return;
    setSelectedCellId(initialCellId);
  }, [initialCellId, scores, selectedCellId, selectedCellIdProp]);

  useEffect(() => {
    if (!expanded || !svgRef.current || !selectedScore) return;

    const width = 960;
    const height = view === 'quality_speed' ? 470 : 430;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.append('title').attr('id', `${chartId}-title`).text(VIEW_LABELS[view]);
    svg.append('desc').attr('id', `${chartId}-desc`).text(chartDescription(view));

    if (view === 'overview') {
      const margin = { top: 58, right: 34, bottom: 62, left: 164 };
      const x = d3.scaleBand<OE4InputMode>()
        .domain(INPUT_ORDER)
        .range([margin.left, width - margin.right])
        .padding(0.12);
      const y = d3.scaleBand<OE4ModelId>()
        .domain(MODEL_ORDER)
        .range([margin.top, height - margin.bottom])
        .padding(0.14);

      svg.append('g')
        .selectAll('text')
        .data(INPUT_ORDER)
        .join('text')
        .attr('class', 'oe4-chart-axis-label')
        .attr('x', (entry) => (x(entry) ?? 0) + x.bandwidth() / 2)
        .attr('y', 34)
        .attr('text-anchor', 'middle')
        .text((entry) => inputShortLabel[entry]);

      svg.append('g')
        .selectAll('text')
        .data(MODEL_ORDER)
        .join('text')
        .attr('class', 'oe4-chart-axis-label oe4-chart-axis-label--model')
        .attr('x', margin.left - 18)
        .attr('y', (entry) => (y(entry) ?? 0) + y.bandwidth() / 2 + 5)
        .attr('text-anchor', 'end')
        .text((entry) => modelName(entry));

      const cells = svg.append('g')
        .selectAll<SVGGElement, ExperimentCellScores>('g')
        .data(scores)
        .join('g')
        .attr('class', 'oe4-heatmap-cell')
        .attr('role', 'button')
        .attr('tabindex', 0)
        .attr('aria-label', (entry) => `${modelName(entry.modelId)}, ${OE4_INPUT_MODE_LABELS[entry.inputMode]}, índice equilibrado ${formatScore(entry.balanced)} de 100`)
        .attr('transform', (entry) => `translate(${x(entry.inputMode) ?? 0},${y(entry.modelId) ?? 0})`)
        .on('click', (_event, entry) => selectCell(entry.cellId))
        .on('keydown', (event: KeyboardEvent, entry) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          selectCell(entry.cellId);
        });

      cells.append('rect')
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 8)
        .attr('class', (entry) => [
          'oe4-heatmap-cell-bg',
          scoreBand(entry.balanced),
          entry.cellId === selectedScore.cellId ? 'is-selected' : '',
        ].filter(Boolean).join(' '));

      cells.append('text')
        .attr('class', 'oe4-heatmap-score')
        .attr('x', x.bandwidth() / 2)
        .attr('y', y.bandwidth() / 2 - 2)
        .attr('text-anchor', 'middle')
        .text((entry) => formatScore(entry.balanced));

      cells.append('text')
        .attr('class', 'oe4-heatmap-status')
        .attr('x', x.bandwidth() / 2)
        .attr('y', y.bandwidth() / 2 + 20)
        .attr('text-anchor', 'middle')
        .text((entry) => {
          const cell = aggregationByCell.get(entry.cellId);
          return `${cell?.completedRuns ?? 0}/${cell?.attemptedRuns ?? 0} válidas`;
        });
      return;
    }

    if (view === 'dimensions') {
      const margin = { top: 38, right: 66, bottom: 54, left: 222 };
      const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]);
      const y = d3.scaleBand<string>()
        .domain(dimensions.map((entry) => entry.key))
        .range([margin.top, height - margin.bottom])
        .padding(0.32);

      svg.append('g')
        .attr('class', 'oe4-chart-grid')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-(height - margin.top - margin.bottom)).tickFormat((value) => `${value}`));

      const rows = svg.append('g')
        .selectAll<SVGGElement, DimensionDatum>('g')
        .data(dimensions)
        .join('g');

      rows.append('text')
        .attr('class', 'oe4-chart-dimension-label')
        .attr('x', margin.left - 16)
        .attr('y', (entry) => (y(entry.key) ?? 0) + y.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end')
        .text((entry) => `${entry.label} · peso ${(entry.weight * 100).toFixed(0)} %`);

      rows.append('rect')
        .attr('class', 'oe4-dimension-track')
        .attr('x', margin.left)
        .attr('y', (entry) => y(entry.key) ?? 0)
        .attr('width', x(100) - x(0))
        .attr('height', y.bandwidth())
        .attr('rx', 5);

      rows.filter((entry) => entry.value !== null)
        .append('rect')
        .attr('class', (entry) => `oe4-dimension-value ${scoreBand(entry.value)}`)
        .attr('x', margin.left)
        .attr('y', (entry) => y(entry.key) ?? 0)
        .attr('width', (entry) => x(entry.value ?? 0) - x(0))
        .attr('height', y.bandwidth())
        .attr('rx', 5);

      rows.append('text')
        .attr('class', 'oe4-dimension-score')
        .attr('x', (entry) => entry.value === null ? margin.left + 10 : Math.min(width - 28, x(entry.value) + 10))
        .attr('y', (entry) => (y(entry.key) ?? 0) + y.bandwidth() / 2 + 4)
        .text((entry) => formatScore(entry.value));
      return;
    }

    const scatterData = scores.map((entry) => ({
      score: entry,
      cell: aggregationByCell.get(entry.cellId),
    })).filter((entry): entry is {
      score: ExperimentCellScores;
      cell: NonNullable<ReturnType<typeof aggregationByCell.get>>;
    } => entry.score.accuracy !== null && entry.cell?.totalLatencyMs.median !== null);
    const margin = { top: 42, right: 46, bottom: 78, left: 86 };
    const maxLatencySeconds = d3.max(scatterData, (entry) => (entry.cell.totalLatencyMs.median ?? 0) / 1_000) ?? 1;
    const x = d3.scaleLinear().domain([0, maxLatencySeconds * 1.12]).nice().range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);
    const radius = d3.scaleSqrt().domain([0, 100]).range([54, 180]);

    svg.append('g')
      .attr('class', 'oe4-chart-grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((value) => `${value}s`));
    svg.append('g')
      .attr('class', 'oe4-chart-grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}`));
    svg.append('text')
      .attr('class', 'oe4-chart-axis-title')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', height - 24)
      .attr('text-anchor', 'middle')
      .text('Latencia mediana · segundos · menor es mejor');
    svg.append('text')
      .attr('class', 'oe4-chart-axis-title')
      .attr('transform', `translate(24 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .text('Alineación con GT · mayor es mejor');

    const inputOffset: Record<OE4InputMode, number> = { prompt_libre: -8, smart_sample: 0, recommended: 8 };
    const points = svg.append('g')
      .selectAll<SVGGElement, typeof scatterData[number]>('g')
      .data(scatterData)
      .join('g')
      .attr('class', (entry) => `oe4-scatter-point ${modelClass(entry.score.modelId)}${entry.score.cellId === selectedScore.cellId ? ' is-selected' : ''}`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', (entry) => `${modelName(entry.score.modelId)}, ${OE4_INPUT_MODE_LABELS[entry.score.inputMode]}, alineación GT ${formatScore(entry.score.accuracy)}, latencia ${((entry.cell.totalLatencyMs.median ?? 0) / 1_000).toFixed(1)} segundos, fiabilidad ${formatScore(entry.score.reliability)}`)
      .attr('transform', (entry) => `translate(${x((entry.cell.totalLatencyMs.median ?? 0) / 1_000) + inputOffset[entry.score.inputMode]},${y(entry.score.accuracy ?? 0)})`)
      .on('click', (_event, entry) => selectCell(entry.score.cellId))
      .on('keydown', (event: KeyboardEvent, entry) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectCell(entry.score.cellId);
      });

    points.append('path')
      .attr('d', (entry) => d3.symbol()
        .type(modelSymbol(entry.score.modelId))
        .size(radius(entry.score.reliability ?? 0))())
      .attr('class', 'oe4-scatter-mark');
    points.append('text')
      .attr('class', 'oe4-scatter-label')
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .text((entry) => inputSymbol[entry.score.inputMode]);

    const legend = svg.append('g').attr('transform', `translate(${margin.left + 8},18)`);
    MODEL_ORDER.forEach((modelId, index) => {
      const item = legend.append('g').attr('transform', `translate(${index * 190},0)`);
      item.append('path')
        .attr('d', d3.symbol().type(modelSymbol(modelId)).size(68)())
        .attr('class', `oe4-scatter-mark ${modelClass(modelId)}`);
      item.append('text').attr('class', 'oe4-chart-legend-label').attr('x', 14).attr('y', 4).text(modelName(modelId));
    });
  }, [aggregationByCell, chartId, dimensions, expanded, scores, selectCell, selectedScore, view]);

  if (!selectedScore) return null;

  const chartTitle = view === 'overview'
    ? 'Índice equilibrado por modelo y entrada'
    : view === 'dimensions'
      ? `Dimensiones de ${modelName(selectedScore.modelId)} con ${OE4_INPUT_MODE_LABELS[selectedScore.inputMode].toLowerCase()}`
      : 'Relación entre calidad, velocidad y fiabilidad';

  return (
    <section className="oe4-panel oe4-results-explorer" aria-labelledby="oe4-results-explorer-title" data-testid="oe4-results-explorer">
      <div className="oe4-results-explorer-heading">
        <div>
          <p className="oe4-eyebrow">Explorador interactivo D3</p>
          <h2 id="oe4-results-explorer-title">Visualizar resultados</h2>
          <p>Explora la evidencia ya calculada por AURA. Esta vista no altera scores, corridas ni recomendaciones.</p>
        </div>
        <button
          type="button"
          className={expanded ? 'btn-s' : 'btn-p'}
          aria-expanded={expanded}
          aria-controls="oe4-results-explorer-body"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Ocultar visualización' : 'Visualizar resultados'}
        </button>
      </div>

      {expanded && (
        <div id="oe4-results-explorer-body" className="oe4-results-explorer-body">
          <div className="oe4-results-trust-strip" aria-label="Garantías del cálculo">
            <div><span>Referencia</span><strong>Oráculo congelado</strong></div>
            <div><span>Cálculo</span><strong>Determinista, sin juez LLM</strong></div>
            <div><span>Trazabilidad</span><strong>Respuesta y recibo conservados</strong></div>
          </div>

          <div className="oe4-results-tabs" role="tablist" aria-label="Vistas de resultados" onKeyDown={handleTablistKeyDown}>
            {(Object.keys(VIEW_LABELS) as ExplorerView[]).map((entry) => (
              <button
                key={entry}
                id={`oe4-results-tab-${entry}`}
                type="button"
                role="tab"
                aria-selected={view === entry}
                aria-controls="oe4-results-chart-panel"
                tabIndex={view === entry ? 0 : -1}
                onClick={() => setView(entry)}
              >
                {VIEW_LABELS[entry]}
              </button>
            ))}
          </div>

          <div className="oe4-results-layout">
            <div
              id="oe4-results-chart-panel"
              className="oe4-results-chart-card"
              role="tabpanel"
              aria-labelledby={`oe4-results-tab-${view}`}
            >
              <div className="oe4-results-chart-heading">
                <div>
                  <span>{VIEW_LABELS[view]}</span>
                  <h3>{chartTitle}</h3>
                </div>
                <small>Selecciona una marca para ver su detalle</small>
              </div>
              <svg
                ref={svgRef}
                className="oe4-results-chart"
                role="img"
                aria-labelledby={`${chartId}-title ${chartId}-desc`}
                data-testid={`oe4-results-chart-${view}`}
              />
            </div>

            <aside className="oe4-results-selection" aria-label="Combinación seleccionada" aria-live="polite">
              <p className="oe4-eyebrow">Selección actual</p>
              <h3>{modelName(selectedScore.modelId)}</h3>
              <p>{OE4_INPUT_MODE_LABELS[selectedScore.inputMode]}</p>
              <div className={`oe4-results-balanced ${scoreBand(selectedScore.balanced)}`}>
                <span>Índice equilibrado</span>
                <strong>{formatScore(selectedScore.balanced)}</strong>
                <small>sobre 100</small>
              </div>
              <dl>
                <div><dt>Alineación con GT</dt><dd>{formatScore(selectedScore.accuracy)}</dd></div>
                <div><dt>Fiabilidad</dt><dd>{formatScore(selectedScore.reliability)}</dd></div>
                <div><dt>Corridas válidas</dt><dd>{selectedAggregation?.completedRuns ?? 0}/{selectedAggregation?.attemptedRuns ?? 0}</dd></div>
                <div><dt>Latencia mediana</dt><dd>{selectedAggregation?.totalLatencyMs.median === null || selectedAggregation?.totalLatencyMs.median === undefined ? 'n/d' : `${(selectedAggregation.totalLatencyMs.median / 1_000).toFixed(1)} s`}</dd></div>
              </dl>
            </aside>
          </div>

          <details className="oe4-results-data-table">
            <summary>Ver los datos exactos representados</summary>
            <div className="table-scroll" role="region" aria-label="Datos exactos de la campaña" tabIndex={0}>
              <table>
                <thead>
                  <tr><th>Modelo</th><th>Entrada</th><th>Alineación GT</th><th>Fiabilidad</th><th>Latencia mediana</th><th>Equilibrado</th></tr>
                </thead>
                <tbody>
                  {scores.map((entry) => {
                    const cell = aggregationByCell.get(entry.cellId);
                    const isSelected = entry.cellId === selectedCellId;
                    return (
                      <tr
                        key={entry.cellId}
                        tabIndex={0}
                        aria-selected={isSelected}
                        data-testid="oe4-result-row"
                        onClick={() => selectCell(entry.cellId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectCell(entry.cellId);
                          }
                        }}
                      >
                        <th scope="row">{modelName(entry.modelId)}</th>
                        <td>{OE4_INPUT_MODE_LABELS[entry.inputMode]}</td>
                        <td>{formatScore(entry.accuracy)}</td>
                        <td>{formatScore(entry.reliability)}</td>
                        <td>{cell?.totalLatencyMs.median === null || cell?.totalLatencyMs.median === undefined ? 'n/d' : `${(cell.totalLatencyMs.median / 1_000).toFixed(1)} s`}</td>
                        <td>{formatScore(entry.balanced)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>

          <div className="oe4-results-validity-note">
            <strong>Lectura honesta.</strong>
            <p>Es confiable para comparar estas 27 corridas sobre el dataset controlado. No demuestra superioridad universal: usa un solo dataset, tres repeticiones, pesos explícitos y latencia propia del equipo donde se ejecutó.</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default CampaignResultsExplorer;
