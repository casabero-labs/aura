import { describe, expect, it } from 'vitest';
import { buildColumnRegistry, getColumnsRequiringReview, resolveColumn } from '../contracts/llm/columnRegistry';

describe('column naming and safe references', () => {
  it('does not treat ordinary names as confusing', () => {
    const columns = buildColumnRegistry(['Name', 'id', 'value', 'key', 'data', 'column', 'col_2', 'field', 'attr', 'var', 'val', 'row', 'item', 'entry']);
    expect(getColumnsRequiringReview(columns)).toEqual([]);
    expect(columns.every(column => !column.isAmbiguous)).toBe(true);
  });
  it('keeps visually confusing, empty and symbol-only names under review', () => {
    const columns = buildColumnRegistry(['l1l1', '0O0', '', '  ', '!@#']);
    expect(columns.every(column => column.isAmbiguous)).toBe(true);
    expect(getColumnsRequiringReview(columns)).toHaveLength(5);
  });
  it('keeps duplicate names under review and distinguishes them by identifier and position', () => {
    const columns = buildColumnRegistry(['Name', 'Name']);
    expect(columns[0].columnId).not.toBe(columns[1].columnId);
    expect(getColumnsRequiringReview(columns)).toHaveLength(2);
    expect(resolveColumn(columns, { columnId: columns[1].columnId })).toEqual(columns[1]);
    expect(resolveColumn(columns, { name: 'Name' })).toMatchObject({ reason: 'duplicate_name' });
  });
});
