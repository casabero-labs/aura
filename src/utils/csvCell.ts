/**
 * Serializa un valor como celda CSV entrecomillada y neutraliza la inyección
 * de fórmulas en hojas de cálculo (OWASP "CSV Injection"): si el texto empieza
 * por `=`, `+`, `-`, `@`, tabulador o retorno de carro, se antepone una comilla
 * simple para que Excel / LibreOffice / Sheets lo traten como texto literal.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function csvCell(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  const text = raw.length > 0 && FORMULA_TRIGGERS.has(raw[0]) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}
