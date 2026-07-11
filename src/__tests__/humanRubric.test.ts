import { describe, expect, it } from 'vitest';
import {
  createHumanReview,
  HumanRubricError,
  validateHumanRubric,
} from '../services/benchmark/humanRubric';

const base = {
  reviewerId: 'reviewer:oe4',
  reviewedAt: '2026-07-11T12:00:00.000Z',
  clarity: 3,
  traceability: 2,
  actionability: 1,
  notes: '',
};

describe('OE4 human rubric', () => {
  it('builds a review and calculates the exact mean', () => {
    const review = createHumanReview(base);

    expect(review).toEqual({
      contractId: 'aura.human-review.v1',
      ...base,
      mean: 2,
    });
  });

  it('rejects scores outside 0–4 and fractional scores', () => {
    expect(validateHumanRubric({ ...base, clarity: -1 }).valid).toBe(false);
    expect(validateHumanRubric({ ...base, clarity: 5 }).valid).toBe(false);
    expect(validateHumanRubric({ ...base, clarity: 2.5 }).valid).toBe(false);
  });

  it('requires reviewer and canonical review date', () => {
    expect(validateHumanRubric({ ...base, reviewerId: '' }).errors).toContain('reviewerId is required');
    expect(validateHumanRubric({ ...base, reviewedAt: 'tomorrow' }).errors).toContain(
      'reviewedAt must be a canonical ISO UTC timestamp',
    );
  });

  it('fails closed for incomplete runtime input', () => {
    expect(validateHumanRubric(null).errors).toEqual(['human rubric must be an object']);
    expect(validateHumanRubric({}).valid).toBe(false);
  });

  it('requires an explanatory note when any dimension is scored 0 or 4', () => {
    expect(validateHumanRubric({ ...base, clarity: 0, notes: '   ' }).errors).toContain(
      'notes are required when any score is 0 or 4',
    );
    expect(validateHumanRubric({ ...base, actionability: 4, notes: 'Evidencia completa.' }).valid).toBe(true);
  });

  it('fails closed when creating an invalid review', () => {
    expect(() => createHumanReview({ ...base, traceability: 9 })).toThrow(HumanRubricError);
  });
});
