import type { DiagnosisResponseV2, EvidenceEnvelopeV2 } from './types';

export interface UnsupportedDiagnosisClaim {
  issueId: string;
  path: string;
  literal: string;
}

export interface UnsafeDiagnosisRecommendation {
  issueId: string;
  path: string;
  recommendation: string;
}

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('es')
  .replace(/\s+/g, ' ')
  .trim();

const QUOTED_LITERAL = /["“”]([^"“”]{1,120})["“”]|`([^`]{1,120})`/g;
const DATA_LIKE_LITERAL = /\d|@|\/|\\|\.|^(?:n\/?a|null|none|nan|vac[ií]o)$/i;
const DESTRUCTIVE_RECOMMENDATION = /\b(?:eliminar|borrar|descartar|drop|imputar|reemplazar|recortar|capar|capping|anonimizar|decodificar|convertir)\b/i;

const extractDataLikeLiterals = (text: string) => {
  const literals: string[] = [];
  for (const match of text.matchAll(QUOTED_LITERAL)) {
    const literal = (match[1] ?? match[2] ?? '').trim();
    if (literal && DATA_LIKE_LITERAL.test(literal)) literals.push(literal);
  }
  return literals;
};

const scopedEvidenceText = (envelope: EvidenceEnvelopeV2, issueId: string) => {
  const issue = envelope.issues.find((candidate) => candidate.issueId === issueId);
  if (!issue) return '';
  const samples = envelope.evidence.samples.filter((sample) => sample.issueId === issueId);
  const columnStats = issue.columnId ? envelope.evidence.columnStats[issue.columnId] : undefined;
  return normalize(JSON.stringify({ issue, samples, columnStats }));
};

/**
 * Checks only explicit, quoted data-like values. This deliberately stays narrow:
 * qualitative interpretation remains allowed, while sample values attributed to
 * an issue must exist in that issue's own evidence scope.
 */
export const findUnsupportedDiagnosisClaims = (
  response: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
): UnsupportedDiagnosisClaim[] => {
  const claims: UnsupportedDiagnosisClaim[] = [];
  const inspect = (issueId: string, path: string, text: string) => {
    const evidence = scopedEvidenceText(envelope, issueId);
    for (const literal of extractDataLikeLiterals(text)) {
      if (!evidence.includes(normalize(literal))) {
        claims.push({ issueId, path, literal });
      }
    }
  };

  response.issues.forEach((issue, index) => {
    inspect(issue.issueId, `issues[${index}].hypothesis`, issue.hypothesis);
    issue.limits.forEach((limit, limitIndex) => {
      inspect(issue.issueId, `issues[${index}].limits[${limitIndex}]`, limit);
    });
  });
  response.diagnosisBlocks.forEach((block, index) => {
    inspect(block.issueId, `diagnosisBlocks[${index}].observation`, block.observation);
    inspect(block.issueId, `diagnosisBlocks[${index}].recommendation`, block.recommendation);
  });

  return claims;
};

export const findUnsafeRecommendationsWithoutReview = (
  response: DiagnosisResponseV2,
): UnsafeDiagnosisRecommendation[] => {
  const reviewByIssueId = new Map(
    response.issues.map((issue) => [issue.issueId, issue.requiresHumanReview]),
  );
  return response.diagnosisBlocks.flatMap((block, index) => {
    if (!DESTRUCTIVE_RECOMMENDATION.test(block.recommendation)) return [];
    if (reviewByIssueId.get(block.issueId) === true) return [];
    return [{
      issueId: block.issueId,
      path: `diagnosisBlocks[${index}].recommendation`,
      recommendation: block.recommendation,
    }];
  });
};
