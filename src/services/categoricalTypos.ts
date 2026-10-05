import { isIdentifierColumn } from './ruleChecks';

const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// One inserted, deleted, replaced or transposed letter. This is a suspicion,
// not proof that the two categories mean the same thing.
const oneLetterApart = (left: string, right: string): boolean => {
  if (Math.abs(left.length - right.length) > 1 || left === right) return false;
  if (left.length === right.length) {
    const mismatches = [...left].flatMap((letter, index) => letter === right[index] ? [] : [index]);
    return mismatches.length === 1 || (mismatches.length === 2
      && mismatches[1] === mismatches[0] + 1
      && left[mismatches[0]] === right[mismatches[1]]
      && left[mismatches[1]] === right[mismatches[0]]);
  }
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) index++;
  return shorter.slice(index) === longer.slice(index + 1);
};

export interface PossibleCategoryTypo {
  value: string;
  similarValue: string;
  count: number;
  rowNumbers: number[];
}

/** Bounded comparison of repeated categories; never names, IDs or free text. */
export function findPossibleCategoryTypos(column: string, values: unknown[]): PossibleCategoryTypo[] {
  if (isIdentifierColumn(column)
    || /name|nombre|apellido|surname|person|cliente|ticket|code|codigo|código|ref|key|email|correo|phone|telefono|url|link|notes|nota|observ|desc|comment/i.test(column)) return [];
  const groups = new Map<string, { value: string; count: number; rowNumbers: number[] }>();
  let present = 0;
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (typeof value !== 'string' || !value.trim()) continue;
    present++;
    const key = normalize(value);
    // Codes, phrases and long free text are outside this rule.
    if (!/^[a-z]{5,32}$/.test(key)) continue;
    const group = groups.get(key) ?? { value, count: 0, rowNumbers: [] };
    group.count++;
    if (group.rowNumbers.length < 20) group.rowNumbers.push(index + 1);
    groups.set(key, group);
    if (groups.size > 100) return [];
  }
  if (groups.size < 2 || groups.size / Math.max(present, 1) > 0.5) return [];
  const result: PossibleCategoryTypo[] = [];
  for (const [key, group] of groups) {
    const candidates = [...groups].filter(([other, common]) => common.count >= 3
      && common.count >= group.count * 3 && oneLetterApart(key, other));
    // Ambiguous matches are not enough evidence to name a likely counterpart.
    if (candidates.length === 1) result.push({ value: group.value,
      similarValue: candidates[0][1].value, count: group.count, rowNumbers: group.rowNumbers });
  }
  return result;
}
