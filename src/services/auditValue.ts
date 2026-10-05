/**
 * A disposable statistical view: "120.00", "1.2e2" and "-0" become numbers so
 * numeric statistics (min, mean, IQR…) can be computed.
 *
 * It is lossy by design ("120" and "120.00" both become 120; "001" stays text
 * only because a leading zero is not a canonical number). Never use it to
 * serialize or deduplicate CSV, and never key frequencies, distinct counts,
 * constant-column detection or sample values on it: those read the original text.
 */
export function auditValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && Math.abs(numeric) <= Number.MAX_SAFE_INTEGER) return numeric;
  }
  if (value === 'true' || value === 'TRUE') return true;
  if (value === 'false' || value === 'FALSE') return false;
  return value;
}
