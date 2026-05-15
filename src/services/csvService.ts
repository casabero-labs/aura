import Papa from 'papaparse';
import { CsvParsedData } from '../types';

export const parseCsv = (file: File): Promise<CsvParsedData> => {
  return new Promise((resolve, reject) => {
    // PapaParse's "sniffer" is built-in via the delimiter: "" (auto) option.
    // It reads the first chunk to guess the delimiter.
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 5000, // Limit to 5000 rows for browser performance in this demo
      delimiter: "", // Auto-detect delimiter (Sniffer)
      dynamicTyping: true, // Auto-convert numbers
      complete: (results: any) => {
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
    });
  });
};