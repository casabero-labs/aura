import React, { useCallback, useState } from 'react';
import { ArrowRight, CheckCircle2, FileCode2, ShieldAlert, ShieldCheck, TriangleAlert, Gauge, Sparkles } from 'lucide-react';
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
  const [showFullCode, setShowFullCode] = useState(false);

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

  const safetyLabel = scriptValidation
    ? (scriptValidation.safetyScore >= 80 ? 'Seguro' : scriptValidation.safetyScore >= 50 ? 'Requiere revisión' : 'Riesgoso')
    : null;

  const safetyColor = scriptValidation
    ? (scriptValidation.safetyScore >= 80 ? 'var(--success)' : scriptValidation.safetyScore >= 50 ? 'var(--orange)' : 'var(--error)')
    : 'var(--ink3)';

  const hasAlerts = scriptValidation
    && (scriptValidation.invalidColumns.length > 0 || scriptValidation.destructiveOperations.length > 0 || scriptValidation.requiresHumanReview);

  return (
    <>
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">script asistido</p>
            <h2 className="sec-title">AURA prepara una propuesta de limpieza</h2>
          </div>
        </header>
        <p className="section-note">
          El script es una ayuda revisable, no una corrección automática.
        </p>

        <div className="companion-note">
          <Sparkles size={16} />
          <p>AURA usará el diagnóstico y las reglas detectadas para construir un script Pandas. Si el modelo falla, generará una base determinista para no bloquearte.</p>
        </div>

        <div className="stage-decision-summary">
          <div className="stage-summary-item">
            <span className="stage-summary-label">hallazgos base</span>
            <strong className="stage-summary-value">{report.issues.length}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="stage-summary-label">diagnóstico</span>
            <strong className="stage-summary-value">{diagnosisText.trim() ? 'disponible' : 'pendiente'}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="stage-summary-label">origen</span>
            <strong className="stage-summary-value">{scriptOrigin === 'deterministic' ? 'determinista' : scriptOrigin === 'model' ? 'modelo' : 'pendiente'}</strong>
          </div>
        </div>

        <div className="stage-actions">
          <button className="btn-p" onClick={generateScript} disabled={isLoading}>
            <FileCode2 size={14} />
            {isLoading ? 'Generando' : cleaningScript ? 'Regenerar propuesta' : 'Generar propuesta'}
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
            <div className="validation-minimal">
              <div className="validation-minimal-item">
                <ShieldCheck size={14} style={{ color: safetyColor }} />
                <span>Seguridad</span>
                <strong style={{ color: safetyColor }}>{safetyLabel}</strong>
              </div>
              <div className="validation-minimal-item">
                <Gauge size={14} />
                <span>Cobertura</span>
                <strong>{scriptValidation.coveragePercentage}%</strong>
              </div>
              <div className="validation-minimal-item">
                {hasAlerts ? (
                  <>
                    <TriangleAlert size={14} style={{ color: 'var(--orange)' }} />
                    <span>Alertas</span>
                    <strong style={{ color: 'var(--orange)' }}>revisar</strong>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    <span>Alertas</span>
                    <strong style={{ color: 'var(--success)' }}>sin alertas</strong>
                  </>
                )}
              </div>
            </div>

            <details className="validation-details">
              <summary>Ver matriz de validación completa</summary>
              <div className="script-validation-grid">
                <div className={`script-validation-card ${scriptValidation.safetyScore >= 80 ? 'script-validation-card--pass' : scriptValidation.safetyScore >= 50 ? 'script-validation-card--warn' : 'script-validation-card--fail'}`}>
                  <CheckCircle2 size={14} />
                  <span>Safety Score</span>
                  <strong>{scriptValidation.safetyScore}/100</strong>
                </div>
                <div className={`script-validation-card ${scriptValidation.invalidColumns.length === 0 ? 'script-validation-card--pass' : 'script-validation-card--warn'}`}>
                  {scriptValidation.invalidColumns.length === 0 ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
                  <span>Columnas existentes</span>
                  <strong>{scriptValidation.invalidColumns.length === 0 ? 'Sin columnas fantasma' : `${scriptValidation.invalidColumns.length} inválidas`}</strong>
                </div>
                <div className={`script-validation-card ${scriptValidation.coveragePercentage >= 50 ? 'script-validation-card--pass' : 'script-validation-card--warn'}`}>
                  <Gauge size={14} />
                  <span>Cobertura de hallazgos</span>
                  <strong>{scriptValidation.coveragePercentage}%</strong>
                </div>
                <div className={`script-validation-card ${scriptValidation.destructiveOperations.length === 0 ? 'script-validation-card--pass' : 'script-validation-card--warn'}`}>
                  {scriptValidation.destructiveOperations.length === 0 ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                  <span>Operaciones destructivas</span>
                  <strong>{scriptValidation.destructiveOperations.length === 0 ? 'No detectadas' : `${scriptValidation.destructiveOperations.length} detectadas`}</strong>
                </div>
              </div>
              {scriptValidation.warnings.length > 0 && (
                <ul className="script-validation-warnings">
                  {scriptValidation.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        )}

        {cleaningScript && (
          <div className="script-preview-section">
            <div className="script-preview-header">
              <div className="flex items-center gap-2">
                <FileCode2 size={14} style={{color:'var(--ink)'}} />
                <span className="eyebrow">Vista previa del script generado</span>
              </div>
              <button className="btn-s btn-sm" onClick={() => setShowFullCode(!showFullCode)}>
                {showFullCode ? 'Ocultar código' : 'Ver código completo'}
              </button>
            </div>
            <div className="script-governance-note">
              <ShieldCheck size={14} />
              <p>Esta etapa solo genera y valida. La aprobación humana ocurre en la siguiente pantalla.</p>
            </div>
            <div className="script-code-shell">
              <div className={`script-scroll custom-scrollbar ${showFullCode ? '' : 'script-scroll--preview'}`}>
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
        )}

        <details className="script-contract-details">
          <summary>Ver contrato usado para generar script</summary>
          <pre>{scriptPromptPreview}</pre>
        </details>
      </section>

      <div className="context-guide">
        <span className="guide-icon"><ArrowRight size={14} /></span>
        <div>
          <p className="guide-title">Revisar propuesta</p>
          <p className="guide-desc">AURA ya preparó una propuesta. El siguiente paso no es ejecutar: es revisar y aprobar.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue}>
          Revisar propuesta <ArrowRight size={12} />
        </button>
      </div>
    </>
  );
};

export default ScriptGenerationStep;
