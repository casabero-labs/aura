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
  'Preparing controlled fixture',
  'Validating contract',
  'Generating Colab notebook context',
  'Importing Colab output fixture',
  'Running AURA reaudit',
  'Computing HealthDelta',
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
      setErrorMessage('Visual harness: forced error state for E2E capture.');
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
    <section data-testid="improvement-run-panel" className="improvement-run-panel editorial-workbench" aria-labelledby="improvement-run-title">
      <div className="panel-header">
        <p className="workbench-kicker">08 · Revisión de mejora</p>
        <h2 id="improvement-run-title">Ejecución de mejora <span className="sr-only">Phase 6 — Improvement Run</span></h2>
        <p className="panel-subtitle">Flujo completo sobre datos de fixture controlados.</p>
      </div>

      {/* ── Phase 8 L1: Demo/Prod Boundary — explicit demo banner ── */}
      {/* Only shown when an explicit demo/evidence flag is present.
          In normal/product mode (no flag), this banner must NOT render. */}
      {detectDemoMode().active && (
        <div
          data-testid="demo-mode-banner"
          className="improvement-demo-banner"
        >
          <p>
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
    <div data-testid="idle-state" className="improvement-state improvement-state--idle">
      <div className="improvement-callout improvement-callout--success">
        <p>
          Esta ejecución recorre el flujo completo sobre una <strong>copia de fixture controlada</strong> del dataset. El original no se modifica.
        </p>
      </div>

      <div className="improvement-fixture-summary">
        <table className="improvement-fixture-table">
          <caption>Dataset de fixture controlado</caption>
          <tbody>
            <tr>
              <th scope="row">Dataset</th>
              <td>{datasetName}</td>
            </tr>
            <tr>
              <th scope="row">Fixture antes</th>
              <td className="mono">{beforeCsvSize} bytes</td>
            </tr>
            <tr>
              <th scope="row">Fixture después</th>
              <td className="mono">{afterCsvSize} bytes</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button data-testid="run-button" className="run-button btn-p" onClick={onRun}>
        Ejecutar flujo de mejora <span className="sr-only">Run Improvement Flow</span>
      </button>

      <div data-testid="colab-notice" className="improvement-callout improvement-callout--warning">
        <p>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python en el navegador. El flujo delega la ejecución en un notebook externo de Colab y no accede a datasets reales.
        </p>
      </div>
    </div>
  );
}

function RunningState() {
  return (
    <div data-testid="running-state" className="improvement-state improvement-state--running" role="status" aria-live="polite">
      <div className="improvement-running-heading">
        <div className="improvement-spinner" aria-hidden="true" />
        <span>Ejecutando flujo de mejora…</span>
      </div>

      <div className="improvement-runtime-steps">
        {RUNTIME_STEPS.map((step, i) => (
          <div key={i} data-testid={`step-${i}`} className="improvement-runtime-step">
            <span className="improvement-runtime-marker" aria-hidden="true">{i + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div className="improvement-callout improvement-callout--warning">
        <p>
          <strong>Nota:</strong> AURA <em>no</em> está ejecutando Python directamente. El notebook de Colab corre externamente con la copia de fixture controlada.
        </p>
      </div>
    </div>
  );
}

function DoneState({ result, onRunAgain }: { result: RunResult; onRunAgain: () => void }) {
  return (
    <div data-testid="done-state" className="improvement-state improvement-state--done">
      <div className="improvement-callout improvement-callout--success" role="status">
        <span>Resultado disponible — </span>
        <span data-testid="run-id" className="mono">{result.improvementRun.runId}</span>
        <span className="sr-only">Run complete</span>
      </div>

      <div data-testid="fixture-notice" className="improvement-callout improvement-callout--success">
        <p>
          <strong>Nota:</strong> esta ejecución usó una <strong>copia de fixture controlada</strong> del dataset. El original no fue modificado.
        </p>
      </div>

      <div data-testid="colab-notice" className="improvement-callout improvement-callout--warning">
        <p>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python. El flujo se ejecutó externamente mediante un notebook de Colab con la copia de fixture controlada.
        </p>
      </div>

      <section className="improvement-result-section" aria-labelledby="improvement-health-title">
        <header>
          <h3 id="improvement-health-title">Comparación de calidad <span className="sr-only">Health Delta</span></h3>
        </header>
        <div className="improvement-result-body">
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
      </section>

      <section className="improvement-result-section" aria-labelledby="improvement-logs-title">
        <header>
          <h3 id="improvement-logs-title">Registro de ejecución <span className="sr-only">Execution Logs</span></h3>
        </header>
        <div className="improvement-result-body">
          <ExecutionLogsPanel
            logs={result.logs}
            execution={result.improvementRun.execution}
          />
        </div>
      </section>

      <section className="improvement-result-section" aria-labelledby="improvement-export-title">
        <header>
          <h3 id="improvement-export-title">Exportación</h3>
        </header>
        <div className="improvement-result-body">
          <ImprovementRunExportCard improvementRun={result.improvementRun} />
        </div>
      </section>

      <div className="improvement-result-actions">
        <button data-testid="run-again-button" className="run-button btn-s btn-sm" onClick={onRunAgain}>
          Ejecutar de nuevo <span className="sr-only">Run Again</span>
        </button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div data-testid="error-state" className="improvement-state improvement-state--error" role="alert">
      <div className="improvement-callout improvement-callout--error">
        <div className="improvement-error-heading">
          <span aria-hidden="true">×</span>
          <span>La ejecución falló <span className="sr-only">Run failed</span></span>
        </div>
        <p data-testid="error-message" className="improvement-error-message">
          {message ?? 'Unknown error occurred.'}
        </p>
      </div>

      <div className="improvement-callout improvement-callout--neutral">
        <p className="improvement-cause-title">Causas posibles <span className="sr-only">Possible causes</span></p>
        <ul className="improvement-cause-list">
          <li>Falló la validación del contrato: el script o el plan no coinciden.</li>
          <li>El preflight o la puerta de sandbox bloqueó la ejecución.</li>
          <li>No se pudo importar la salida de Colab.</li>
          <li>No coincide la referencia del sobre de evidencia.</li>
        </ul>
      </div>

      <div className="improvement-callout improvement-callout--warning">
        <p>
          <strong>Nota:</strong> el dataset original <em>no</em> fue modificado. Esta ejecución usó una copia de fixture controlada.
        </p>
      </div>

      <div data-testid="colab-notice" className="improvement-callout improvement-callout--warning">
        <p>
          <strong>Nota:</strong> AURA <em>no</em> ejecuta Python. La ejecución se delega en un notebook externo de Colab.
        </p>
      </div>

      <div className="improvement-error-actions">
        <button data-testid="retry-button" className="run-button btn-p btn-sm" onClick={onRetry}>
          Reintentar <span className="sr-only">Retry</span>
        </button>
        <button onClick={() => window.location.reload()} className="btn-s btn-sm">
          Recargar página <span className="sr-only">Reload page</span>
        </button>
      </div>
    </div>
  );
}

export default ImprovementRunPanel;
