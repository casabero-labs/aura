// ── Phase 6 Loop 4: ImprovementRunPanel — Visual States ──
// Enhanced idle / running / done / error states.
// Uses controlled fixtures only. Delegates Python execution to Colab.

import React, { useState, useEffect } from 'react';
import HealthDeltaDashboard from './HealthDeltaDashboard';
import ImprovementRunExportCard from './ImprovementRunExportCard';
import ExecutionLogsPanel from './ExecutionLogsPanel';
import { detectDemoMode, DEMO_MODE_NOTICE } from '../utils/demoMode';

type PanelState = 'idle' | 'running' | 'done' | 'error';

interface RunResult {
  improvementRun: import('../services/improvementRunService').ImprovementRunV1;
  logs: string[];
}

interface Props {
  beforeCsv?: string;
  afterCsv?: string;
  datasetName?: string;
  evidenceRef?: string;
}

const BEFORE = `Address,City,CallDateTime,CrimeId
"123 Main St","SAN FRANCISCO","2024-01-01",160903280
"456 Oak Ave","LOS ANGELES","2024-01-02",160903281
"789 Pine Rd","CHICAGO","2024-01-03",160903282
`;

const AFTER = `Address,City,CallDateTime,CrimeId
"123 Main St","san francisco","2024-01-01",160903280
"456 Oak Ave","los angeles","2024-01-02",160903281
"789 Pine Rd","chicago","2024-01-03",160903282
`;

const RUNTIME_STEPS = [
  'Preparando datos de prueba controlados',
  'Validando contrato',
  'Generando contexto del notebook Colab',
  'Importando salida de prueba de Colab',
  'Ejecutando reauditoría de AURA',
  'Calculando cambio de salud',
] as const;

const ImprovementRunPanel: React.FC<Props> = ({
  beforeCsv = BEFORE,
  afterCsv = AFTER,
  datasetName = 'demo_fixture.csv',
  evidenceRef = 'env:panel_demo_ref',
}) => {
  const [state, setState] = useState<PanelState>('idle');
  const [result, setResult] = useState<RunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Phase 7 L2B + Phase 8 L1: Visual testability harness (opt-in, non-production) ──
  // Activated only via ?phase7Visual=running or ?phase7Visual=error query param.
  // Activated only via ?demoMode=1 (Phase 8 generic).
  // Does NOT execute Python, does NOT use real datasets.
  // For E2E visual evidence capture only.
  // Detection centralized in src/utils/demoMode.ts.
  useEffect(() => {
    const demo = detectDemoMode();
    if (!demo.active) return;

    if (demo.visual === 'running') {
      setState('running');
      const timer = setTimeout(() => {
        setState('done');
        setResult({
          improvementRun: {
            contractId: 'aura.improvement_run.v1',
            contractVersion: '1.0.0',
            runId: 'run:visual-harness',
            createdAt: new Date().toISOString(),
            sourceDatasetFingerprint: 'sha256:visual',
            sourceEvidenceEnvelopeRef: 'env:visual',
            scriptContractRef: 'ref:visual',
            scriptHash: 'hash:visual',
            remediationPlanId: 'plan:visual',
            acceptedActionIds: [],
            execution: { status: 'success', runtime: 'colab_notebook', runtimeVersion: '1.0.0', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 0, logs: [], error: null, sandbox: { networkDisabled: true, filesystemRestricted: true, timeoutMs: 30000, memoryLimitMb: 512, allowedImports: [] } },
            outputDataset: { rowCountBefore: 3, rowCountAfter: 3, columnCountBefore: 4, columnCountAfter: 4, outputFingerprint: 'sha256:visual-fixture', changedCellsEstimate: 3, exportedCsvRef: null },
            reaudit: {
              beforeEvidenceEnvelopeRef: 'env:visual-before',
              afterEvidenceEnvelopeRef: 'env:visual-after',
              beforeIssueCount: 3,
              afterIssueCount: 0,
              rulesCompared: [],
            },
            healthDelta: { status: 'improved', scoreBefore: 75, scoreAfter: 100, delta: 25, issueDelta: -3, summary: 'Visual harness mock', caveats: [] },
            limitations: [],
            claims: { permitted: [], prohibited: [] },
          },
          logs: [
            '[visual] improvement flow started',
            '[visual] step 1: executeControlledRun',
            '[visual] step 2: importColabOutput',
            '[visual] step 3: runReaudit',
            '[visual] step 4: computeHealthDelta',
            '[visual] step 5: buildImprovementRunV1',
            '[visual] improvement run run:visual-harness created',
          ],
        });
      }, 3000);
      return () => clearTimeout(timer);
    }

    if (demo.visual === 'error') {
      setState('error');
      setErrorMessage('Arnés visual: estado de error forzado para la captura E2E.');
    }
  }, []);

  const handleRun = async () => {
    setState('running');
    setErrorMessage(null);
    setResult(null);

    try {
      const [svc, col, ctxMod, bld, val] = await Promise.all([
        import('../services/improvementRunService'),
        import('../contracts/llm/columnRegistry'),
        import('../contracts/llm/scriptBuildContext'),
        import('../contracts/llm/scriptBuilderV2'),
        import('../contracts/llm/scriptValidatorV2'),
      ]);

      const colRefs = col.buildColumnRegistry(['City']);
      const colId = colRefs[0].columnId;

      const plan = {
        contractId: 'aura.remediation.v2',
        contractVersion: '2.0.0',
        planId: 'plan:panel_demo',
        diagnosisRef: 'diag:panel_demo',
        evidenceEnvelopeRef: evidenceRef,
        datasetFingerprint: 'sha256:panel_demo_fp',
        plan: [{
          actionId: 'act:demo_city_normalize',
          issueId: 'issue:demo',
          ruleId: 'rule:city_casing',
          columnId: colId,
          actionType: 'normalize_casing',
          parameters: { strategy: 'lowercase' },
          actionability: 'auto_safe',
          evidenceRefs: [],
          approvalStatus: 'approved',
        }],
        actionabilityMap: {},
        exclusions: [],
        generatedAt: new Date().toISOString(),
      };

      const ctx = ctxMod.buildScriptContext(
        {
          evidenceEnvelopeRef: plan.evidenceEnvelopeRef,
          datasetFingerprint: plan.datasetFingerprint,
          columns: colRefs.map((c: any) => ({
            columnId: c.columnId, name: c.name, position: c.position,
            duplicateOrdinal: c.duplicateOrdinal, isAmbiguous: c.isAmbiguous, isDuplicate: c.isDuplicate,
          })),
          issues: [],
        },
        colRefs,
        plan.datasetFingerprint,
      );

      const candidate = bld.buildScriptCandidateV2(plan as any, ctx as any, { generatedAt: new Date().toISOString() });
      const validation = val.validateScriptCandidateV2(candidate, plan as any, ctx as any);
      const contract: any = bld.finalizeScriptContractV2(candidate, validation);

      const flow = svc.runImprovementFlow(contract as any, plan as any, ctx as any, {
        beforeEvidenceRef: evidenceRef,
        beforeCsv,
        afterCsv,
        datasetName,
      });

      setResult({
        improvementRun: flow.improvementRun,
        logs: flow.improvementRun.execution.logs,
      });
      setState('done');
    } catch (err: any) {
      setErrorMessage(err.message ?? String(err));
      setState('error');
    }
  };

  return (
    <section data-testid="improvement-run-panel" className="improvement-run-panel">
      <div className="panel-header">
        <h2>Ejecución de mejora</h2>
        <p className="panel-subtitle">Flujo completo sobre datos de prueba controlados.</p>
      </div>

      {/* ── Phase 8 L1: Demo/Prod Boundary — explicit demo banner ── */}
      {/* Only shown when an explicit demo/evidence flag is present.
          In normal/product mode (no flag), this banner must NOT render. */}
      {detectDemoMode().active && (
        <div
          data-testid="demo-mode-banner"
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 0,
            padding: '8px 14px',
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.5 }}>
            {DEMO_MODE_NOTICE}
          </p>
        </div>
      )}

      {state === 'idle' && (
        <IdleState datasetName={datasetName} beforeCsvSize={beforeCsv.length} afterCsvSize={afterCsv.length} onRun={handleRun} />
      )}

      {state === 'running' && (
        <RunningState />
      )}

      {state === 'done' && result && (
        <DoneState result={result} onRunAgain={() => { setState('idle'); setResult(null); setErrorMessage(null); }} />
      )}

      {state === 'error' && (
        <ErrorState message={errorMessage} onRetry={handleRun} />
      )}
    </section>
  );
};

function IdleState({ datasetName, beforeCsvSize, afterCsvSize, onRun }: { datasetName: string; beforeCsvSize: number; afterCsvSize: number; onRun: () => void }) {
  return (
    <div data-testid="idle-state" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '12px 16px' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
          Esta ejecución recorre el flujo de mejora completo sobre una <strong>copia de prueba controlada</strong> del dataset. No se modifica ningún dato original.
        </p>
      </div>

      <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '12px 16px' }}>
        <table style={{ margin: 0, borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ color: 'var(--ink-muted)', padding: '2px 0', width: '40%' }}>Dataset de prueba</td>
              <td style={{ fontWeight: 500, color: 'var(--ink)', padding: '2px 0' }}>{datasetName}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--ink-muted)', padding: '2px 0' }}>CSV antes</td>
              <td style={{ color: 'var(--ink2)', padding: '2px 0', fontFamily: 'monospace', fontSize: 12 }}>{beforeCsvSize} bytes</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--ink-muted)', padding: '2px 0' }}>CSV después</td>
              <td style={{ color: 'var(--ink2)', padding: '2px 0', fontFamily: 'monospace', fontSize: 12 }}>{afterCsvSize} bytes</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button data-testid="run-button" className="run-button" onClick={onRun}
        style={{ padding: '10px 20px', fontSize: 14, borderRadius: 0, border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontWeight: 500 }}>
        Ejecutar flujo de mejora
      </button>

      <div data-testid="colab-notice" style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python en el navegador. El flujo delega la ejecución de Python en un notebook Colab externo. No se accede a datasets reales.
        </p>
      </div>
    </div>
  );
}

function RunningState() {
  return (
    <div data-testid="running-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '24px 0' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          width: 20, height: 20, border: '2px solid var(--line)', borderTop: '2px solid var(--ink)',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>Ejecutando flujo de mejora…</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400 }}>
        {RUNTIME_STEPS.map((step, i) => (
          <div key={i} data-testid={`step-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink2)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--ink)', flexShrink: 0 }} />
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px', maxWidth: 480 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python directamente. El notebook Colab se ejecuta fuera, con la copia de prueba controlada.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DoneState({ result, onRunAgain }: { result: RunResult; onRunAgain: () => void }) {
  return (
    <div data-testid="done-state" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14, color: 'var(--ink)' }}>✓ Ejecución completada — </span>
        <span data-testid="run-id" style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--ink)' }}>{result.improvementRun.runId}</span>
      </div>

      <div data-testid="fixture-notice" style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <strong>Nota:</strong> esta ejecución usó una <strong>copia de prueba controlada</strong> del dataset. No se modificó ningún dato original.
        </p>
      </div>

      <div data-testid="colab-notice" style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python. El flujo se ejecutó fuera, en un notebook Colab, con la copia de prueba controlada.
        </p>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ background: 'transparent', padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>Cambio de salud</span>
        </div>
        <div style={{ padding: 16 }}>
          <HealthDeltaDashboard
            status={result.improvementRun.healthDelta.status}
            scoreBefore={result.improvementRun.healthDelta.scoreBefore}
            scoreAfter={result.improvementRun.healthDelta.scoreAfter}
            delta={result.improvementRun.healthDelta.delta}
            issueDelta={result.improvementRun.healthDelta.issueDelta}
            beforeIssueCount={result.improvementRun.reaudit.beforeIssueCount}
            afterIssueCount={result.improvementRun.reaudit.afterIssueCount}
            summary={result.improvementRun.healthDelta.summary}
            caveats={result.improvementRun.healthDelta.caveats}
            outputRowCountBefore={result.improvementRun.outputDataset.rowCountBefore}
            outputRowCountAfter={result.improvementRun.outputDataset.rowCountAfter}
            outputColumnCountBefore={result.improvementRun.outputDataset.columnCountBefore}
            outputColumnCountAfter={result.improvementRun.outputDataset.columnCountAfter}
            changedCellsEstimate={result.improvementRun.outputDataset.changedCellsEstimate}
          />
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ background: 'transparent', padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>Registro de ejecución</span>
        </div>
        <div style={{ padding: 16 }}>
          <ExecutionLogsPanel
            logs={result.logs}
            execution={result.improvementRun.execution}
          />
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ background: 'transparent', padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>Exportación</span>
        </div>
        <div style={{ padding: 16 }}>
          <ImprovementRunExportCard improvementRun={result.improvementRun} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button data-testid="run-again-button" className="run-button" onClick={onRunAgain}
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 0, border: '1px solid var(--border-strong)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--ink2)' }}>
          Ejecutar de nuevo
        </button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div data-testid="error-state" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16, color: 'var(--ink)' }}>✗</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>La ejecución falló</span>
        </div>
        <p data-testid="error-message" style={{ margin: 0, fontSize: 13, color: 'var(--ink)', fontFamily: 'monospace', lineHeight: 1.6, wordBreak: 'break-all' }}>
          {message ?? 'Error desconocido.'}
        </p>
      </div>

      <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '12px 16px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>Posibles causas</p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.8 }}>
          <li>Falló la validación del contrato: el script y el plan no coinciden</li>
          <li>La comprobación previa o el sandbox bloquearon la ejecución</li>
          <li>No se pudo importar la salida de prueba de Colab</li>
          <li>La referencia del sobre de evidencia no coincide</li>
        </ul>
      </div>

      <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <strong>Nota:</strong> el dataset original <em>no</em> se modificó. Esta ejecución usó una copia de prueba controlada.
        </p>
      </div>

      <div data-testid="colab-notice" style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 0, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python. La ejecución del flujo se delega en un notebook Colab externo.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button data-testid="retry-button" className="run-button" onClick={onRetry}
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 0, border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}>
          Reintentar
        </button>
        <button onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 0, border: '1px solid var(--border-strong)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--ink2)' }}>
          Recargar página
        </button>
      </div>
    </div>
  );
}

export default ImprovementRunPanel;
