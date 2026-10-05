/**
 * P1-N1 (evaluación multidataset 2026-10-05): el validador exige
 * requiresHumanReview=true cuando la recomendación usa un verbo destructivo.
 * El modelo solo puede cumplirlo si el prompt se lo dice, con la misma lista.
 */
import { describe, it, expect } from 'vitest';
import { DIAGNOSIS_FRAGMENT_SYSTEM_INSTRUCTION_ES } from '../contracts/llm/diagnosisFragmentsV2';
import {
  DESTRUCTIVE_RECOMMENDATION_VERBS,
  findUnsafeRecommendationsWithoutReview,
} from '../contracts/llm/diagnosisEvidenceReview';

describe('regla de revisión humana en el prompt por hallazgo', () => {
  it('nombra cada verbo que el validador considera destructivo', () => {
    for (const verb of DESTRUCTIVE_RECOMMENDATION_VERBS) {
      expect(DIAGNOSIS_FRAGMENT_SYSTEM_INSTRUCTION_ES, verb).toContain(verb);
    }
  });

  it('el validador sigue rechazando requiresHumanReview=false con esos verbos (no se debilita)', () => {
    const response: any = {
      issues: [{ issueId: 'a', requiresHumanReview: false }],
      diagnosisBlocks: [{ issueId: 'a', recommendation: 'Eliminar los espacios sobrantes.' }],
    };
    expect(findUnsafeRecommendationsWithoutReview(response)).toHaveLength(1);
    response.issues[0].requiresHumanReview = true;
    expect(findUnsafeRecommendationsWithoutReview(response)).toHaveLength(0);
  });
});
