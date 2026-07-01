// ── Phase 6 Loop 1: ImprovementRunPanel ──
// Wraps runImprovementFlow in a minimal React UI.
// All contract module imports are dynamic (lazy) to avoid
// blocking the main thread and vitest worker startup.
// Uses controlled fixtures only. Delegates Python execution to Colab.

import React, { useState } from 'react';
import HealthDeltaDashboard from './HealthDeltaDashboard';

type PanelState = 'idle' | 'running' | 'done' | 'error';

interface RunResult {
  runId: string;
  healthDelta: { status: string; scoreBefore: number | null; scoreAfter: number | null; delta: number | null; issueDelta: number; summary: string; caveats: string[] };
  reaudit: { beforeIssueCount: number; afterIssueCount: number };
  output: { rowCountBefore: number; rowCountAfter: number; columnCountBefore: number; columnCountAfter: number };
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

const ImprovementRunPanel: React.FC<Props> = ({
  beforeCsv = BEFORE,
  afterCsv = AFTER,
  datasetName = 'demo_fixture.csv',
  evidenceRef = 'env:panel_demo_ref',
}) => {
  const [state, setState] = useState<PanelState>('idle');
  const [result, setResult] = useState<RunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        runId: flow.improvementRun.runId,
        healthDelta: flow.healthDelta,
        reaudit: flow.reauditResult.summary,
        output: flow.reauditResult.output,
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
        <h2>Phase 5 — Improvement Run</h2>
        <p className="panel-subtitle">Runs the full improvement pipeline with controlled fixtures.</p>
      </div>

      <div data-testid="colab-notice" className="colab-notice">
        <strong>NOTE:</strong> AURA does <em>not</em> execute Python inside the browser.
        The flow uses a Colab notebook externally with controlled fixture data.
        No real datasets are used.
      </div>

      {state === 'idle' && (
        <div data-testid="idle-state" className="idle-state">
          <p>Fixture: <em>{datasetName}</em> ({beforeCsv.length} chars before, {afterCsv.length} chars after)</p>
          <button data-testid="run-button" className="run-button" onClick={handleRun}>Run Improvement Flow</button>
        </div>
      )}

      {state === 'running' && (
        <div data-testid="running-state" className="running-state">
          <p>Running improvement flow... This may take a moment.</p>
          <div className="spinner" />
        </div>
      )}

      {state === 'done' && result && (
        <div data-testid="done-state" className="done-state">
          <div data-testid="result-card" className="result-card">
            <h3>Run Complete</h3>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Run ID: </span>
              <span data-testid="run-id" style={{ fontSize: 13, fontWeight: 600 }}>{result.runId}</span>
            </div>

            <HealthDeltaDashboard
              status={result.healthDelta.status as any}
              scoreBefore={result.healthDelta.scoreBefore}
              scoreAfter={result.healthDelta.scoreAfter}
              delta={result.healthDelta.delta}
              issueDelta={result.healthDelta.issueDelta}
              beforeIssueCount={result.reaudit.beforeIssueCount}
              afterIssueCount={result.reaudit.afterIssueCount}
              summary={result.healthDelta.summary}
              caveats={result.healthDelta.caveats}
              outputRowCountBefore={result.output.rowCountBefore}
              outputRowCountAfter={result.output.rowCountAfter}
              outputColumnCountBefore={result.output.columnCountBefore}
              outputColumnCountAfter={result.output.columnCountAfter}
              changedCellsEstimate={'changedCellsEstimate' in result.output ? (result.output as any).changedCellsEstimate : null}
            />
          </div>
          <button data-testid="run-again-button" className="run-button" onClick={() => { setState('idle'); setResult(null); setErrorMessage(null); }}>Run Again</button>
        </div>
      )}

      {state === 'error' && (
        <div data-testid="error-state" className="error-state">
          <h3>Error</h3>
          <p data-testid="error-message">{errorMessage}</p>
          <button data-testid="retry-button" className="run-button" onClick={handleRun}>Retry</button>
        </div>
      )}
    </section>
  );
};

export default ImprovementRunPanel;
