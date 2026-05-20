import React, { useCallback, useState } from 'react';
import { ArrowRight, CheckCircle2, FileCode2, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
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
      const msg = 'Primero genera el diagnóstico. El script usa ese análisis como anclaje semántico y no debe crear un análisis nuevo.';
      setError(msg);
      setIsLoading(false);
      onLog?.('script', msg);
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
      label: 'Columnas existentes',
      value: scriptValidation.invalidColumns.length === 0 ? 'Sin columnas fantasma' : `${scriptValidation.invalidColumns.length} inválidas`,
      state: scriptValidation.invalidColumns.length === 0 ? 'pass' : 'warn',
    },
    {
      label: 'Cobertura de hallazgos',
      value: `${scriptValidation.coveredIssueIds.length} / ${report.issues.length}`,
      state: scriptValidation.coveredIssueIds.length > 0 ? 'pass' : 'warn',
    },
    {
      label: 'Operaciones destructivas',
      value: scriptValidation.destructiveOperations.length === 0 ? 'No detectadas' : scriptValidation.destructiveOperations.join(', '),
      state: scriptValidation.destructiveOperations.length === 0 ? 'pass' : 'warn',
    },
    {
      label: 'Uso de Pandas',
      value: scriptValidation.warnings.some((warning) => warning.includes('Pandas')) ? 'No evidente' : 'Detectado',
      state: scriptValidation.warnings.some((warning) => warning.includes('Pandas')) ? 'warn' : 'pass',
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
          <button className="btn-p" onClick={generateScript} disabled={isLoading || !diagnosisText.trim()}>
            <FileCode2 size={14} />
            {isLoading ? 'Generando' : cleaningScript ? 'Regenerar script' : 'Generar script'}
          </button>
        </div>

        {isLoading && streamingText && (
          <div className="mt-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="animate-pulse w-2 h-2 rounded-full bg-[var(--accent)]" />
              <strong className="text-sm">Generando respuesta del proveedor</strong>
            </div>
            <div className="text-xs text-[var(--ink-muted)] font-mono max-h-64 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
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
            <div className="script-validation-head">
              <ShieldCheck size={14} />
              <div>
                <strong>Matriz de validación automática</strong>
                <p>Evalúa si el script puede pasar a revisión humana con trazabilidad mínima.</p>
              </div>
            </div>
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
        )}

        {cleaningScript && (
          <div className="mt-6">
            <div className="script-review">
              <div className="script-review-header">
                <div className="flex items-center gap-2">
                  <FileCode2 size={14} className="text-[var(--ink)]" />
                  <span className="eyebrow text-[var(--ink)]">Vista previa del script generado</span>
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
          <p className="guide-title">Siguiente paso: revisión final</p>
          <p className="guide-desc">Con el script generado y aprobado, puedes simular el impacto y preparar la exportación.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue} disabled={!cleaningScript}>
          Ir a revisión <ArrowRight size={12} />
        </button>
      </div>
    </>
  );
};

export default ScriptGenerationStep;
