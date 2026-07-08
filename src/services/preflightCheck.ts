// ── Phase 5 Loop 1: Preflight Verifier ──
// Validates that a ScriptContractV2 is safe to execute before Phase 5 sandbox runtime.
// Does NOT execute Python. Does NOT modify contracts v2.

import type { ScriptContractV2, RemediationPlanV2, ScriptBuildContextV2 } from '../contracts/llm/types';
import { verifyScriptContractV2, computeScriptHashV2 } from '../contracts/llm';
import type { ScriptContractCandidateV2 } from '../contracts/llm/types';

const NON_EXECUTABLE_APPROVED_EXCLUSION_REASONS = new Set([
  'unsupported_action',
  'missing_column',
  'ambiguous_column',
]);

export interface PreflightResult {
  status: 'ready' | 'blocked';
  verification: {
    valid: boolean;
    errors: string[];
  };
  hashMatch: boolean;
  fingerprintMatch: boolean;
  acceptedActionsCoherent: boolean;
  executableActionsPresent: boolean;
  reasons: string[];
}

export function preflightCheck(
  contract: ScriptContractV2,
  remediationPlan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  currentDatasetFingerprint: string,
): PreflightResult {
  if (!contract) {
    return {
      status: 'blocked',
      verification: { valid: false, errors: ['CONTRACT_NULL: contract is null or undefined'] },
      hashMatch: false,
      fingerprintMatch: false,
      acceptedActionsCoherent: false,
      executableActionsPresent: false,
      reasons: ['contract is null or undefined'],
    };
  }

  const reasons: string[] = [];

  const verification = verifyScriptContractV2(contract, remediationPlan, buildContext);
  if (!verification.valid) {
    reasons.push(
      `verifyScriptContractV2 failed: ${verification.errors.map(e => `${e.code}: ${e.message}`).join('; ')}`,
    );
  }

  let hashMatch = false;
  try {
    const recomputed = computeScriptHashV2(contract as unknown as ScriptContractCandidateV2);
    hashMatch = contract.scriptHash === recomputed;
    if (!hashMatch) {
      const stored = contract.scriptHash ? contract.scriptHash.slice(0, 16) : '(missing)';
      reasons.push(`scriptHash mismatch: stored ${stored}… ≠ recomputed ${recomputed.slice(0, 16)}…`);
    }
  } catch (e) {
    reasons.push(`hash computation error: ${e instanceof Error ? e.message : String(e)}`);
  }

  const contractFp = contract.datasetFingerprint || '';
  const fingerprintMatch = contractFp === currentDatasetFingerprint;
  if (!fingerprintMatch) {
    reasons.push(
      `datasetFingerprint mismatch: contract references ${contractFp.slice(0, 16)}… ≠ current ${currentDatasetFingerprint.slice(0, 16)}…`,
    );
  }

  const acceptedActionsCoherent = validateAcceptedActionsCoherence(contract, remediationPlan, reasons);
  const executableActionsPresent = Array.isArray(contract.acceptedActionIds) && contract.acceptedActionIds.length > 0;
  if (!executableActionsPresent) {
    reasons.push('no executable actions accepted in script contract');
  }

  const blocked =
    !verification.valid ||
    !hashMatch ||
    !fingerprintMatch ||
    !acceptedActionsCoherent ||
    !executableActionsPresent;

  return {
    status: blocked ? 'blocked' : 'ready',
    verification: {
      valid: verification.valid,
      errors: verification.errors.map(e => `${e.code}: ${e.message}`),
    },
    hashMatch,
    fingerprintMatch,
    acceptedActionsCoherent,
    executableActionsPresent,
    reasons,
  };
}

function validateAcceptedActionsCoherence(
  contract: ScriptContractV2,
  plan: RemediationPlanV2,
  reasons: string[],
): boolean {
  const approvedIds = new Set(
    plan.plan.filter(a => a.approvalStatus === 'approved').map(a => a.actionId),
  );
  const rejectedOrPendingIds = new Set(
    plan.plan.filter(a => a.approvalStatus !== 'approved').map(a => a.actionId),
  );

  const contractSet = new Set(contract.acceptedActionIds);
  const excludedReasonsById = new Map(
    (Array.isArray(contract.excludedActionIds) ? contract.excludedActionIds : []).map(ex => [
      ex.actionId,
      ex.reason,
    ]),
  );
  const violations: string[] = [];

  for (const id of contractSet) {
    if (!approvedIds.has(id)) {
      if (rejectedOrPendingIds.has(id)) {
        const action = plan.plan.find(a => a.actionId === id);
        violations.push(`action ${id} is ${action?.approvalStatus ?? 'unknown'}, not approved`);
      } else {
        violations.push(`action ${id} not found in remediation plan`);
      }
    }
  }

  for (const id of approvedIds) {
    if (!contractSet.has(id)) {
      const exclusionReason = excludedReasonsById.get(id);
      if (exclusionReason && NON_EXECUTABLE_APPROVED_EXCLUSION_REASONS.has(exclusionReason)) {
        continue;
      }
      violations.push(`approved action ${id} missing from contract acceptedActionIds`);
    }
  }

  if (violations.length > 0) {
    reasons.push(`HITL coherence violations: ${violations.join('; ')}`);
    return false;
  }

  return true;
}
