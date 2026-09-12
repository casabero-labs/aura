import Papa from 'papaparse';

/** Parse lexical cell values, independently of the statistical interpretation. */
export function readCsvTable(content) {
  const text = typeof content === 'string' ? content : new TextDecoder('utf-8', { fatal: true }).decode(content);
  const parsed = Papa.parse(text, { header: false, dynamicTyping: false, skipEmptyLines: true });
  const [fields, ...rows] = parsed.data;
  if (!fields?.length || fields.some(field => !field.trim()) || new Set(fields).size !== fields.length
    || rows.some(row => row.length !== fields.length)
    || parsed.errors.some(error => error.type !== 'Delimiter')) {
    throw new Error('PRESERVATION_CSV_STRUCTURE_INVALID');
  }
  return { fields, rows };
}

/**
 * V2 columnRefs are part of the approved script hash. They bound editable
 * columns. Historical scripts without these references remain execution-only.
 * Row removal is limited to original exact duplicates, in original order.
 * This verifies protected cells, not semantic correctness of authorized edits.
 */
export function validateValuePreservation(bundle, sourceCsv, outputCsv) {
  const payload = bundle.scriptHashPayload;
  if (!Array.isArray(payload?.columnRefs)) return [];
  try {
    const before = readCsvTable(sourceCsv);
    const after = readCsvTable(outputCsv);
    if (JSON.stringify(before.fields) !== JSON.stringify(after.fields)) return ['PRESERVATION_COLUMNS_CHANGED'];
    const editable = new Set();
    for (const ref of payload.columnRefs) {
      if (!Number.isInteger(ref.position) || before.fields[ref.position] !== ref.name) {
        return ['PRESERVATION_COLUMN_REFERENCE_INVALID'];
      }
      editable.add(ref.position);
    }
    // Exact operation emitted by the approved V2 renderer; comments do not qualify.
    const canDeduplicate = bundle.scriptText.split('\n').some(line =>
      line.trim() === 'df_clean = df_clean.drop_duplicates(keep="first").copy()');
    const protectedKey = row => JSON.stringify(row.filter((_value, index) => !editable.has(index)));
    const seen = new Set();
    let outputIndex = 0;
    for (const row of before.rows) {
      const fullKey = JSON.stringify(row);
      const next = after.rows[outputIndex];
      if (next && protectedKey(row) === protectedKey(next)) {
        outputIndex += 1;
      } else if (!canDeduplicate || !seen.has(fullKey)) {
        return ['PRESERVATION_UNAPPROVED_VALUE_OR_ROW_CHANGE'];
      }
      seen.add(fullKey);
    }
    if (outputIndex !== after.rows.length) return ['PRESERVATION_UNAPPROVED_VALUE_OR_ROW_CHANGE'];
    if (!canDeduplicate && before.rows.length !== after.rows.length) return ['PRESERVATION_UNAPPROVED_ROW_CHANGE'];
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'PRESERVATION_CSV_INVALID'];
  }
}
