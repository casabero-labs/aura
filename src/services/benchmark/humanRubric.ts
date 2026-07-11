import type { HumanReviewV1 } from './experimentTypes';

export interface HumanRubricInput {
  reviewerId: string;
  reviewedAt: string;
  clarity: number;
  traceability: number;
  actionability: number;
  notes: string;
}

export interface HumanRubricValidationResult {
  valid: boolean;
  errors: string[];
}

export class HumanRubricError extends Error {
  constructor(readonly errors: string[]) {
    super(`HUMAN_RUBRIC_INVALID: ${errors.join('; ')}`);
    this.name = 'HumanRubricError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCanonicalIsoUtc = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const isRubricScore = (value: number): value is 0 | 1 | 2 | 3 | 4 =>
  Number.isInteger(value) && value >= 0 && value <= 4;

export const validateHumanRubric = (
  input: unknown,
): HumanRubricValidationResult => {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ['human rubric must be an object'] };
  const reviewerId = input.reviewerId;
  const reviewedAt = input.reviewedAt;
  const notes = input.notes;
  const clarity = input.clarity;
  const traceability = input.traceability;
  const actionability = input.actionability;

  if (typeof reviewerId !== 'string' || reviewerId.trim().length === 0) {
    errors.push('reviewerId is required');
  }
  if (typeof reviewedAt !== 'string' || !isCanonicalIsoUtc(reviewedAt)) {
    errors.push('reviewedAt must be a canonical ISO UTC timestamp');
  }
  for (const [field, score] of [
    ['clarity', clarity],
    ['traceability', traceability],
    ['actionability', actionability],
  ] as const) {
    if (typeof score !== 'number' || !isRubricScore(score)) {
      errors.push(`${field} must be an integer from 0 to 4`);
    }
  }
  if (typeof notes !== 'string') errors.push('notes must be a string');
  const hasExtreme = [clarity, traceability, actionability]
    .some((score) => score === 0 || score === 4);
  if (hasExtreme && (typeof notes !== 'string' || notes.trim().length === 0)) {
    errors.push('notes are required when any score is 0 or 4');
  }
  return { valid: errors.length === 0, errors };
};

export const createHumanReview = (input: HumanRubricInput): HumanReviewV1 => {
  const validation = validateHumanRubric(input);
  if (!validation.valid) throw new HumanRubricError(validation.errors);
  const clarity = input.clarity as 0 | 1 | 2 | 3 | 4;
  const traceability = input.traceability as 0 | 1 | 2 | 3 | 4;
  const actionability = input.actionability as 0 | 1 | 2 | 3 | 4;

  return {
    contractId: 'aura.human-review.v1',
    reviewerId: input.reviewerId.trim(),
    reviewedAt: input.reviewedAt,
    clarity,
    traceability,
    actionability,
    mean: (clarity + traceability + actionability) / 3,
    notes: input.notes.trim(),
  };
};
