/** Reject unusable input before building any profile, score or positive report. */
export function assertUsableCsv(result: {
  data: Record<string, unknown>[];
  meta: { fields?: string[]; renamedHeaders?: Record<string, string> };
  errors?: { type: string; code: string; row?: number }[];
}): void {
  const structuralError = result.errors?.find(error => error.type === 'Quotes' || error.type === 'FieldMismatch');
  if (structuralError) {
    const position = structuralError.row === undefined ? '' : ` (registro ${structuralError.row + 1})`;
    throw new Error(`No se pudo auditar: el CSV tiene comillas o columnas inconsistentes${position}. Revisa el archivo y vuelve a seleccionarlo.`);
  }
  const fields = result.meta.fields ?? [];
  if (!result.data.length) {
    throw new Error('No se pudo auditar: archivo vacío o sin registros con datos. Selecciona un CSV con encabezados y al menos un registro.');
  }
  if (!fields.length || fields.some(field => !field.trim())
    || new Set(fields).size !== fields.length || Object.keys(result.meta.renamedHeaders ?? {}).length) {
    throw new Error('No se pudo auditar: faltan encabezados válidos o hay nombres de columna repetidos.');
  }
  if (!result.data.length || !result.data.some(row => fields.some(field => String(row[field] ?? '').trim() !== ''))) {
    throw new Error('No se pudo auditar: archivo vacío o sin registros con datos. Selecciona un CSV con encabezados y al menos un registro.');
  }
}
