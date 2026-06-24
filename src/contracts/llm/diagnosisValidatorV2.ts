/**
 * Diagnosis Validator v2 — Deterministic Reference Validator.
 *
 * Validates a DiagnosisResponseV2 against its EvidenceEnvelopeV2.
 * All reference checks are deterministic — no LLM calls.
 *
 * Enforcement:
 * - Envelope ref exact match (DIAGNOSIS_ENVELOPE_MISMATCH)
 * - Schema validation with additionalProperties: false
 * - Block coherence: block matches its envelope issue's ruleId/columnId/scope
 * - Exact coverage: one issue + one block per envelope issue
 * - HITL rules enforced
 * - No executable content
 * - Unknown reference → ERROR (not warning)
 */

import type {
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  ValidationResultV2,
  ValidationErrorV2,
} from './types';
import { buildEnvelopeRef } from './diagnosisPromptV2';

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
  /\bsqlite3\./i,
  /\bpsutil\./i,
  /\bos\.path\./i,
  /\bpathlib\./i,
];

function containsExecutable(text: string): boolean {
  return EXECUTABLE_PATTERNS.some(p => p.test(text));
}

// ── HITL Requirement Mapping ──

function requiresReviewFromEnvelope(
  envelopeIssue: {
    actionability: string;
    automaticAuthorization: { authorized: boolean };
    columnId: string | null;
  },
  columnRegistry: Map<string, { isAmbiguous: boolean; isDuplicate: boolean }>,
): boolean {
  if (envelopeIssue.actionability === 'review_only') return true;
  if (envelopeIssue.actionability === 'auto_safe' && !envelopeIssue.automaticAuthorization.authorized) return true;
  if (envelopeIssue.actionability === 'not_actionable') return false;
  if (envelopeIssue.actionability === 'auto_safe' && envelopeIssue.automaticAuthorization.authorized) return false;
  // Unknown actionability → requires review
  if (envelopeIssue.columnId) {
    const col = columnRegistry.get(envelopeIssue.columnId);
    if (col?.isAmbiguous || col?.isDuplicate) return true;
  }
  return true;
}

// ── Schema Validation (additionalProperties: false) ──

function validateValueAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  errors: ValidationErrorV2[],
): void {
  const schemaType = schema.type as string;
  const schemaEnum = schema.enum as string[] | undefined;
  const schemaMin = schema.minimum as number | undefined;
  const schemaMax = schema.maximum as number | undefined;
  const schemaMinLen = schema.minLength as number | undefined;
  const schemaMaxLen = schema.maxLength as number | undefined;
  const schemaMaxItems = schema.maxItems as number | undefined;

  // Type check
  let actualType = typeof value;
  if (value === null) actualType = 'null';
  else if (Array.isArray(value)) actualType = 'array';
  else if (actualType === 'object') actualType = 'object';

  if (schemaType === 'string') {
    if (actualType !== 'string') {
      errors.push(err(path, `Expected string, got ${actualType}`, value));
      return;
    }
  } else if (schemaType === 'number') {
    if (actualType !== 'number') {
      errors.push(err(path, `Expected number, got ${actualType}`, value));
      return;
    }
  } else if (schemaType === 'boolean') {
    if (actualType !== 'boolean') {
      errors.push(err(path, `Expected boolean, got ${actualType}`, value));
      return;
    }
  } else if (schemaType === 'array') {
    if (actualType !== 'array') {
      errors.push(err(path, `Expected array, got ${actualType}`, value));
      return;
    }
  } else if (schemaType === 'object') {
    if (actualType !== 'object' || value === null) {
      errors.push(err(path, `Expected object, got ${actualType}`, value));
      return;
    }
  }

  // Enum check
  if (schemaEnum && typeof value === 'string') {
    if (!schemaEnum.includes(value)) {
      errors.push(err(path, `Value "${value}" not in enum [${schemaEnum.join(', ')}]`, value));
    }
  }

  // Number range
  if (typeof value === 'number') {
    if (schemaMin !== undefined && value < schemaMin) {
      errors.push(err(path, `Value ${value} below minimum ${schemaMin}`, value));
    }
    if (schemaMax !== undefined && value > schemaMax) {
      errors.push(err(path, `Value ${value} above maximum ${schemaMax}`, value));
    }
  }

  // String length
  if (typeof value === 'string') {
    if (schemaMinLen !== undefined && value.length < schemaMinLen) {
      errors.push(err(path, `String length ${value.length} below minLength ${schemaMinLen}`, value));
    }
    if (schemaMaxLen !== undefined && value.length > schemaMaxLen) {
      errors.push(err(path, `String length ${value.length} exceeds maxLength ${schemaMaxLen}`, value));
    }
  }

  // Array maxItems
  if (Array.isArray(value) && schemaMaxItems !== undefined && value.length > schemaMaxItems) {
    errors.push(err(path, `Array length ${value.length} exceeds maxItems ${schemaMaxItems}`, value));
  }
}

function validateObjectAgainstSchema(
  obj: Record<string, unknown>,
  schema: Record<string, unknown>,
  path: string,
  errors: ValidationErrorV2[],
  requiredFields: string[],
): void {
  const schemaProps = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const additionalProps = schema.additionalProperties as boolean | undefined;

  // Required fields
  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === undefined) {
      errors.push(err(path, `Missing required field: ${field}`, obj));
    }
  }

  // Extra fields check (additionalProperties: false)
  if (additionalProps === false && schemaProps) {
    const allowedKeys = new Set(Object.keys(schemaProps));
    for (const key of Object.keys(obj)) {
      if (!allowedKeys.has(key)) {
        errors.push(err(`${path}.${key}`, `Unknown field not allowed (additionalProperties: false)`, obj[key]));
      }
    }
  }

  // Validate each present field
  if (schemaProps) {
    for (const [key, schemaDef] of Object.entries(schemaProps)) {
      if (key in obj) {
        validateValueAgainstSchema(obj[key], schemaDef, `${path}.${key}`, errors);
      }
    }
  }
}

function validateAgainstSchema(response: unknown): ValidationErrorV2[] {
  const errors: ValidationErrorV2[] = [];
  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    errors.push(err('', 'Response must be an object', response));
    return errors;
  }
  const obj = response as Record<string, unknown>;

  // Top-level schema (DiagnosisResponseV2)
  validateObjectAgainstSchema(obj, {
    type: 'object',
    additionalProperties: false,
    required: ['contractId', 'contractVersion', 'evidenceEnvelopeRef', 'responseId', 'issues', 'diagnosisBlocks', 'limitations', 'generatedAt'],
    properties: {
      contractId: { type: 'string', enum: ['aura.diagnosis.v2'] },
      contractVersion: { type: 'string', enum: ['2.0.0'] },
      evidenceEnvelopeRef: { type: 'string', minLength: 1 },
      responseId: { type: 'string', minLength: 1, maxLength: 128 },
      issues: { type: 'array', maxItems: 50 },
      diagnosisBlocks: { type: 'array', maxItems: 50 },
      limitations: { type: 'array', maxItems: 20 },
      generatedAt: { type: 'string' },
    },
  }, '', errors, ['contractId', 'contractVersion', 'evidenceEnvelopeRef', 'responseId', 'issues', 'diagnosisBlocks', 'limitations', 'generatedAt']);

  if (errors.length > 0) return errors;

  // issues array items
  const issues = obj.issues as unknown[];
  if (Array.isArray(issues)) {
    for (let i = 0; i < issues.length; i++) {
      validateObjectAgainstSchema(issues[i] as Record<string, unknown>, {
        type: 'object',
        additionalProperties: false,
        required: ['issueId', 'evidenceRefs', 'hypothesis', 'confidence', 'requiresHumanReview', 'limits'],
        properties: {
          issueId: { type: 'string', minLength: 1, maxLength: 128 },
          evidenceRefs: { type: 'array', maxItems: 20 },
          hypothesis: { type: 'string', maxLength: 500 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          requiresHumanReview: { type: 'boolean' },
          limits: { type: 'array', maxItems: 10 },
        },
      }, `issues[${i}]`, errors, ['issueId', 'evidenceRefs', 'hypothesis', 'confidence', 'requiresHumanReview', 'limits']);

      const issue = issues[i] as Record<string, unknown>;
      // Validate evidenceRefs items
      const evidenceRefs = issue.evidenceRefs as unknown[];
      if (Array.isArray(evidenceRefs)) {
        for (let j = 0; j < evidenceRefs.length; j++) {
          validateValueAgainstSchema(evidenceRefs[j], { type: 'string', minLength: 1, maxLength: 128 }, `issues[${i}].evidenceRefs[${j}]`, errors);
        }
      }
      // Validate limits items
      const limits = issue.limits as unknown[];
      if (Array.isArray(limits)) {
        for (let j = 0; j < limits.length; j++) {
          validateValueAgainstSchema(limits[j], { type: 'string', maxLength: 200 }, `issues[${i}].limits[${j}]`, errors);
        }
      }
    }
  }

  // diagnosisBlocks array items
  const blocks = obj.diagnosisBlocks as unknown[];
  if (Array.isArray(blocks)) {
    for (let i = 0; i < blocks.length; i++) {
      validateObjectAgainstSchema(blocks[i] as Record<string, unknown>, {
        type: 'object',
        additionalProperties: false,
        required: ['issueId', 'ruleId', 'columnId', 'scope', 'observation', 'recommendation'],
        properties: {
          issueId: { type: 'string', minLength: 1, maxLength: 128 },
          ruleId: { type: 'string', minLength: 1, maxLength: 64 },
          columnId: { type: ['string', 'null'], maxLength: 64 },
          scope: { type: 'string', enum: ['dataset', 'column'] },
          observation: { type: 'string', maxLength: 1000 },
          recommendation: { type: 'string', maxLength: 1000 },
        },
      }, `diagnosisBlocks[${i}]`, errors, ['issueId', 'ruleId', 'columnId', 'scope', 'observation', 'recommendation']);

      const block = blocks[i] as Record<string, unknown>;
      // Validate observation and recommendation strings
      validateValueAgainstSchema(block.observation as string, { type: 'string', maxLength: 1000 }, `diagnosisBlocks[${i}].observation`, errors);
      validateValueAgainstSchema(block.recommendation as string, { type: 'string', maxLength: 1000 }, `diagnosisBlocks[${i}].recommendation`, errors);
    }
  }

  // limitations array items
  const limitations = obj.limitations as unknown[];
  if (Array.isArray(limitations)) {
    for (let i = 0; i < limitations.length; i++) {
      validateValueAgainstSchema(limitations[i], { type: 'string', maxLength: 300 }, `limitations[${i}]`, errors);
    }
  }

  return errors;
}

// ── Main Validator ──

export function validateDiagnosisResponseV2(
  response: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  // 0. Schema validation (additionalProperties: false + type/enum/range checks)
  const schemaErrors = validateAgainstSchema(response as unknown);
  if (schemaErrors.length > 0) {
    return fail(schemaErrors);
  }

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
  if (response.responseId && response.responseId.length > 128) {
    errors.push(err('responseId', 'Exceeds maxLength 128', response.responseId));
  }

  // 3. Evidence envelope ref EXACT MATCH
  const expectedRef = buildEnvelopeRef(envelope);
  if (!response.evidenceEnvelopeRef || typeof response.evidenceEnvelopeRef !== 'string') {
    errors.push(err('evidenceEnvelopeRef', 'Must be non-empty string', response.evidenceEnvelopeRef));
  } else if (response.evidenceEnvelopeRef !== expectedRef) {
    errors.push(err('evidenceEnvelopeRef', 'DIAGNOSIS_ENVELOPE_MISMATCH: ref does not match envelope', {
      expected: expectedRef,
      actual: response.evidenceEnvelopeRef,
    }));
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

  if (errors.length > 0) return fail(errors);

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
  const issueEvidenceRefs = new Map<string, Set<string>>();
  for (const iss of envelope.issues) {
    issueEvidenceRefs.set(iss.issueId, new Set(iss.evidenceRefs));
  }

  // Column registry for ambiguity check
  const columnRegistry = new Map<string, { isAmbiguous: boolean; isDuplicate: boolean }>();
  for (const col of envelope.columns) {
    columnRegistry.set(col.columnId, { isAmbiguous: col.isAmbiguous, isDuplicate: col.isDuplicate });
  }

  // 8. Validate each DiagnosisIssueV2
  const seenIssueIds = new Set<string>();
  const issueIndex = new Map<string, number>();

  for (let i = 0; i < response.issues.length; i++) {
    const diagIssue = response.issues[i];
    const base = `issues[${i}]`;

    if (!diagIssue.issueId || typeof diagIssue.issueId !== 'string' || diagIssue.issueId.trim().length === 0) {
      errors.push(err(`${base}.issueId`, 'Must be non-empty string', diagIssue.issueId));
      continue;
    }
    if (diagIssue.issueId.length > 128) {
      errors.push(err(`${base}.issueId`, 'Exceeds maxLength 128', diagIssue.issueId));
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
    issueIndex.set(diagIssue.issueId, i);

    // Validate evidenceRefs
    if (!Array.isArray(diagIssue.evidenceRefs)) {
      errors.push(err(`${base}.evidenceRefs`, 'Must be an array', diagIssue.evidenceRefs));
    } else {
      const validRefs = issueEvidenceRefs.get(diagIssue.issueId) ?? new Set<string>();
      for (let j = 0; j < diagIssue.evidenceRefs.length; j++) {
        const ref = diagIssue.evidenceRefs[j];
        if (typeof ref !== 'string' || ref.length === 0) {
          errors.push(err(`${base}.evidenceRefs[${j}]`, 'Must be non-empty string', ref));
        } else if (!envelopeEvidenceRefs.has(ref)) {
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

    // HITL: requiresHumanReview
    const envelopeIssue = envelopeIssueMap.get(diagIssue.issueId);
    if (envelopeIssue) {
      const required = requiresReviewFromEnvelope(envelopeIssue, columnRegistry);
      if (required && !diagIssue.requiresHumanReview) {
        errors.push(err(
          `${base}.requiresHumanReview`,
          'Must be true — envelope requires human review (actionability, authorization, or ambiguous column)',
          { required, actual: diagIssue.requiresHumanReview },
        ));
      }
      // Empty evidenceRefs → requires review
      if (diagIssue.evidenceRefs.length === 0 && !diagIssue.requiresHumanReview) {
        errors.push(err(`${base}.requiresHumanReview`, 'Must be true — no evidenceRefs provided', diagIssue.requiresHumanReview));
      }
    } else {
      // Unknown issue → must require review
      if (!diagIssue.requiresHumanReview) {
        errors.push(err(`${base}.requiresHumanReview`, 'Must be true — unknown issue', diagIssue.requiresHumanReview));
      }
    }

    // hypothesis
    if (!diagIssue.hypothesis || typeof diagIssue.hypothesis !== 'string' || diagIssue.hypothesis.trim().length === 0) {
      errors.push(err(`${base}.hypothesis`, 'Must be non-empty string', diagIssue.hypothesis));
    } else {
      if (diagIssue.hypothesis.length > 500) {
        errors.push(err(`${base}.hypothesis`, 'Exceeds maxLength 500', diagIssue.hypothesis));
      }
      if (containsExecutable(diagIssue.hypothesis)) {
        errors.push(err(`${base}.hypothesis`, 'Contains executable content', diagIssue.hypothesis.slice(0, 100)));
      }
    }

    // limits
    if (!Array.isArray(diagIssue.limits)) {
      errors.push(err(`${base}.limits`, 'Must be an array', diagIssue.limits));
    } else {
      if (diagIssue.limits.length > 10) {
        errors.push(err(`${base}.limits`, 'Exceeds maxItems 10', diagIssue.limits.length));
      }
      for (let j = 0; j < diagIssue.limits.length; j++) {
        const lim = diagIssue.limits[j];
        if (typeof lim !== 'string') {
          errors.push(err(`${base}.limits[${j}]`, 'Must be string', lim));
        } else {
          if (lim.length > 200) {
            errors.push(err(`${base}.limits[${j}]`, 'Exceeds maxLength 200', lim));
          }
          if (containsExecutable(lim)) {
            errors.push(err(`${base}.limits[${j}]`, 'Contains executable content', lim.slice(0, 100)));
          }
        }
      }
    }
  }

  // 9. EXACT COVERAGE: every envelope issue must have exactly one diagnosis issue
  for (const envIssue of envelope.issues) {
    if (!seenIssueIds.has(envIssue.issueId)) {
      errors.push(err('issues', `Envelope issue "${envIssue.issueId}" has no corresponding DiagnosisIssueV2 (exact coverage required)`, envIssue.issueId));
    }
  }

  // 10. Validate each DiagnosisBlockV2
  const seenBlockIssueIds = new Map<string, number>(); // issueId → count
  const blockIndex = new Map<string, number>();

  for (let i = 0; i < response.diagnosisBlocks.length; i++) {
    const block = response.diagnosisBlocks[i];
    const base = `diagnosisBlocks[${i}]`;

    if (!block.issueId || typeof block.issueId !== 'string' || block.issueId.trim().length === 0) {
      errors.push(err(`${base}.issueId`, 'Must be non-empty string', block.issueId));
      continue;
    }
    if (block.issueId.length > 128) {
      errors.push(err(`${base}.issueId`, 'Exceeds maxLength 128', block.issueId));
    }

    // Count blocks per issueId (for uniqueness check)
    const blockCount = (seenBlockIssueIds.get(block.issueId) ?? 0) + 1;
    seenBlockIssueIds.set(block.issueId, blockCount);
    blockIndex.set(`${block.issueId}:${i}`, i);

    // Block must reference an issue in the response
    if (!seenIssueIds.has(block.issueId)) {
      errors.push(err(`${base}.issueId`, 'Block references issueId not in response.issues (orphan block)', block.issueId));
    }

    // RuleId
    if (!block.ruleId || typeof block.ruleId !== 'string') {
      errors.push(err(`${base}.ruleId`, 'Must be non-empty string', block.ruleId));
    } else {
      if (block.ruleId.length > 64) {
        errors.push(err(`${base}.ruleId`, 'Exceeds maxLength 64', block.ruleId));
      }
      if (!envelopeRuleIds.has(block.ruleId)) {
        errors.push(err(`${base}.ruleId`, 'ruleId does not exist in envelope', block.ruleId));
      } else if (envelopeIssueMap.has(block.issueId)) {
        // BLOCK COHERENCE: block's ruleId must match envelope issue's ruleId
        const envIssue = envelopeIssueMap.get(block.issueId)!;
        if (block.ruleId !== envIssue.ruleId) {
          errors.push(err(`${base}.ruleId`, 'Block ruleId does not match envelope issue\'s ruleId (coherence violation)', {
            blockRuleId: block.ruleId,
            envelopeRuleId: envIssue.ruleId,
            issueId: block.issueId,
          }));
        }
      }
    }

    // ColumnId
    if (block.scope === 'dataset') {
      if (block.columnId !== null) {
        errors.push(err(`${base}.columnId`, 'Must be null for dataset scope', block.columnId));
      }
    } else if (block.scope === 'column') {
      if (block.columnId === null) {
        errors.push(err(`${base}.columnId`, 'Must not be null for column scope', block.columnId));
      } else {
        if (!envelopeColumnIds.has(block.columnId)) {
          errors.push(err(`${base}.columnId`, 'columnId does not exist in envelope', block.columnId));
        } else if (envelopeIssueMap.has(block.issueId)) {
          // BLOCK COHERENCE: block's columnId must match envelope issue's columnId
          const envIssue = envelopeIssueMap.get(block.issueId)!;
          if (block.columnId !== envIssue.columnId) {
            errors.push(err(`${base}.columnId`, 'Block columnId does not match envelope issue\'s columnId (coherence violation)', {
              blockColumnId: block.columnId,
              envelopeColumnId: envIssue.columnId,
              issueId: block.issueId,
            }));
          }
        }
      }
    } else {
      errors.push(err(`${base}.scope`, 'Must be "dataset" or "column"', block.scope));
    }

    // Scope coherence: block's scope must match envelope issue's scope
    if (block.scope && envelopeIssueMap.has(block.issueId)) {
      const envIssue = envelopeIssueMap.get(block.issueId)!;
      if (block.scope !== envIssue.scope) {
        errors.push(err(`${base}.scope`, 'Block scope does not match envelope issue\'s scope (coherence violation)', {
          blockScope: block.scope,
          envelopeScope: envIssue.scope,
          issueId: block.issueId,
        }));
      }
    }

    // observation
    if (!block.observation || typeof block.observation !== 'string' || block.observation.trim().length === 0) {
      errors.push(err(`${base}.observation`, 'Must be non-empty string', block.observation));
    } else {
      if (block.observation.length > 1000) {
        errors.push(err(`${base}.observation`, 'Exceeds maxLength 1000', block.observation));
      }
      if (containsExecutable(block.observation)) {
        errors.push(err(`${base}.observation`, 'Contains executable content', block.observation.slice(0, 100)));
      }
    }

    // recommendation
    if (!block.recommendation || typeof block.recommendation !== 'string' || block.recommendation.trim().length === 0) {
      errors.push(err(`${base}.recommendation`, 'Must be non-empty string', block.recommendation));
    } else {
      if (block.recommendation.length > 1000) {
        errors.push(err(`${base}.recommendation`, 'Exceeds maxLength 1000', block.recommendation));
      }
      if (containsExecutable(block.recommendation)) {
        errors.push(err(`${base}.recommendation`, 'Contains executable content', block.recommendation.slice(0, 100)));
      }
    }
  }

  // 11. EXACT COVERAGE: exactly one block per envelope issue
  for (const envIssue of envelope.issues) {
    const blockCount = seenBlockIssueIds.get(envIssue.issueId) ?? 0;
    if (blockCount === 0) {
      errors.push(err('diagnosisBlocks', `Envelope issue "${envIssue.issueId}" has no corresponding DiagnosisBlockV2 (exact coverage required)`, envIssue.issueId));
    }
    // Also check: no duplicate blocks for the same issueId
    if (blockCount > 1) {
      errors.push(err('diagnosisBlocks', `Envelope issue "${envIssue.issueId}" has ${blockCount} DiagnosisBlockV2 (exactly one required)`, envIssue.issueId));
    }
  }

  // 12. Check for orphaned blocks (blocks referencing issues not in response.issues)
  for (let i = 0; i < response.diagnosisBlocks.length; i++) {
    const block = response.diagnosisBlocks[i];
    if (block.issueId && !seenIssueIds.has(block.issueId)) {
      errors.push(err(`diagnosisBlocks[${i}].issueId`, 'Orphaned block — issueId not in response.issues', block.issueId));
    }
  }

  // 13. Executable content in limitations
  for (let i = 0; i < (response.limitations || []).length; i++) {
    const lim = response.limitations[i];
    if (typeof lim !== 'string') {
      errors.push(err(`limitations[${i}]`, 'Must be string', lim));
    } else {
      if (lim.length > 300) {
        errors.push(err(`limitations[${i}]`, 'Exceeds maxLength 300', lim));
      }
      if (containsExecutable(lim)) {
        errors.push(err(`limitations[${i}]`, 'Contains executable content', lim.slice(0, 100)));
      }
    }
  }

  return errors.length > 0 ? fail(errors) : ok(warnings);
}
