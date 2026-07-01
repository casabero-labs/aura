#!/usr/bin/env npx tsx
// ── Phase 5 Loop 6: CLI Wrapper ──
// Invoke: npx tsx src/cli/runImprovement.ts
//
// Takes fixture CSV files or inline strings and runs the full
// Phase 5 improvement flow: execute → reaudit → HealthDelta → ImprovementRunV1.
// Exports the result as JSON to stdout.
//
// Does NOT execute Python remotely. Does NOT send data to Colab.
// This is a local wrapper for demonstration and testing.

import { buildScriptCandidateV2, finalizeScriptContractV2 } from '../contracts/llm/scriptBuilderV2';
import { validateScriptCandidateV2 } from '../contracts/llm/scriptValidatorV2';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import {
  runImprovementFlow,
  exportImprovementRunJSON,
} from '../services/improvementRunService';
import type {
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptContractV2,
} from '../contracts/llm/types';

// ── Default demo fixture ──

const DEMO_BEFORE_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","SAN FRANCISCO","2024-01-01",160903280
"456 Oak Ave","LOS ANGELES","2024-01-02",160903281
"789 Pine Rd","CHICAGO","2024-01-03",160903282
`;

const DEMO_AFTER_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","san francisco","2024-01-01",160903280
"456 Oak Ave","los angeles","2024-01-02",160903281
"789 Pine Rd","chicago","2024-01-03",160903282
`;

// ── Simple argument parsing ──

function parseArgs(): { beforeCsv: string; afterCsv: string; datasetName: string } {
  const beforeCsv = process.argv[2] || DEMO_BEFORE_CSV;
  const afterCsv = process.argv[3] || DEMO_AFTER_CSV;
  const datasetName = process.argv[4] || 'demo_fixture.csv';
  return { beforeCsv, afterCsv, datasetName };
}

// ── Build a demo contract ──

function buildDemoContract(): {
  contract: ScriptContractV2;
  plan: RemediationPlanV2;
  ctx: ScriptBuildContextV2;
} {
  const column = 'City';
  const colRefs = buildColumnRegistry([column]);
  const colId = colRefs[0].columnId;

  const action: RemediationActionV2 = {
    actionId: 'act:demo_normalize_city',
    issueId: 'issue:demo',
    ruleId: 'rule:city_casing',
    columnId: colId,
    actionType: 'normalize_casing' as RemediationActionV2['actionType'],
    parameters: { strategy: 'lowercase' } as unknown as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus: 'approved',
  };

  const plan: RemediationPlanV2 = {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId: 'plan:demo_cli',
    diagnosisRef: 'diag:demo',
    evidenceEnvelopeRef: 'env:demo_cli_ref',
    datasetFingerprint: 'sha256:demo_fingerprint',
    plan: [action],
    actionabilityMap: {},
    exclusions: [],
    generatedAt: new Date().toISOString(),
  };

  const ctx: ScriptBuildContextV2 = buildScriptContext(
    {
      evidenceEnvelopeRef: plan.evidenceEnvelopeRef,
      datasetFingerprint: plan.datasetFingerprint,
      columns: colRefs.map(c => ({
        columnId: c.columnId,
        name: c.name,
        position: c.position,
        duplicateOrdinal: c.duplicateOrdinal,
        isAmbiguous: c.isAmbiguous,
        isDuplicate: c.isDuplicate,
      })),
      issues: [],
    },
    colRefs,
    plan.datasetFingerprint,
  );

  const candidate = buildScriptCandidateV2(plan, ctx, {
    generatedAt: new Date().toISOString(),
  });
  const validation = validateScriptCandidateV2(candidate, plan, ctx);
  const contract = finalizeScriptContractV2(candidate, validation);

  return { contract, plan, ctx };
}

// ── Main ──

function main() {
  const { beforeCsv, afterCsv, datasetName } = parseArgs();
  const { contract, plan, ctx } = buildDemoContract();

  console.error(`# AURA Phase 5 — Improvement Run Flow`);
  console.error(`# Dataset: ${datasetName}`);
  console.error(`# Before: ${beforeCsv.length} chars, After: ${afterCsv.length} chars`);
  console.error();

  try {
    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:demo_cli_ref',
      beforeCsv,
      afterCsv,
      datasetName,
    });

    const json = exportImprovementRunJSON(result.improvementRun);

    console.error(`# Status: ${result.healthDelta.status}`);
    console.error(`# Score: ${result.healthDelta.scoreBefore} → ${result.healthDelta.scoreAfter} (delta: ${result.healthDelta.delta})`);
    console.error(`# Issues: ${result.reauditResult.summary.beforeIssueCount} → ${result.reauditResult.summary.afterIssueCount}`);
    console.error(`# RunId: ${result.improvementRun.runId}`);
    console.error();

    process.stdout.write(json + '\n');
  } catch (err) {
    console.error(`# ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
