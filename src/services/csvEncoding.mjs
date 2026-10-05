// Shared CSV text decoding for upload, verification, re-audit and the Python
// runner. Pure JavaScript so the Node runner (.mjs) and the browser use the
// exact same rules. Hashes are always computed over the original bytes; this
// module only decides how those bytes become text and back.

/** @typedef {'utf-8' | 'windows-1252'} CsvEncoding */
/** @typedef {{ text: string, encoding: CsvEncoding, bom: boolean }} DecodedCsv */

/** @type {readonly CsvEncoding[]} */
export const SUPPORTED_CSV_ENCODINGS = Object.freeze(['utf-8', 'windows-1252']);

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** @param {unknown} value @returns {value is CsvEncoding} */
export const isSupportedCsvEncoding = (value) =>
  typeof value === 'string' && SUPPORTED_CSV_ENCODINGS.includes(/** @type {CsvEncoding} */ (value));

/** @param {Uint8Array} bytes */
const startsWith = (bytes, prefix) => prefix.every((byte, index) => bytes[index] === byte);

/** @param {ArrayBuffer | ArrayBufferView} content @returns {Uint8Array} */
const toBytes = (content) => {
  if (content instanceof Uint8Array) return content;
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  return new Uint8Array(content);
};

/**
 * Decode CSV bytes. Without `encoding`, UTF-8 is tried strictly and
 * Windows-1252 (a superset of Latin-1) is the only fallback. With `encoding`,
 * the bytes must decode under that recorded encoding. A UTF-8 BOM is removed
 * from the text and reported in `bom`; UTF-16 and BOM-plus-non-UTF-8 input is
 * rejected instead of being decoded into mojibake.
 *
 * @param {ArrayBuffer | ArrayBufferView} content
 * @param {CsvEncoding} [encoding]
 * @returns {DecodedCsv}
 */
export function decodeCsvBytes(content, encoding) {
  const bytes = toBytes(content);
  if (encoding !== undefined && !isSupportedCsvEncoding(encoding)) {
    throw new Error(`CSV_ENCODING_UNSUPPORTED: ${String(encoding)}`);
  }
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) {
    throw new Error('CSV_ENCODING_UNSUPPORTED: UTF-16');
  }
  const bom = startsWith(bytes, UTF8_BOM);
  const tryUtf8 = () => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    .decode(bom ? bytes.subarray(UTF8_BOM.length) : bytes);

  if (encoding === 'utf-8' || (encoding === undefined && bom)) {
    try {
      return { text: tryUtf8(), encoding: 'utf-8', bom };
    } catch {
      throw new Error('CSV_ENCODING_INVALID: los bytes no son UTF-8 válido');
    }
  }
  if (encoding === 'windows-1252') {
    if (bom) throw new Error('CSV_ENCODING_INVALID: BOM UTF-8 en un archivo Windows-1252');
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252', bom: false };
  }
  try {
    return { text: tryUtf8(), encoding: 'utf-8', bom: false };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252', bom: false };
  }
}

/** @type {Map<string, number> | null} */
let windows1252Table = null;
const windows1252Encoder = () => {
  if (windows1252Table) return windows1252Table;
  // Inverse of the WHATWG decoder, so decode(encode(text)) is the identity.
  const decoder = new TextDecoder('windows-1252');
  windows1252Table = new Map();
  for (let byte = 0; byte < 256; byte += 1) {
    windows1252Table.set(decoder.decode(new Uint8Array([byte])), byte);
  }
  return windows1252Table;
};

/**
 * Encode text back into the source encoding. Fails closed when a character
 * has no representation in Windows-1252 instead of substituting it.
 *
 * @param {string} text
 * @param {CsvEncoding} encoding
 * @param {{ bom?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function encodeCsvText(text, encoding, options = {}) {
  if (!isSupportedCsvEncoding(encoding)) throw new Error(`CSV_ENCODING_UNSUPPORTED: ${String(encoding)}`);
  if (encoding === 'utf-8') {
    const body = new TextEncoder().encode(text);
    if (!options.bom) return body;
    const out = new Uint8Array(body.length + UTF8_BOM.length);
    out.set(UTF8_BOM, 0);
    out.set(body, UTF8_BOM.length);
    return out;
  }
  if (options.bom) throw new Error('CSV_ENCODING_INVALID: BOM UTF-8 en un archivo Windows-1252');
  const table = windows1252Encoder();
  const out = new Uint8Array(text.length);
  let length = 0;
  for (const char of text) {
    const byte = table.get(char);
    if (byte === undefined) {
      throw new Error(`CSV_ENCODING_UNREPRESENTABLE: U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} no existe en windows-1252`);
    }
    out[length] = byte;
    length += 1;
  }
  return out.subarray(0, length);
}
