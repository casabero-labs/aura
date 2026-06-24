import React, { useCallback, useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, FileCode2, ShieldAlert, ShieldCheck, TriangleAlert, Gauge, Sparkles, AlertTriangle, Ban } from 'lucide-react';
import { AIProvider, ProviderMetrics, ScriptValidationResult, ProgressDisclosureStatus, AuditReport } from '../types';
import ProgressDisclosure from './ProgressDisclosure';
import { highlightPython } from '../services/highlightPython';
import { buildDeterministicCleaningScript, buildFallbackScriptMetrics } from '../services/deterministicScriptBuilder';
import { buildDiagnosisScriptBrief, buildDiagnosisSummaryPrompt, buildScriptPrompt, extractPythonScript } from '../services/providers/prompts';
import { isContractsV2Enabled, buildRemediationPlanV2, validateRemediationPlanV2, approveRemediationActionV2, rejectRemediationActionV2, resetRemediationActionV2 } from '../contracts/llm';
import type { DiagnosisExecutionResult, RemediationPlanV2 } from '../contracts/llm';

interface ScriptGenerationStepProps {
  report: AuditReport;
  aiProvider: AIProvider;
  diagnosisText: string;
  cleaningScript: string;
  scriptValidation: ScriptValidationResult | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  remediationPlan?: RemediationPlanV2 | null;
  onRemediationPlanChange?: (plan: RemediationPlanV2) => void;
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
  structuredDiagnosis,
  remediationPlan,
  onRemediationPlanChange,
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
  const [scriptProgressStatus, setScriptProgressStatus] = useState<ProgressDisclosureStatus>('idle');
  const [scriptProgressStep, setScriptProgressStep] = useState('');

  const useFallbackScript = useCallback((reason: string) => {
    const fallbackScript = buildDeterministicCleaningScript(report);
    const metrics = buildFallbackScriptMetrics();
    setScriptOrigin('deterministic');
    setStreamingMetrics(metrics);
    onScriptGenerated(fallbackScript, metrics);
    onLog?.('script', `Script determinista generado como respaldo :: ${reason}`);
  }, [onLog, onScriptGenerated, report]);

  // ── Contracts v2: deterministic RemediationPlan ──
  const isV2 = isContractsV2Enabled() && !!structuredDiagnosis;
  const [v2Plan, setV2Plan] = useState<RemediationPlanV2 | null>(remediationPlan ?? null);
  const [v2PlanError, setV2PlanError] = useState<string | null>(null);

  useEffect(() => {
    if (!isV2 || remediationPlan) return;
    try {
      if (!structuredDiagnosis?.remediationContext) {
        setV2PlanError('remediationContext not found in diagnosis result');
        return;
      }
      const plan = buildRemediationPlanV2(structuredDiagnosis);
      const validation = validateRemediationPlanV2(plan, structuredDiagnosis);
      if (!validation.valid) {
        setV2PlanError(`Plan validation failed: ${validation.errors.map(e => e.message).join('; ')}`);
        return;
      }
      setV2Plan(plan);
      onRemediationPlanChange?.(plan);
    } catch (e) {
      setV2PlanError(`Error building remediation plan: ${(e as Error).message}`);
    }
  }, [isV2, structuredDiagnosis, remediationPlan]);

  const handleApprove = useCallback((actionId: string) => {
    if (!v2Plan) return;
    const result = approveRemediationActionV2(v2Plan, actionId);
    if (result.success) { setV2Plan(result.plan); onRemediationPlanChange?.(result.plan); }
  }, [v2Plan, onRemediationPlanChange]);

  const handleReject = useCallback((actionId: string) => {
    if (!v2Plan) return;
    const result = rejectRemediationActionV2(v2Plan, actionId);
    if (result.success) { setV2Plan(result.plan); onRemediationPlanChange?.(result.plan); }
  }, [v2Plan, onRemediationPlanChange]);

  const handleReset = useCallback((actionId: string) => {
    if (!v2Plan) return;
    const result = resetRemediationActionV2(v2Plan, actionId);
    if (result.success) { setV2Plan(result.plan); onRemediationPlanChange?.(result.plan); }
  }, [v2Plan, onRemediationPlanChange]);

  const generateScript = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setStreamingText('');
    setStreamingMetrics(null);
    setScriptOrigin(null);
    setScriptProgressStatus('running');
    setScriptProgressStep('Resumiendo diagnóstico');
    onLog?.('script', 'Generando script desde diagnostico previo y paquete estructurado');

    if (!diagnosisText.trim()) {
      onLog?.('script', 'Sin diagnóstico LLM; usando script base determinista');
      setScriptProgressStep('Generando script determinista');
      useFallbackScript('diagnóstico no disponible');
      setScriptProgressStatus('success');
      setScriptProgressStep('Script determinista listo');
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

      setScriptProgressStep('Generando script de limpieza');
      const prompt = buildScriptPrompt(report, diagnosisText, operativeBrief);
      const { text, metrics } = await aiProvider.generateText(prompt);
      setStreamingText(text);
      const pythonScript = extractPythonScript(text);

      if (!pythonScript || !pythonScript.includes('clean_dataset')) {
        const msg = 'El modelo no entregó un script Python/Pandas estructurado; AURA generó un script base determinista para revisión.';
        setError(msg);
        useFallbackScript('sin python_script');
        setScriptProgressStatus('warning');
        setScriptProgressStep('Script determinista de respaldo generado');
        return;
      }

      setScriptOrigin('model');
      onScriptGenerated(pythonScript, metrics);
      setStreamingMetrics(metrics);
      setScriptProgressStatus('success');
      setScriptProgressStep(`Script generado · ${pythonScript.split('\n').length} líneas`);
      onLog?.('script', `Script generado desde diagnóstico · ${pythonScript.split('\n').length} líneas · ${metrics.latencyMs}ms`);
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido generando script';
      setError(`No se pudo usar la salida del modelo. AURA generó un script base determinista para no bloquear el flujo. Detalle: ${msg}`);
      useFallbackScript(msg);
      setScriptProgressStatus('warning');
      setScriptProgressStep('Script determinista de respaldo generado');
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
      {isV2 && v2Plan ? (
        <section className="section" data-testid="remediation-stage">
          <header className="section-header">
            <div>
              <p className="sec-eye">remediación estructurada v2</p>
              <h2 className="sec-title">Plan de remediación determinista</h2>
            </div>
          </header>
          <p className="section-note">
            Plan estructurado listo. La generación determinista del script se realizará en la siguiente fase.
          </p>

          {v2PlanError && (
            <div className="provider-error-notice" style={{ marginBottom: 'var(--space-md)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
              <span>{v2PlanError}</span>
            </div>
          )}

          <div className="stage-decision-summary" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="stage-summary-item">
              <span className="stage-summary-label">acciones</span>
              <strong className="stage-summary-value">{v2Plan.plan.length}</strong>
            </div>
            <div className="stage-summary-item">
              <span className="stage-summary-label">auto-safe</span>
              <strong className="stage-summary-value">{v2Plan.plan.filter(a => a.actionability === 'auto_safe').length}</strong>
            </div>
            <div className="stage-summary-item">
              <span className="stage-summary-label">review</span>
              <strong className="stage-summary-value">{v2Plan.plan.filter(a => a.actionability === 'review_only').length}</strong>
            </div>
            <div className="stage-summary-item">
              <span className="stage-summary-label">exclusiones</span>
              <strong className="stage-summary-value">{v2Plan.exclusions.length}</strong>
            </div>
          </div>

          {v2Plan.plan.map((action, i) => (
            <div key={action.actionId} className="stage-result" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                    {i + 1}. [{action.actionType}] {action.ruleId}
                    {action.columnId ? ` → ${action.columnId}` : ' (dataset)'}
                  </h4>
                  <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '2px' }}>
                    {action.actionability === 'auto_safe' ? '✓ Automático' : action.actionability === 'review_only' ? '⚠️ Revisión requerida' : 'No accionable'} · {action.evidenceRefs.length} evidencias
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink3)', fontFamily: 'monospace', marginTop: '2px' }}>
                    {action.actionId}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {action.approvalStatus === 'pending' && (
                    <>
                      <button className="btn-s btn-sm" onClick={() => handleApprove(action.actionId)} style={{ background: 'var(--success-bg)', color: 'var(--success-fg)' }}>
                        <CheckCircle2 size={12} /> Aprobar
                      </button>
                      <button className="btn-s btn-sm" onClick={() => handleReject(action.actionId)} style={{ background: 'var(--error-bg)', color: 'var(--error-fg)' }}>
                        <AlertTriangle size={12} /> Rechazar
                      </button>
                    </>
                  )}
                  {action.approvalStatus === 'approved' && (
                    <button className="btn-s btn-sm" onClick={() => handleReset(action.actionId)} style={{ background: 'var(--success-bg)', color: 'var(--success-fg)' }}>
                      <ShieldCheck size={12} /> Aprobado
                    </button>
                  )}
                  {action.approvalStatus === 'rejected' && (
                    <button className="btn-s btn-sm" onClick={() => handleReset(action.actionId)} style={{ background: 'var(--error-bg)', color: 'var(--error-fg)' }}>
                      <Ban size={12} /> Rechazado
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {v2Plan.exclusions.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)', padding: '10px', background: 'var(--surface2)', borderRadius: '6px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Exclusiones (not_actionable)</h4>
              {v2Plan.exclusions.map(ex => (
                <div key={ex.issueId} style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                  {ex.issueId}: {ex.reason}
                </div>
              ))}
            </div>
          )}

          <div className="evidence-options" data-testid="primary-stage-action" style={{ marginTop: 'var(--space-lg)' }}>
            <button className="btn-p btn-sm" onClick={onContinue}>
              Continuar a revisión <ArrowRight size={12} />
            </button>
          </div>
        </section>
      ) : isV2 ? (
        <section className="section" data-testid="remediation-stage">
          <header className="section-header">
            <div>
              <p className="sec-eye">remediación estructurada v2</p>
              <h2 className="sec-title">Plan de remediación determinista</h2>
            </div>
          </header>
          {v2PlanError ? (
            <div className="provider-error-notice" style={{ marginBottom: 'var(--space-md)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
              <span>{v2PlanError}</span>
            </div>
          ) : (
            <p className="section-note">Construyendo plan de remediación determinista...</p>
          )}
        </section>
      ) : (
      <section className="section" data-testid="script-stage">
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

        <div className="stage-decision-summary" data-testid="stage-decision-summary">
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

        {scriptProgressStatus !== 'idle' && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            <ProgressDisclosure
              title={scriptProgressStatus === 'running' ? 'Generando propuesta de limpieza' : scriptProgressStatus === 'success' ? 'Propuesta lista' : 'Script de respaldo generado'}
              description={scriptProgressStatus === 'running' ? 'AURA resume el diagnóstico y genera el script. Si el modelo falla, usará un respaldo determinista.' : undefined}
              indeterminate={scriptProgressStatus === 'running'}
              status={scriptProgressStatus}
              currentStep={scriptProgressStep}
              compact
            />
          </div>
        )}

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
            <div className="script-preview-cta" data-testid="primary-stage-action">
              <button className="btn-p btn-sm" onClick={onContinue}>
                Revisar propuesta <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        <details className="script-contract-details" data-testid="technical-details">
          <summary>Ver contrato usado para generar script</summary>
          <pre>{scriptPromptPreview}</pre>
        </details>
      </section>
      )}
    </>
  );
};

export default ScriptGenerationStep;
