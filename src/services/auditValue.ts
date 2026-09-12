/** A disposable statistical view. Never use it to serialize or deduplicate CSV. */
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
