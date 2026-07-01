// ── Phase 6 Loop 4: ImprovementRunPanel — Visual States ──
// Enhanced idle / running / done / error states.
// Uses controlled fixtures only. Delegates Python execution to Colab.

import React, { useState, useEffect } from 'react';
import HealthDeltaDashboard from './HealthDeltaDashboard';
import ImprovementRunExportCard from './ImprovementRunExportCard';
import ExecutionLogsPanel from './ExecutionLogsPanel';

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

  // ── Phase 7 L2B: Visual testability harness (opt-in, non-production) ──
  // Activated only via ?phase7Visual=running or ?phase7Visual=error query param.
  // Does NOT execute Python, does NOT use real datasets.
  // For E2E visual evidence capture only.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const visualMode = params.get('phase7Visual');
    if (!visualMode) return;

    if (visualMode === 'running') {
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
            execution: { status: 'success', runtime: 'colab_notebook', logs: [] },
            outputDataset: { rowCountBefore: 3, rowCountAfter: 3, columnCountBefore: 4, columnCountAfter: 4, changedCellsEstimate: 3 },
            reaudit: {
              beforeIssueCount: 3,
              afterIssueCount: 0,
              beforeReport: { score: 75, issues: [], rowCount: 3, colCount: 4, delimiterDetected: ',', duplicateRows: 0, fingerprint: '' },
              afterReport: { score: 100, issues: [], rowCount: 3, colCount: 4, delimiterDetected: ',', duplicateRows: 0, fingerprint: '' },
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

    if (visualMode === 'error') {
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
    <section data-testid="improvement-run-panel" className="improvement-run-panel">
      <div className="panel-header">
        <h2>Phase 6 — Improvement Run</h2>
        <p className="panel-subtitle">Full pipeline over controlled fixture data.</p>
      </div>

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
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
          This run executes the full improvement pipeline over a <strong>controlled fixture copy</strong> of the dataset. No original data is modified.
        </p>
      </div>

      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
        <table style={{ margin: 0, borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ color: '#6b7280', padding: '2px 0', width: '40%' }}>Fixture dataset</td>
              <td style={{ fontWeight: 500, color: '#111827', padding: '2px 0' }}>{datasetName}</td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', padding: '2px 0' }}>Before fixture</td>
              <td style={{ color: '#374151', padding: '2px 0', fontFamily: 'monospace', fontSize: 12 }}>{beforeCsvSize} bytes</td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', padding: '2px 0' }}>After fixture</td>
              <td style={{ color: '#374151', padding: '2px 0', fontFamily: 'monospace', fontSize: 12 }}>{afterCsvSize} bytes</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button data-testid="run-button" className="run-button" onClick={onRun}
        style={{ padding: '10px 20px', fontSize: 14, borderRadius: 6, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
        Run Improvement Flow
      </button>

      <div data-testid="colab-notice" style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
          <strong>NOTE:</strong> AURA does <em>not</em> execute Python inside the browser. The pipeline delegates Python execution to an external Colab notebook. No real datasets are accessed.
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
          width: 20, height: 20, border: '2px solid #e5e7eb', borderTop: '2px solid #111827',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Running improvement flow…</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400 }}>
        {RUNTIME_STEPS.map((step, i) => (
          <div key={i} data-testid={`step-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', maxWidth: 480 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
          <strong>NOTE:</strong> AURA is <em>not</em> executing Python directly. The Colab notebook runs externally with the controlled fixture copy.
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
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14, color: '#166534' }}>✓ Run complete — </span>
        <span data-testid="run-id" style={{ fontSize: 13, fontFamily: 'monospace', color: '#166534' }}>{result.improvementRun.runId}</span>
      </div>

      <div data-testid="fixture-notice" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
          <strong>NOTE:</strong> This run used a <strong>controlled fixture copy</strong> of the dataset. No original data was modified.
        </p>
      </div>

      <div data-testid="colab-notice" style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
          <strong>NOTE:</strong> AURA does <em>not</em> execute Python. The pipeline executed externally via a Colab notebook with the controlled fixture copy.
        </p>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Health Delta</span>
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

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Execution Logs</span>
        </div>
        <div style={{ padding: 16 }}>
          <ExecutionLogsPanel
            logs={result.logs}
            execution={result.improvementRun.execution}
          />
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Export</span>
        </div>
        <div style={{ padding: 16 }}>
          <ImprovementRunExportCard improvementRun={result.improvementRun} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button data-testid="run-again-button" className="run-button" onClick={onRunAgain}
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>
          Run Again
        </button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div data-testid="error-state" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16, color: '#dc2626' }}>✗</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>Run failed</span>
        </div>
        <p data-testid="error-message" style={{ margin: 0, fontSize: 13, color: '#991b1b', fontFamily: 'monospace', lineHeight: 1.6, wordBreak: 'break-all' }}>
          {message ?? 'Unknown error occurred.'}
        </p>
      </div>

      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Possible causes</p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
          <li>Contract validation failed — script or plan mismatch</li>
          <li>Preflight or sandbox gate blocked the execution</li>
          <li>Colab output fixture could not be imported</li>
          <li>Evidence envelope reference mismatch</li>
        </ul>
      </div>

      <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
          <strong>NOTE:</strong> The original dataset was <em>not</em> modified. This run used a controlled fixture copy.
        </p>
      </div>

      <div data-testid="colab-notice" style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
          <strong>NOTE:</strong> AURA does <em>not</em> execute Python. Pipeline execution is delegated to an external Colab notebook.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button data-testid="retry-button" className="run-button" onClick={onRetry}
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}>
          Retry
        </button>
        <button onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>
          Reload page
        </button>
      </div>
    </div>
  );
}

export default ImprovementRunPanel;
