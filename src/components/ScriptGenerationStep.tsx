import React, { useCallback, useState } from 'react';
import { ArrowRight, CheckCircle2, FileCode2, ShieldAlert, ShieldCheck, TriangleAlert, Gauge } from 'lucide-react';
import { AIProvider, AuditReport, ProviderMetrics, ScriptValidationResult } from '../types';
import { highlightPython } from '../services/highlightPython';
import { buildDeterministicCleaningScript, buildFallbackScriptMetrics } from '../services/deterministicScriptBuilder';
import { buildDiagnosisScriptBrief, buildDiagnosisSummaryPrompt, buildScriptPrompt, extractPythonScript } from '../services/providers/prompts';

interface ScriptGenerationStepProps {
  report: AuditReport;
  aiProvider: AIProvider;
  diagnosisText: string;
  cleaningScript: string;
  scriptValidation: ScriptValidationResult | null;
  onScriptGenerated: (script: string, metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
}

const ScriptGenerationStep: React.FC<ScriptGenerationStepProps> = ({
  report,
  aiProvider,
  diagnosisText,
  cleaningScript,
  scriptValidation,
  onScriptGenerated,
  onLog,
  onContinue,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingMetrics, setStreamingMetrics] = useState<ProviderMetrics | null>(null);
  const [scriptOrigin, setScriptOrigin] = useState<'model' | 'deterministic' | null>(cleaningScript ? 'model' : null);
  const [diagnosisBrief, setDiagnosisBrief] = useState(() => buildDiagnosisScriptBrief(diagnosisText));

  const useFallbackScript = useCallback((reason: string) => {
    const fallbackScript = buildDeterministicCleaningScript(report);
    const metrics = buildFallbackScriptMetrics();
    setScriptOrigin('deterministic');
    setStreamingMetrics(metrics);
    onScriptGenerated(fallbackScript, metrics);
    onLog?.('script', `Script determinista generado como respaldo :: ${reason}`);
  }, [onLog, onScriptGenerated, report]);

  const generateScript = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setStreamingText('');
    setStreamingMetrics(null);
    setScriptOrigin(null);
    onLog?.('script', 'Generando script desde diagnostico previo y paquete estructurado');

    if (!diagnosisText.trim()) {
      onLog?.('script', 'Sin diagnóstico LLM; usando script base determinista');
      useFallbackScript('diagnóstico no disponible');
      setIsLoading(false);
      return;
    }

    try {
      let operativeBrief = buildDiagnosisScriptBrief(diagnosisText);
      try {
        const summary = await aiProvider.generateText(buildDiagnosisSummaryPrompt(diagnosisText));
        if (summary.text.trim()) {
          operativeBrief = summary.text.trim();
          setDiagnosisBrief(operativeBrief);
        }
      } catch (summaryError: any) {
        onLog?.('script', `Resumen LLM no disponible; usando resumen local :: ${summaryError?.message || 'sin detalle'}`);
        setDiagnosisBrief(operativeBrief);
      }

      const prompt = buildScriptPrompt(report, diagnosisText, operativeBrief);
      const { text, metrics } = await aiProvider.generateText(prompt);
      setStreamingText(text);
      const pythonScript = extractPythonScript(text);

      if (!pythonScript || !pythonScript.includes('clean_dataset')) {
        const msg = 'El modelo no entregó un script Python/Pandas estructurado; AURA generó un script base determinista para revisión.';
        setError(msg);
        useFallbackScript('sin python_script');
        return;
      }

      setScriptOrigin('model');
      onScriptGenerated(pythonScript, metrics);
      setStreamingMetrics(metrics);
      onLog?.('script', `Script generado desde diagnóstico · ${pythonScript.split('\n').length} líneas · ${metrics.latencyMs}ms`);
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido generando script';
      setError(`No se pudo usar la salida del modelo. AURA generó un script base determinista para no bloquear el flujo. Detalle: ${msg}`);
      useFallbackScript(msg);
    } finally {
      setIsLoading(false);
    }
  }, [aiProvider, diagnosisText, isLoading, onLog, onScriptGenerated, report, useFallbackScript]);

  const scriptPromptPreview = React.useMemo(() => buildScriptPrompt(report, diagnosisText, diagnosisBrief), [report, diagnosisText, diagnosisBrief]);

  const validationItems = scriptValidation ? [
    {
      label: 'Safety Score',
      value: `${scriptValidation.safetyScore}/100`,
      state: scriptValidation.safetyScore >= 80 ? 'pass' : scriptValidation.safetyScore >= 50 ? 'review' : 'warn',
    },
    {
      label: 'Columnas existentes',
      value: scriptValidation.invalidColumns.length === 0 ? 'Sin columnas fantasma' : `${scriptValidation.invalidColumns.length} inválidas: ${scriptValidation.invalidColumns.join(', ')}`,
      state: scriptValidation.invalidColumns.length === 0 ? 'pass' : 'warn',
    },
    {
      label: 'Cobertura de hallazgos',
      value: `${scriptValidation.coveredIssueIds.length} / ${report.issues.length} (${scriptValidation.coveragePercentage}%)`,
      state: scriptValidation.coveragePercentage >= 50 ? 'pass' : 'warn',
    },
    {
      label: 'Operaciones destructivas',
      value: scriptValidation.destructiveOperations.length === 0 ? 'No detectadas' : scriptValidation.destructiveOperations.join(', '),
      state: scriptValidation.destructiveOperations.length === 0 ? 'pass' : 'warn',
    },
    {
      label: 'Uso de Pandas',
      value: scriptValidation.hasPandasImport ? 'Detectado' : 'No evidente',
      state: scriptValidation.hasPandasImport ? 'pass' : 'warn',
    },
    {
      label: 'Origen',
      value: scriptValidation.scriptOrigin === 'deterministic' ? 'Respaldo determinista' : scriptValidation.scriptOrigin === 'model' ? 'Modelo LLM' : 'Pendiente',
      state: scriptValidation.scriptOrigin === 'deterministic' ? 'review' : 'pass',
    },
    {
      label: 'Revisión humana',
      value: scriptValidation.requiresHumanReview ? 'Requerida' : 'Sin alertas',
      state: scriptValidation.requiresHumanReview ? 'review' : 'pass',
    },
  ] : [];

  return (
    <>
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">acciones sugeridas</p>
            <h2 className="sec-title">Generar script de asistencia.</h2>
          </div>
        </header>
        <p className="section-note">
          El script no nace de un análisis nuevo. Usa el diagnóstico previo, el paquete estructurado y el anclaje semántico
          de la Capa 2 para producir transformaciones Pandas revisables bajo paradigma copy-paste.
        </p>

        <div className="benchmark-protocol mt-6">
          <div>
            <span>hallazgos base</span>
            <strong>{report.issues.length}</strong>
          </div>
          <div>
            <span>diagnóstico previo</span>
            <strong>{diagnosisText.trim() ? 'disponible' : 'requerido'}</strong>
          </div>
          <div>
            <span>origen</span>
            <strong>{scriptOrigin === 'deterministic' ? 'determinista' : scriptOrigin === 'model' ? 'modelo' : 'pendiente'}</strong>
          </div>
          <div>
            <span>validación</span>
            <strong>{scriptValidation ? (scriptValidation.valid ? 'válido' : 'requiere revisión') : 'pendiente'}</strong>
          </div>
        </div>

        <div className="mt-6">
          <details className="script-contract-details">
            <summary>Ver contrato usado para generar script</summary>
            <pre>{scriptPromptPreview}</pre>
          </details>
        </div>

        <div className="mt-6">
          <button className="btn-p" onClick={generateScript} disabled={isLoading}>
            <FileCode2 size={14} />
            {isLoading ? 'Generando' : cleaningScript ? 'Regenerar script' : 'Generar script'}
          </button>
        </div>

        {isLoading && streamingText && (
          <div className="script-stream-box">
            <div className="script-stream-head">
              <span className="script-stream-dot" />
              <strong>Generando respuesta del proveedor</strong>
            </div>
            <div className="script-stream-content">
              {streamingText}
            </div>
          </div>
        )}

        {streamingMetrics && !isLoading && (
          <div className="script-metrics-row">
            <span>{streamingMetrics.latencyMs}ms</span>
            <span>{streamingMetrics.tokensGenerated} tokens</span>
            <span>{streamingMetrics.isLocal ? 'Local' : 'Cloud'}</span>
            {scriptOrigin === 'deterministic' && <span>respaldo determinista</span>}
          </div>
        )}

        {error && (
          <p className="section-note mt-4" style={{ color: 'var(--accent)' }}>{error}</p>
        )}

        {scriptValidation && (
          <div className="script-validation-panel">
            {/* ── Safety Score Bar (always visible) ── */}
            {scriptValidation.hasScript && (
              <div className="safety-score-bar-wrap">
                <div className="safety-score-header">
                  <Gauge size={14} />
                  <span>Safety Score</span>
                  <strong style={{
                    color: scriptValidation.safetyScore >= 80 ? 'var(--success)'
                      : scriptValidation.safetyScore >= 50 ? 'var(--orange)'
                      : 'var(--error)'
                  }}>
                    {scriptValidation.safetyScore}/100
                  </strong>
                </div>
                <div className="safety-score-track">
                  <div
                    className="safety-score-fill"
                    style={{
                      width: `${scriptValidation.safetyScore}%`,
                      background: scriptValidation.safetyScore >= 80 ? 'var(--success)'
                        : scriptValidation.safetyScore >= 50 ? 'var(--orange)'
                        : 'var(--error)'
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Coverage Bar (always visible) ── */}
            {scriptValidation.hasScript && (
              <div className="coverage-bar-wrap">
                <div className="coverage-bar-label">
                  <span>Cobertura de hallazgos</span>
                  <strong>{scriptValidation.coveragePercentage}%</strong>
                </div>
                <div className="coverage-bar-track">
                  <div
                    className="coverage-bar-fill"
                    style={{
                      width: `${scriptValidation.coveragePercentage}%`,
                      background: scriptValidation.coveragePercentage >= 50 ? 'var(--success)' : 'var(--orange)'
                    }}
                  />
                </div>
                {scriptValidation.uncoveredIssueIds.length > 0 && (
                  <p className="coverage-uncovered">
                    Sin cobertura: {scriptValidation.uncoveredIssueIds.length} hallazgo(s) sin traza en el script
                  </p>
                )}
              </div>
            )}

            {/* ── Key risk indicators (always visible) ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              {scriptValidation.invalidColumns.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TriangleAlert size={12} /> {scriptValidation.invalidColumns.length} columna(s) inválida(s)
                </span>
              )}
              {scriptValidation.destructiveOperations.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldAlert size={12} /> {scriptValidation.destructiveOperations.length} operación(es) destructiva(s)
                </span>
              )}
              {scriptValidation.requiresHumanReview && (
                <span style={{ fontSize: '11px', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldAlert size={12} /> Requiere revisión humana
                </span>
              )}
              {!scriptValidation.requiresHumanReview && !scriptValidation.invalidColumns.length && !scriptValidation.destructiveOperations.length && (
                <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> Sin alertas
                </span>
              )}
            </div>

            {/* ── Full validation matrix (collapsed) ── */}
            <details style={{ marginTop: 'var(--space-xs)' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--ink2)', fontWeight: 500, userSelect: 'none' }}>
                Matriz de validación completa
              </summary>
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <div className="script-validation-grid">
                  {validationItems.map((item) => (
                    <div key={item.label} className={`script-validation-card script-validation-card--${item.state}`}>
                      {item.state === 'pass' ? <CheckCircle2 size={14} /> : item.state === 'review' ? <ShieldAlert size={14} /> : <TriangleAlert size={14} />}
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                {scriptValidation.warnings.length > 0 && (
                  <ul className="script-validation-warnings">
                    {scriptValidation.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </div>
        )}

        {cleaningScript && (
          <div className="mt-6">
            <div className="script-review">
              <div className="script-review-header">
                <div className="flex items-center gap-2">
                  <FileCode2 size={14} style={{color:'var(--ink)'}} />
                  <span className="eyebrow">Vista previa del script generado</span>
                </div>
              </div>
              <div className="script-governance-note">
                <ShieldCheck size={14} />
                <p>Esta etapa solo genera y valida. La aprobación humana ocurre en la siguiente pantalla.</p>
              </div>
              <div className="script-code-shell">
                <div className="script-scroll custom-scrollbar">
                  <pre className="script-code">
                    {cleaningScript.split('\n').map((line, index) => (
                      <span key={`${index}-${line}`} className="script-line">
                        <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                        <code dangerouslySetInnerHTML={{ __html: highlightPython(line) || ' ' }} />
                      </span>
                    ))}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="context-guide">
        <span className="guide-icon"><ArrowRight size={14} /></span>
        <div>
          <p className="guide-title">Revisión final</p>
          <p className="guide-desc">Revisa el script, aprueba las transformaciones y prepara la exportación.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue}>
          Revisar script <ArrowRight size={12} />
        </button>
      </div>
    </>
  );
};

export default ScriptGenerationStep;
