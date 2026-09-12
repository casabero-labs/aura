const numberFormatter = new Intl.NumberFormat('es-CO');

const NUMERIC_SENTINELS = new Set(['999', '99', '-999', '9999', '000', '-1']);

export function isNumericSentinel(value: unknown): boolean {
  return NUMERIC_SENTINELS.has(String(value ?? '').trim());
}

export function formatAffectedShare(count: number, total: number): string {
  const safeCount = Number.isFinite(count) && count > 0 ? count : 0;
  const countLabel = numberFormatter.format(safeCount);
  if (!Number.isFinite(total) || total <= 0) {
    return `${countLabel} registro${safeCount === 1 ? '' : 's'}`;
  }
  const totalLabel = numberFormatter.format(total);
  const pct = (safeCount / total) * 100;
  let pctLabel = '0%';
  if (safeCount > 0 && pct < 0.1) pctLabel = '<0,1%';
  else if (safeCount > 0 && pct < 1) pctLabel = `${pct.toFixed(2).replace('.', ',')}%`;
  else if (safeCount > 0) pctLabel = `${pct.toFixed(1).replace('.', ',')}%`;
  return `${countLabel} de ${totalLabel} (${pctLabel})`;
}

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  upload: 'Carga',
  profile: 'Perfil base',
  diagnosis: 'Diagnóstico',
  diagnostic_report: 'Informe diagnóstico',
  script: 'Propuesta',
  review: 'Revisión',
  execution: 'Ejecución',
  export: 'Exportación',
};

export function formatPipelineStage(state: string | undefined): string {
  if (!state) return 'sesión guardada';
  return PIPELINE_STAGE_LABELS[state] ?? state;
}
