import Papa from 'papaparse';
import { CsvParsedData } from '../types';
import { assertUsableCsv } from './csvValidation';
import { decodeCsvBytes, type CsvEncoding } from './csvEncoding.mjs';

export type { CsvEncoding };

/** How the original bytes became text. The bytes themselves are never rewritten. */
export interface CsvSourceInfo {
  encoding: CsvEncoding;
  bom: boolean;
  /** Original bytes, read once; hash these (not the decoded text). */
  bytes: Uint8Array;
}

export type CsvParsedSource = CsvParsedData & { source: CsvSourceInfo };

const readBytes = async (file: Blob): Promise<Uint8Array> => {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Reads the file bytes once, decodes them as strict UTF-8 or, failing that,
 * Windows-1252 (Latin-1 superset), strips a UTF-8 BOM and parses the text.
 */
export const parseCsv = async (file: Blob, previewLimit?: number): Promise<CsvParsedSource> => {
  const bytes = await readBytes(file);
  let decoded: ReturnType<typeof decodeCsvBytes>;
  try {
    decoded = decodeCsvBytes(bytes);
  } catch {
    throw new Error('No se pudo auditar: la codificación del archivo no es UTF-8 ni Latin-1 (Windows-1252).');
  }
  const source: CsvSourceInfo = { encoding: decoded.encoding, bom: decoded.bom, bytes };

  return new Promise((resolve, reject) => {
    // PapaParse's "sniffer" is built-in via the delimiter: "" (auto) option.
    const parseConfig: Papa.ParseConfig = {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // Auto-detect delimiter (Sniffer)
      dynamicTyping: false, // Preserve source values; statistics use a separate view.
      worker: true, // Use Web Workers to parse asynchronously and keep the UI fluid
      complete: (results: any) => {
        try { assertUsableCsv(results); } catch (error) { reject(error); return; }
        resolve({
          data: results.data,
          meta: {
            delimiter: results.meta.delimiter || ",",
            fields: results.meta.fields || [],
            truncated: results.meta.truncated
          },
          errors: results.errors,
          source,
        });
      },
      error: (error: any) => {
        reject(error);
      }
    };

    if (typeof previewLimit === 'number' && previewLimit > 0) {
      parseConfig.preview = previewLimit;
    }

    Papa.parse(decoded.text, parseConfig as Papa.ParseConfig<unknown>);
  });
};
