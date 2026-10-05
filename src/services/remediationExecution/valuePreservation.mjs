import Papa from 'papaparse';
import { decodeCsvBytes, isSupportedCsvEncoding } from '../csvEncoding.mjs';

/** @typedef {import('../csvEncoding.mjs').CsvEncoding} CsvEncoding */

/**
 * Parse lexical cell values, independently of the statistical interpretation.
 * Bytes are decoded with `options.encoding` (the recorded source encoding) or,
 * without it, with the shared UTF-8 → Windows-1252 detection. The result keeps
 * the source dialect (delimiter, line break, encoding, BOM) so a corrected
 * copy can be written back in the same shape.
 *
 * @param {string | Uint8Array} content
 * @param {{ encoding?: CsvEncoding }} [options]
 */
export function readCsvTable(content, options = {}) {
  let text;
  let encoding = null;
  let bom = false;
  if (typeof content === 'string') {
    text = content;
  } else {
    try {
      ({ text, encoding, bom } = decodeCsvBytes(content, options.encoding));
    } catch {
      throw new Error('PRESERVATION_CSV_ENCODING_INVALID');
    }
  }
  const parsed = Papa.parse(text, { header: false, dynamicTyping: false, skipEmptyLines: true });
  const [fields, ...rows] = parsed.data;
  if (!fields?.length || fields.some(field => !field.trim()) || new Set(fields).size !== fields.length
    || rows.some(row => row.length !== fields.length)
    || parsed.errors.some(error => error.type !== 'Delimiter')) {
    throw new Error('PRESERVATION_CSV_STRUCTURE_INVALID');
  }
  return {
    fields,
    rows,
    delimiter: parsed.meta.delimiter || ',',
    linebreak: parsed.meta.linebreak || '\n',
    encoding,
    bom,
  };
}

/** Recorded source encoding: explicit option, then the bundle's optional field. */
const recordedEncoding = (bundle, options) => {
  const value = options?.encoding ?? bundle?.sourceEncoding;
  if (value === undefined) return undefined;
  if (!isSupportedCsvEncoding(value)) throw new Error('PRESERVATION_CSV_ENCODING_INVALID');
  return value;
};

/**
 * V2 columnRefs are part of the approved script hash. They bound editable
 * columns. Historical scripts without these references remain execution-only.
 * Row removal is limited to original exact duplicates, in original order.
 * This verifies protected cells, not semantic correctness of authorized edits.
 */
export function validateValuePreservation(bundle, sourceCsv, outputCsv, options = {}) {
  const payload = bundle.scriptHashPayload;
  if (!Array.isArray(payload?.columnRefs)) return [];
  try {
    const before = readCsvTable(sourceCsv, { encoding: recordedEncoding(bundle, options) });
    // The corrected copy must use the source's encoding, never its own guess.
    const after = readCsvTable(outputCsv, { encoding: before.encoding ?? recordedEncoding(bundle, options) });
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
