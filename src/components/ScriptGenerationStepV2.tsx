/**
 * Script Generation Step v2 — Contractual pipeline.
 *
 * Handles the full script contract flow:
 * RemediationPlanV2 → ScriptBuildContextV2 → ScriptContractCandidateV2
 * → validateScriptCandidateV2 → finalizeScriptContractV2
 * → verifyScriptContractV2 → review
 *
 * NO AI imports:
 * - buildScriptPrompt, buildDiagnosisSummaryPrompt, extractPythonScript,
 * - buildDeterministicCleaningScript, aiProvider.generateText
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Copy,
  Download,
  FileCode2,
  Terminal,
} from 'lucide-react';
import {
  buildScriptCandidateV2,
  finalizeScriptContractV2,
  isContractsV2Enabled,
  validateScriptCandidateV2,
  verifyScriptContractV2,
} from '../contracts/llm';
import type {
  DiagnosisExecutionResult,
  RemediationPlanV2,
  ScriptContractV2,
  ScriptValidationResultV2,
} from '../contracts/llm';
import type { AuditReport } from '../types';
import { highlightPython } from '../services/highlightPython';
import { buildUiScriptContext } from '../services/scriptContractUiContext';
import RemediationPlanStepV2 from './RemediationPlanStepV2';

export interface ScriptGenerationStepV2Props {
  report: AuditReport;
  csvFields: string[];
  sourceDatasetFingerprint: string | null;
  structuredDiagnosis: DiagnosisExecutionResult | null;
  remediationPlan: RemediationPlanV2 | null;
  scriptContractV2: ScriptContractV2 | null;
  scriptContractVerificationV2: ScriptValidationResultV2 | null;
  onScriptContractChange: (contract: ScriptContractV2 | null, verification: ScriptValidationResultV2 | null) => void;
  onRemediationPlanChange: (plan: RemediationPlanV2) => void;
  onContinue: () => void;
  onLog?: (stage: string, msg: string) => void;
}

type GenerationView = 'decision' | 'contract';

interface GenerationState {
  status: 'idle' | 'building' | 'validating' | 'finalizing' | 'verifying' | 'done' | 'error';
  errorMessage?: string;
  contract?: ScriptContractV2;
  verification?: ScriptValidationResultV2;
}

const ScriptGenerationStepV2: React.FC<ScriptGenerationStepV2Props> = ({
  report,
  csvFields,
  sourceDatasetFingerprint,
  structuredDiagnosis,
  remediationPlan,
  scriptContractV2,
  scriptContractVerificationV2,
  onScriptContractChange,
  onRemediationPlanChange,
  onContinue,
  onLog,
}) => {
  const [view, setView] = useState<GenerationView>(
    scriptContractV2 ? 'contract' : 'decision',
  );
  const [genState, setGenState] = useState<GenerationState>(() => {
    if (scriptContractV2) {
      return {
        status: 'done',
        contract: scriptContractV2,
        verification: scriptContractVerificationV2 ?? undefined,
      };
    }
    return { status: 'idle' };
  });

  // Sync always from props — not conditional on view
  useEffect(() => {
    if (scriptContractV2) {
      setView('contract');
      setGenState({
        status: 'done',
        contract: scriptContractV2,
        verification: scriptContractVerificationV2 ?? undefined,
      });
    } else {
      setView('decision');
      setGenState({ status: 'idle' });
    }
  }, [scriptContractV2, scriptContractVerificationV2]);

  // Build context using shared helper — no manual refs
  const contextResult = useMemo(
    () =>
      buildUiScriptContext({
        structuredDiagnosis,
        csvFields,
        sourceDatasetFingerprint,
      }),
    [structuredDiagnosis, csvFields, sourceDatasetFingerprint],
  );

  const canGenerate = useMemo(
    () => !!remediationPlan && contextResult.ok,
    [remediationPlan, contextResult],
  );

  const handleGenerate = useCallback(
    (plan: RemediationPlanV2) => {
      if (!contextResult.ok) return;

      // Defensive: propagate plan to parent before building context
      // (useEffect propagation is async; parent state may still be null here)
      onRemediationPlanChange(plan);

      setGenState({ status: 'building' });
      onLog?.('script.v2', 'build.start');

      try {
        const candidate = buildScriptCandidateV2(plan, contextResult.buildContext);
        setGenState({ status: 'validating' });

        const validationResult = validateScriptCandidateV2(
          candidate,
          plan,
          contextResult.buildContext,
        );
        if (!validationResult.valid) {
          setGenState({
            status: 'error',
            errorMessage: `Validación fallida: ${validationResult.errors
              .slice(0, 3)
              .map((e) => e.message)
              .join('; ')}`,
          });
          onLog?.(
            'script.v2',
            `validate.failed :: ${validationResult.errors[0]?.message ?? 'unknown'}`,
          );
          return;
        }

        setGenState({ status: 'finalizing' });
        const contract = finalizeScriptContractV2(candidate, validationResult);

        setGenState({ status: 'verifying' });
        const freshVerification = verifyScriptContractV2(
          contract,
          plan,
          contextResult.buildContext,
        );

        if (!freshVerification.valid) {
          setGenState({
            status: 'error',
            errorMessage: `Verificación fallida: ${freshVerification.errors
              .slice(0, 3)
              .map((e) => e.message)
              .join('; ')}`,
          });
          onLog?.(
            'script.v2',
            `verify.failed :: ${freshVerification.errors[0]?.message ?? 'unknown'}`,
          );
          return;
        }

        setGenState({ status: 'done', contract, verification: freshVerification });
        setView('contract');
        onScriptContractChange(contract, freshVerification);
        onLog?.('script.v2', `done :: hash=${contract.scriptHash.slice(0, 12)}`);
      } catch (err: any) {
        setGenState({
          status: 'error',
          errorMessage: err?.message ?? 'Error desconocido',
        });
        onLog?.('script.v2', `error :: ${err?.message ?? 'unknown'}`);
      }
    },
    [contextResult, onScriptContractChange, onRemediationPlanChange, onLog],
  );

  const contractValid =
    genState.status === 'done' &&
    genState.contract &&
    genState.verification?.valid === true;

  const partition = useMemo(() => {
    if (!genState.contract) return null;
    const c = genState.contract;
    return {
      accepted: c.acceptedActionIds.length,
      rejected: c.rejectedActionIds.length,
      excluded: c.excludedActionIds.length,
      total: c.acceptedActionIds.length + c.rejectedActionIds.length + c.excludedActionIds.length,
    };
  }, [genState.contract]);

  const excludedActions = useMemo(() => {
    if (!genState.contract) return [];
    return genState.contract.excludedActionIds;
  }, [genState.contract]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  }, []);

  const handleDownload = useCallback((text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `limpieza_dataset_${Date.now()}.py`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  if (!isContractsV2Enabled()) {
    return (
      <section className="section">
        <p className="section-note">Contracts v2 no está habilitado.</p>
      </section>
    );
  }

  if (!sourceDatasetFingerprint || !structuredDiagnosis?.remediationContext) {
    return (
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">contrato de script v2</p>
            <h2 className="sec-title">Sin validar</h2>
          </div>
        </header>
        <p className="section-note">
          Falta:{' '}
          {!sourceDatasetFingerprint ? 'fingerprint del dataset' : ''}
          {!structuredDiagnosis?.remediationContext
            ? ' remediationContext del diagnóstico'
            : ''}
        </p>
      </section>
    );
  }

  // Vista A — Decision: reuse RemediationPlanStepV2
  if (view === 'decision' || genState.status === 'idle') {
    return (
      <section className="section" data-testid="script-gen-v2-stage">
        <RemediationPlanStepV2
          report={report}
          structuredDiagnosis={structuredDiagnosis}
          remediationPlan={remediationPlan}
          continueLabel={genState.status === 'building' ? 'Generando...' : 'Generar contrato de script'}
          onRemediationPlanChange={onRemediationPlanChange}
          onContinueWithPlan={handleGenerate}
          onContinue={() => {}}
        />
        {genState.status === 'error' && (
          <div
            className="provider-error-notice"
            style={{ marginTop: 'var(--space-md)' }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
            <span>{genState.errorMessage}</span>
          </div>
        )}
      </section>
    );
  }

  // Loading states
  if (genState.status === 'building' || genState.status === 'validating' || genState.status === 'finalizing' || genState.status === 'verifying') {
    const labels: Record<string, string> = {
      building: 'Construyendo candidato...',
      validating: 'Validando contrato...',
      finalizing: 'Finalizando contrato...',
      verifying: 'Verificando contrato...',
    };
    return (
      <section className="section" data-testid="script-gen-v2-stage">
        <header className="section-header">
          <div>
            <p className="sec-eye">contrato de script v2</p>
            <h2 className="sec-title">Generando contrato...</h2>
          </div>
        </header>
        <p className="section-note">{labels[genState.status]}</p>
      </section>
    );
  }

  // Error state
  if (genState.status === 'error') {
    return (
      <section className="section" data-testid="script-gen-v2-stage">
        <header className="section-header">
          <div>
            <p className="sec-eye">contrato de script v2</p>
            <h2 className="sec-title">Validación fallida</h2>
          </div>
        </header>
        <div
          className="provider-error-notice"
          style={{ marginBottom: 'var(--space-md)' }}
        >
          <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
          <span>{genState.errorMessage}</span>
        </div>
        <button className="btn-s" onClick={() => setView('decision')}>
          Volver al plan
        </button>
      </section>
    );
  }

  // Vista B — Contract display
  const contract = genState.contract!;
  const verification = genState.verification!;
  const scriptLines = contract.scriptText.split('\n');

  return (
    <section className="section" data-testid="script-gen-v2-stage">
      <header className="section-header">
        <div>
          <p className="sec-eye">contrato de script v2</p>
          <h2 className="sec-title">Contrato de script</h2>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
          }}
        >
          {contractValid ? (
            <>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                Contrato válido
              </span>
            </>
          ) : (
            <>
              <Ban size={16} style={{ color: 'var(--error)' }} />
              <span style={{ color: 'var(--error)', fontWeight: 600 }}>
                Validación fallida
              </span>
            </>
          )}
        </div>
      </header>

      {partition && (
        <div className="stage-decision-summary" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="stage-summary-item" data-testid="partition-accepted">
            <span className="stage-summary-label">aceptadas</span>
            <strong style={{ color: 'var(--success)' }}>
              {partition.accepted}
            </strong>
          </div>
          <div className="stage-summary-item" data-testid="partition-rejected">
            <span className="stage-summary-label">rechazadas</span>
            <strong style={{ color: 'var(--error)' }}>
              {partition.rejected}
            </strong>
          </div>
          <div className="stage-summary-item" data-testid="partition-excluded">
            <span className="stage-summary-label">excluidas</span>
            <strong style={{ color: 'var(--orange)' }}>
              {partition.excluded}
            </strong>
          </div>
          <div className="stage-summary-item">
            <span className="stage-summary-label">columnas</span>
            <strong>{contract.columnRefs.length}</strong>
          </div>
        </div>
      )}

      {excludedActions.length > 0 && (
        <div
          style={{
            marginBottom: 'var(--space-md)',
            padding: '10px',
            background: 'var(--surface2)',
            borderRadius: '6px',
          }}
        >
          <h4
            style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '6px',
            }}
          >
            Acciones excluidas
          </h4>
          {excludedActions.slice(0, 10).map((ex) => (
            <div
              key={ex.actionId}
              data-testid={`excluded-action-${ex.actionId}`}
              style={{ fontSize: '11px', color: 'var(--ink2)', marginBottom: '2px' }}
            >
              <span style={{ fontFamily: 'monospace' }}>{ex.actionId}</span>
              <span style={{ color: 'var(--ink3)', marginLeft: '6px' }}>
                — {ex.reason}
              </span>
            </div>
          ))}
          {excludedActions.length > 10 && (
            <p style={{ fontSize: '11px', color: 'var(--ink3)' }}>
              +{excludedActions.length - 10} más
            </p>
          )}
        </div>
      )}

      {verification.warnings.length > 0 && (
        <div
          style={{
            marginBottom: 'var(--space-md)',
            padding: '8px 10px',
            background: 'color-mix(in srgb, var(--orange) 10%, transparent)',
            borderRadius: '6px',
            borderLeft: '3px solid var(--orange)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--orange)',
              marginBottom: '4px',
            }}
          >
            Advertencias
          </div>
          {verification.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '11px', color: 'var(--ink2)' }}>
              <span style={{ fontFamily: 'monospace' }}>[{w.code}]</span>{' '}
              {w.message}
            </div>
          ))}
        </div>
      )}

      {verification.errors.length > 0 && (
        <div
          style={{
            marginBottom: 'var(--space-md)',
            padding: '8px 10px',
            background: 'color-mix(in srgb, var(--error) 10%, transparent)',
            borderRadius: '6px',
            borderLeft: '3px solid var(--error)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--error)',
              marginBottom: '4px',
            }}
          >
            Errores
          </div>
          {verification.errors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: '11px', color: 'var(--ink2)' }}>
              <span style={{ fontFamily: 'monospace' }}>[{e.code}]</span>{' '}
              {e.message}
            </div>
          ))}
        </div>
      )}

      <div className="script-review">
        <div className="script-review-header">
          <div className="flex items-center gap-2">
            <Terminal size={14} style={{ color: 'var(--ink)' }} />
            <span className="eyebrow">python — script v2</span>
          </div>
          <div className="script-actions">
            <button
              className="cs-button cs-button-sm"
              title="Copiar al portapapeles"
              onClick={() => handleCopy(contract.scriptText)}
            >
              <Copy size={12} />
              Copiar
            </button>
            <button
              className="cs-button cs-button-sm cs-button-primary"
              title="Descargar script .py"
              onClick={() => handleDownload(contract.scriptText)}
            >
              <Download size={12} />
              Guardar .py
            </button>
          </div>
        </div>

        <div className="script-code-shell">
          <div className="script-scroll custom-scrollbar">
            <pre className="script-code">
              {scriptLines.map((line, index) => (
                <span key={`${index}-${line}`} className="script-line">
                  <span className="line-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <code
                    dangerouslySetInnerHTML={{
                      __html: highlightPython(line) || ' ',
                    }}
                  />
                </span>
              ))}
            </pre>
          </div>
          <div className="script-watermark">
            <FileCode2 size={24} />
            <span>AURA GOVERNANCE</span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 'var(--space-md)',
          fontSize: '11px',
          color: 'var(--ink3)',
          fontFamily: 'monospace',
        }}
      >
        renderer: {contract.rendererVersion} · placeholder:{' '}
        {contract.placeholderVocabularyVersion} · hash:{' '}
        <span data-testid="contract-hash">{contract.scriptHash.slice(0, 12)}</span>
        {contract.validationResult.pythonSyntax.state === 'not_run' && (
          <span style={{ color: 'var(--orange)', marginLeft: '8px' }} data-testid="syntax-state">
            syntax: not_run (Python no disponible en navegador)
          </span>
        )}
      </div>

      <div
        className="evidence-options"
        data-testid="primary-stage-action"
        style={{ marginTop: 'var(--space-lg)' }}
      >
        <button
          className="btn-p btn-sm"
          disabled={!contractValid}
          onClick={onContinue}
        >
          Continuar a revisión <ArrowRight size={12} />
        </button>
        <button
          className="btn-s btn-sm"
          style={{ marginLeft: 'var(--space-sm)' }}
          onClick={() => {
            onScriptContractChange(null, null);
            setView('decision');
            setGenState({ status: 'idle' });
          }}
        >
          Volver al plan
        </button>
      </div>

      <details
        className="technical-details"
        style={{ marginTop: 'var(--space-lg)' }}
      >
        <summary className="technical-details-summary">
          <span>Detalles técnicos</span>
        </summary>
        <div className="technical-details-body">
          {genState.contract && (
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                Errores de validación
              </h4>
              {genState.verification?.errors.length === 0 ? (
                <p style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                  Sin errores
                </p>
              ) : (
                genState.verification?.errors.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ color: 'var(--error)' }}>{e.code}</span>{' '}
                    {e.path && (
                      <span style={{ color: 'var(--ink3)' }}>{e.path}</span>
                    )}{' '}
                    {e.message}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </details>
    </section>
  );
};

export default ScriptGenerationStepV2;
