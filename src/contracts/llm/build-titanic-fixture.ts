import { readFileSync } from 'node:fs';
process.env.CONTRACTS_V2_ENABLED = 'true';

import { _buildEvidenceEnvelopeV2 } from './evidenceEnvelopeV2.js';
import { buildRemediationContext, buildDiagnosisRef } from './remediationContextV2.js';
import { buildRemediationPlanV2 } from './remediationBuilderV2.js';
import { buildEnvelopeRef } from './diagnosisPromptV2.js';
import { sha256hex } from './hash.js';
import type { DiagnosisResponseV2, DiagnosisBlockV2 } from './types.js';

const RULE_NAME_TO_ID: Record<string, string> = {
  'Espacios Fantasma (Trim)': 'rule:trim-whitespace',
  'Cola Larga Categórica': 'rule:long-tail-categorical',
  'Valores Nulos / Vacíos': 'rule:null-values',
  'Outliers Leves (Tukey 1.5×)': 'rule:mild-outliers',
  'Outliers Extremos (IQR 3×)': 'rule:extreme-outliers',
};

const AUTO_AUTH_YES = (reason: string) => ({ actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column', 'leading-or-trailing-whitespace-confirmed'], reason });
const AUTO_AUTH_NO = (actionType: string, reason: string) => ({ actionType, authorized: false, conditionsMet: [], reason });

const raw = JSON.parse(readFileSync('/Users/casabero/Documents/GitHub/aura/experiments/contracts-v2/fixtures/titanic-audit-report.json', 'utf8'));

const report = {
  ...raw,
  issues: raw.issues.map((issue: any) => {
    const ruleId = RULE_NAME_TO_ID[issue.ruleName];
    if (!ruleId) return issue;
    if (ruleId === 'rule:trim-whitespace') {
      return { ...issue, ruleId, automaticAuthorization: AUTO_AUTH_YES('Deterministic lossless normalization') };
    }
    if (ruleId === 'rule:null-values' || ruleId === 'rule:mild-outliers' || ruleId === 'rule:extreme-outliers') {
      return { ...issue, ruleId, automaticAuthorization: AUTO_AUTH_NO('null_values', 'No automatic authorization for null/outlier rules') };
    }
    return { ...issue, ruleId };
  }),
};

const options = {
  privacyLevel: 'local_full' as const,
  tokenBudget: undefined,
  excludeColumns: [] as string[],
  excludeIssues: [] as string[],
  datasetSha256: '4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7',
  delimiter: ',',
};

const envelope = _buildEvidenceEnvelopeV2(report, options);
const envelopeRef = buildEnvelopeRef(envelope);

console.log('ENVELOPE_REF=' + envelopeRef);

console.log('\nISSUES:');
for (const iss of envelope.issues) {
  console.log(`${iss.issueId} | ${iss.ruleId} | evRefs=${JSON.stringify(iss.evidenceRefs)} | actionability=${iss.actionability} | auth=${JSON.stringify(iss.automaticAuthorization)}`);
}

console.log('\nCOLUMNS:');
for (const col of envelope.columns) {
  console.log(`${col.name} -> ${col.columnId} | dupOrd=${col.duplicateOrdinal} | ambiguous=${col.isAmbiguous} | duplicate=${col.isDuplicate}`);
}

// Now build DiagnosisResponseV2
const issues = envelope.issues.map(iss => ({
  issueId: iss.issueId,
  evidenceRefs: [...iss.evidenceRefs],
  hypothesis: `${iss.ruleName}: ${iss.description.substring(0, 80)}`,
  confidence: 0.85,
  requiresHumanReview: iss.actionability !== 'auto_safe',
  limits: [] as string[],
}));

const blocks: DiagnosisBlockV2[] = envelope.issues.map(iss => ({
  issueId: iss.issueId,
  ruleId: iss.ruleId,
  columnId: iss.columnId,
  scope: iss.scope,
  observation: `${iss.count} values affected (${iss.affectedPercentage.toFixed(1)}%)`,
  recommendation: 'Revisar y validar manualmente.',
}));

const diagnosis: DiagnosisResponseV2 = {
  contractId: 'aura.diagnosis.v2',
  contractVersion: '2.0.0',
  evidenceEnvelopeRef: envelopeRef,
  responseId: 'diag-titanic-phase3-harness',
  issues,
  diagnosisBlocks: blocks,
  limitations: [],
  generatedAt: new Date().toISOString(),
};

const diagnosisRef = buildDiagnosisRef(diagnosis);
console.log('\nDIAGNOSIS_REF=' + diagnosisRef);

// Build DiagnosisExecutionResult
const ctx = buildRemediationContext(envelope);
ctx.evidenceEnvelopeRef = envelopeRef;

const diagExecution = {
  version: 2 as const,
  diagnosis,
  metrics: {
    latencyMs: 150,
    tokensGenerated: 512,
    model: 'qwen2.5:3b',
    provider: 'ollama',
    isLocal: true,
  },
  promptHash: sha256hex('prompt'),
  evidenceEnvelopeRef: envelopeRef,
  promptVersion: '2.0.0',
  rawResponseHash: sha256hex(JSON.stringify(diagnosis)),
  remediationContext: ctx,
};

console.log('\nDIAGNOSIS_EXecution OK');

try {
  const plan = buildRemediationPlanV2(diagExecution);
  console.log('\nPLAN_ID=' + plan.planId);
  console.log('\nPLAN_JSON=' + JSON.stringify(plan));
  console.log('\nDIAG_EXECUTION_JSON=' + JSON.stringify(diagExecution));
  console.log('\nACTIONS:');
  for (const a of plan.plan) {
    console.log(`  ${a.actionId} | ${a.issueId} | ${a.actionType} | ${a.actionability} | evRefs=${JSON.stringify(a.evidenceRefs)}`);
  }
  console.log('\nEXCLUSIONS:');
  for (const e of plan.exclusions) {
    console.log(`  ${e.issueId} | ${e.reason}`);
  }
  console.log('\nACTIONABILITY_MAP:');
  console.log(JSON.stringify(plan.actionabilityMap, null, 2));
} catch (e) {
  console.error('PLAN ERROR:', e);
}
