/** Shared input checks. They inspect source text and never rewrite a cell. */
export interface ColumnRule {
  type?: 'identifier' | 'string' | 'number' | 'date';
  required?: boolean;
  allowNegative?: boolean;
  unique?: boolean;
  allowedValues?: readonly string[];
  dateFormat?: 'ISO' | 'DMY' | 'MDY';
  min?: number;
  max?: number;
  integer?: boolean;
  /** Exact text length, useful for identifiers only when the owner declares it. */
  length?: number;
}

export type DatasetRules = Record<string, ColumnRule>;

export function isIdentifierColumn(name: string): boolean {
  const words = name.replace(/([a-z])([A-Z])/g, '$1_$2').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/);
  return words.some(word => ['id', 'uuid', 'guid', 'documento', 'cedula', 'dni', 'nif', 'nit', 'passport', 'pasaporte'].includes(word));
}

export function isDateColumn(name: string): boolean {
  const words = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/);
  return words.some(word => ['fecha', 'date', 'datetime', 'timestamp', 'dob'].includes(word))
    || /^(created|updated|deleted)_at$/i.test(name);
}

export function isCreditCard(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  if (!/^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/.test(digits)) return false;
  let total = 0;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if ((digits.length - 1 - index) % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    total += digit;
  }
  return total % 10 === 0;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASH = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function calendarDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(0, 0, 0, 0);
  return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1
    && result.getUTCDate() === day ? result : null;
}

export interface CheckedDate {
  valid: boolean;
  /** null means the day/month order is ambiguous, not that a conversion was made. */
  instant: Date | null;
  format: 'ISO' | 'DMY' | 'MDY' | null;
}

export function checkDate(value: unknown, expected?: ColumnRule['dateFormat']): CheckedDate {
  const text = String(value ?? '').trim();
  const iso = text.match(ISO);
  const slash = text.match(SLASH);
  const invalid: CheckedDate = { valid: false, instant: null, format: null };
  if (!iso && !slash) return invalid;
  let date: Date | null;
  let format: CheckedDate['format'];
  let hour: number, minute: number, second: number;
  if (iso) {
    date = calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    format = 'ISO';
    hour = Number(iso[4] ?? 0); minute = Number(iso[5] ?? 0); second = Number(iso[6] ?? 0);
    if (iso[7] && iso[7] !== 'Z') {
      const zone = iso[7].replace(':', '');
      if (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(3)) > 59) return invalid;
    }
  } else {
    const match = slash!;
    const dmy = calendarDate(Number(match[4]), Number(match[3]), Number(match[1]));
    const mdy = calendarDate(Number(match[4]), Number(match[1]), Number(match[3]));
    hour = Number(match[5] ?? 0); minute = Number(match[6] ?? 0); second = Number(match[7] ?? 0);
    if (expected === 'DMY') { date = dmy; format = 'DMY'; }
    else if (expected === 'MDY') { date = mdy; format = 'MDY'; }
    else if (dmy && mdy && dmy.getTime() !== mdy.getTime()) {
      return hour <= 23 && minute <= 59 && second <= 59
        ? { valid: true, instant: null, format: null } : invalid;
    } else { date = dmy ?? mdy; format = dmy ? 'DMY' : 'MDY'; }
  }
  if (!date || hour > 23 || minute > 59 || second > 59) return invalid;
  date.setUTCHours(hour, minute, second, 0);
  if (iso?.[7]) {
    const zoned = new Date(text.replace(' ', 'T'));
    if (!Number.isFinite(zoned.getTime())) return invalid;
    date = zoned;
  }
  return { valid: true, instant: date, format };
}

export function validateDatasetRules(rules: DatasetRules, fields: string[]): void {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw new Error('Las reglas deben ser un objeto de columnas.');
  for (const [name, rule] of Object.entries(rules)) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`Regla no válida en ${name}.`);
    const supported = new Set(['type', 'required', 'allowNegative', 'unique', 'allowedValues', 'dateFormat', 'min', 'max', 'integer', 'length']);
    if (Object.keys(rule).some(key => !supported.has(key))) throw new Error(`La regla de ${name} contiene una opción desconocida.`);
    for (const flag of ['required', 'unique', 'integer', 'allowNegative'] as const) {
      if (rule[flag] !== undefined && typeof rule[flag] !== 'boolean') throw new Error(`Opción no válida en ${name}: ${flag}.`);
    }
    if (!fields.includes(name)) throw new Error(`La regla menciona una columna que no existe: ${name}.`);
    if (rule.type !== undefined && !['identifier', 'string', 'number', 'date'].includes(rule.type)) throw new Error(`Tipo no válido en ${name}.`);
    if (rule.dateFormat !== undefined && !['ISO', 'DMY', 'MDY'].includes(rule.dateFormat)) throw new Error(`Formato de fecha no válido en ${name}.`);
    if (rule.allowedValues !== undefined && (!Array.isArray(rule.allowedValues) || rule.allowedValues.some(value => typeof value !== 'string'))) throw new Error(`Valores permitidos no válidos en ${name}.`);
    if (rule.length !== undefined && (!Number.isInteger(rule.length) || rule.length < 1)) throw new Error(`Longitud no válida en ${name}.`);
    if ([rule.min, rule.max].some(value => value !== undefined && !Number.isFinite(value))) throw new Error(`Límite no válido en ${name}.`);
    if (rule.min !== undefined && rule.max !== undefined && rule.min > rule.max) throw new Error(`El mínimo supera al máximo en ${name}.`);
  }
}

export function parseDatasetRules(text: string): DatasetRules {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('El archivo de reglas no contiene JSON válido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El archivo de reglas debe contener un objeto de columnas.');
  validateDatasetRules(value as DatasetRules, Object.keys(value));
  return value as DatasetRules;
}
