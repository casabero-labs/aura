/**
 * Diagnosis Validator v2 — Deterministic Reference Validator.
 *
 * Validates a DiagnosisResponseV2 against its EvidenceEnvelopeV2.
 * All reference checks are deterministic — no LLM calls.
 *
 * Unknown reference → ERROR (not warning).
 * Review downgrade → ERROR.
 * Executable content → ERROR.
 */

import type {
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  DiagnosisIssueV2,
  DiagnosisBlockV2,
  ValidationResultV2,
  ValidationErrorV2,
} from './types';

function err(path: string, message: string, value: unknown): ValidationErrorV2 {
  return { path, message, value };
}

function ok(warnings: ValidationErrorV2[] = []): ValidationResultV2 {
  return { valid: true, errors: [], warnings };
}

function fail(errors: ValidationErrorV2[]): ValidationResultV2 {
  return { valid: false, errors, warnings: [] };
}

// ── Executable Content Detection ──

const EXECUTABLE_PATTERNS = [
  /\bimport\s+(os|sys|subprocess|shutil|pathlib|pandas|numpy)\b/i,
  /\bfrom\s+\S+\s+import\b/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bexecfile\s*\(/i,
  /\b__import__\s*\(/i,
  /\bos\.system\s*\(/i,
  /\bos\.popen\s*\(/i,
  /\bsubprocess\./i,
  /\brm\s+-rf\b/i,
  /\bcurl\s+/i,
  /\bwget\s+/i,
  /\b<script\b/i,
  /\bdocument\.write\b/i,
  /\bfunction\s*\(/i,
  /\.str\.\w+\(/,
  /\.apply\s*\(/,
  /\.transform\s*\(/,
  /\bdropna\s*\(/,
  /\bfillna\s*\(/,
  /pd\.\w+\(/,
  /np\.\w+\(/,
  /\bpandas\./i,
];

function containsExecutable(text: string): boolean {
  return EXECUTABLE_PATTERNS.some(p => p.test(text));
}

// ── Treatment Requirement Mapping ──

function requiresReviewFromEnvelope(
  envelopeIssue: { actionability: string; automaticAuthorization: { authorized: boolean } },
): boolean {
  if (envelopeIssue.actionability === 'review_only') return true;
  if (envelopeIssue.actionability === 'auto_safe' && !envelopeIssue.automaticAuthorization.authorized) return true;
  if (envelopeIssue.actionability === 'not_actionable') return false;
  if (envelopeIssue.actionability === 'auto_safe' && envelopeIssue.automaticAuthorization.authorized) return false;
  // Unknown actionability → requires review
  return true;
}

// ── Main Validator ──

export function validateDiagnosisResponseV2(
  response: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  // 1. Contract identity
  if (response.contractId !== 'aura.diagnosis.v2') {
    errors.push(err('contractId', 'Must be "aura.diagnosis.v2"', response.contractId));
  }
  if (response.contractVersion !== '2.0.0') {
    errors.push(err('contractVersion', 'Must be "2.0.0"', response.contractVersion));
  }

  // 2. Response ID
  if (!response.responseId || typeof response.responseId !== 'string' || response.responseId.trim().length === 0) {
    errors.push(err('responseId', 'Must be non-empty string', response.responseId));
  }

  // 3. Evidence envelope ref (checked by caller — we verify it exists)
  if (!response.evidenceEnvelopeRef || typeof response.evidenceEnvelopeRef !== 'string') {
    errors.push(err('evidenceEnvelopeRef', 'Must be non-empty string', response.evidenceEnvelopeRef));
  }

  // 4. issues array
  if (!Array.isArray(response.issues)) {
    errors.push(err('issues', 'Must be an array', response.issues));
    return fail(errors);
  }

  // 5. diagnosisBlocks array
  if (!Array.isArray(response.diagnosisBlocks)) {
    errors.push(err('diagnosisBlocks', 'Must be an array', response.diagnosisBlocks));
    return fail(errors);
  }

  // 6. limitations
  if (!Array.isArray(response.limitations)) {
    errors.push(err('limitations', 'Must be an array', response.limitations));
  }

  // 7. generatedAt
  if (!response.generatedAt || typeof response.generatedAt !== 'string') {
    errors.push(err('generatedAt', 'Must be a non-empty string', response.generatedAt));
  }

  // Build lookup maps from envelope
  const envelopeIssueIds = new Set(envelope.issues.map(i => i.issueId));
  const envelopeIssueMap = new Map(envelope.issues.map(i => [i.issueId, i]));
  const envelopeRuleIds = new Set(envelope.issues.map(i => i.ruleId));
  const envelopeColumnIds = new Set(envelope.columns.map(c => c.columnId));
  const envelopeEvidenceRefs = new Set<string>();
  for (const iss of envelope.issues) {
    for (const ref of iss.evidenceRefs) {
      envelopeEvidenceRefs.add(ref);
    }
  }

  // Build per-issue evidence ref map from envelope
  const issueEvidenceRefs = new Map<string, Set<string>>();
  for (const iss of envelope.issues) {
    issueEvidenceRefs.set(iss.issueId, new Set(iss.evidenceRefs));
  }

  // 8. Validate each DiagnosisIssueV2
  const seenIssueIds = new Set<string>();
  for (let i = 0; i < response.issues.length; i++) {
    const diagIssue = response.issues[i];
    const base = `issues[${i}]`;

    if (!diagIssue.issueId || typeof diagIssue.issueId !== 'string') {
      errors.push(err(`${base}.issueId`, 'Must be non-empty string', diagIssue.issueId));
      continue;
    }

    // Check existence in envelope
    if (!envelopeIssueIds.has(diagIssue.issueId)) {
      errors.push(err(`${base}.issueId`, 'issueId does not exist in envelope', diagIssue.issueId));
    }

    // Check uniqueness
    if (seenIssueIds.has(diagIssue.issueId)) {
      errors.push(err(`${base}.issueId`, 'Duplicate issueId in response', diagIssue.issueId));
    }
    seenIssueIds.add(diagIssue.issueId);

    // Validate evidenceRefs
    if (!Array.isArray(diagIssue.evidenceRefs)) {
      errors.push(err(`${base}.evidenceRefs`, 'Must be an array', diagIssue.evidenceRefs));
    } else {
      const validRefs = issueEvidenceRefs.get(diagIssue.issueId) ?? new Set<string>();
      for (let j = 0; j < diagIssue.evidenceRefs.length; j++) {
        const ref = diagIssue.evidenceRefs[j];
        if (!envelopeEvidenceRefs.has(ref)) {
          errors.push(err(`${base}.evidenceRefs[${j}]`, 'evidenceRef does not exist in envelope', ref));
        } else if (!validRefs.has(ref)) {
          errors.push(err(`${base}.evidenceRefs[${j}]`, 'evidenceRef belongs to different issue', { ref, issueId: diagIssue.issueId }));
        }
      }
    }

    // Confidence
    if (typeof diagIssue.confidence !== 'number' || diagIssue.confidence < 0 || diagIssue.confidence > 1) {
      errors.push(err(`${base}.confidence`, 'Must be between 0 and 1', diagIssue.confidence));
    }

    // RequiresHumanReview check
    const envelopeIssue = envelopeIssueMap.get(diagIssue.issueId);
    if (envelopeIssue) {
      const required = requiresReviewFromEnvelope(envelopeIssue);
      if (required && !diagIssue.requiresHumanReview) {
        errors.push(err(
          `${base}.requiresHumanReview`,
          'Must be true — envelope requires human review for this issue (actionability or authorization)',
          { required, actual: diagIssue.requiresHumanReview },
        ));
      }
    } else {
      // Unknown issue → must require review
      if (!diagIssue.requiresHumanReview) {
        errors.push(err(`${base}.requiresHumanReview`, 'Must be true — unknown issue', diagIssue.requiresHumanReview));
      }
    }

    // hypothesis
    if (!diagIssue.hypothesis || typeof diagIssue.hypothesis !== 'string') {
      errors.push(err(`${base}.hypothesis`, 'Must be non-empty string', diagIssue.hypothesis));
    } else if (containsExecutable(diagIssue.hypothesis)) {
      errors.push(err(`${base}.hypothesis`, 'Contains executable content', diagIssue.hypothesis.slice(0, 100)));
    }

    // limits
    if (!Array.isArray(diagIssue.limits)) {
      errors.push(err(`${base}.limits`, 'Must be an array', diagIssue.limits));
    }
  }

  // 9. Validate each DiagnosisBlockV2
  const blockIssueIds = new Set<string>();
  for (let i = 0; i < response.diagnosisBlocks.length; i++) {
    const block = response.diagnosisBlocks[i];
    const base = `diagnosisBlocks[${i}]`;

    if (!block.issueId || typeof block.issueId !== 'string') {
      errors.push(err(`${base}.issueId`, 'Must be non-empty string', block.issueId));
      continue;
    }
    blockIssueIds.add(block.issueId);

    // Block references existing issue
    if (!seenIssueIds.has(block.issueId)) {
      warnings.push(err(`${base}.issueId`, 'Block references issueId not in response issues', block.issueId));
    }

    // RuleId exists in envelope
    if (!block.ruleId || typeof block.ruleId !== 'string') {
      errors.push(err(`${base}.ruleId`, 'Must be non-empty string', block.ruleId));
    } else if (!envelopeRuleIds.has(block.ruleId)) {
      errors.push(err(`${base}.ruleId`, 'ruleId does not exist in envelope', block.ruleId));
    }

    // ColumnId validation
    if (block.scope === 'dataset') {
      if (block.columnId !== null) {
        errors.push(err(`${base}.columnId`, 'Must be null for dataset scope', block.columnId));
      }
    } else if (block.scope === 'column') {
      if (block.columnId === null) {
        errors.push(err(`${base}.columnId`, 'Must not be null for column scope', block.columnId));
      } else if (!envelopeColumnIds.has(block.columnId)) {
        errors.push(err(`${base}.columnId`, 'columnId does not exist in envelope', block.columnId));
      }
    } else {
      errors.push(err(`${base}.scope`, 'Must be "dataset" or "column"', block.scope));
    }

    // observation
    if (!block.observation || typeof block.observation !== 'string') {
      errors.push(err(`${base}.observation`, 'Must be non-empty string', block.observation));
    } else if (containsExecutable(block.observation)) {
      errors.push(err(`${base}.observation`, 'Contains executable content', block.observation.slice(0, 100)));
    }

    // recommendation
    if (!block.recommendation || typeof block.recommendation !== 'string') {
      errors.push(err(`${base}.recommendation`, 'Must be non-empty string', block.recommendation));
    } else if (containsExecutable(block.recommendation)) {
      errors.push(err(`${base}.recommendation`, 'Contains executable content', block.recommendation.slice(0, 100)));
    }
  }

  // 10. Check for orphaned blocks (blocks referencing issues not in response.issues)
  for (let i = 0; i < response.diagnosisBlocks.length; i++) {
    const block = response.diagnosisBlocks[i];
    if (block.issueId && !seenIssueIds.has(block.issueId)) {
      errors.push(err(`diagnosisBlocks[${i}].issueId`, 'Orphaned block — issueId not in response.issues', block.issueId));
    }
  }

  // 11. Check for executable content in limitations array
  for (let i = 0; i < (response.limitations || []).length; i++) {
    const lim = response.limitations[i];
    if (typeof lim === 'string' && containsExecutable(lim)) {
      errors.push(err(`limitations[${i}]`, 'Contains executable content', lim.slice(0, 100)));
    }
  }

  return errors.length > 0 ? fail(errors) : ok(warnings);
}
