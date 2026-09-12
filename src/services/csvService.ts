import Papa from 'papaparse';
import { CsvParsedData } from '../types';
import { assertUsableCsv } from './csvValidation';

export const parseCsv = (file: File, previewLimit?: number): Promise<CsvParsedData> => {
  return new Promise((resolve, reject) => {
    // PapaParse's "sniffer" is built-in via the delimiter: "" (auto) option.
    // It reads the first chunk to guess the delimiter.
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
          errors: results.errors
        });
      },
      error: (error: any) => {
        reject(error);
      }
    };

    if (typeof previewLimit === 'number' && previewLimit > 0) {
      parseConfig.preview = previewLimit;
    }

    Papa.parse(file, parseConfig);
  });
};
