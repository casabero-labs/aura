import React from 'react';
import type { ColumnRule, DatasetRules } from '../services/ruleChecks';

export function describeRule(rule: ColumnRule): string[] {
  const descriptions: string[] = [];
  if (rule.type) descriptions.push(`Tipo: ${{ identifier: 'identificador (texto)', string: 'texto', number: 'número', date: 'fecha' }[rule.type]}`);
  if (rule.required !== undefined) descriptions.push(rule.required ? 'Debe tener un valor' : 'Se permiten vacíos');
  if (rule.unique !== undefined) descriptions.push(rule.unique ? 'No se permiten repetidos' : 'Se permiten repetidos');
  if (rule.allowNegative !== undefined) descriptions.push(rule.allowNegative ? 'Se permiten negativos' : 'No se permiten negativos');
  if (rule.allowedValues) descriptions.push(`Valores permitidos: ${rule.allowedValues.join(' · ')}`);
  if (rule.min !== undefined) descriptions.push(`Mínimo: ${rule.min}`);
  if (rule.max !== undefined) descriptions.push(`Máximo: ${rule.max}`);
  if (rule.integer) descriptions.push('Solo números enteros');
  if (rule.length !== undefined) descriptions.push(`Longitud: ${rule.length} caracteres`);
  if (rule.dateFormat) descriptions.push(`Formato: ${{ ISO: 'año-mes-día', DMY: 'día/mes/año', MDY: 'mes/día/año' }[rule.dateFormat]}`);
  return descriptions;
}

export const AppliedDatasetRules: React.FC<{ rules?: DatasetRules }> = ({ rules }) => {
  const entries = Object.entries(rules ?? {}).filter(([, rule]) => describeRule(rule).length);
  return <section className="dataset-rules-summary" aria-label="Reglas y excepciones aplicadas">
    <h3>Reglas y excepciones aplicadas</h3>
    {entries.length ? <ul>{entries.map(([name, rule]) => <li key={name}><strong>{name}</strong>: {describeRule(rule).join('; ')}.</li>)}</ul>
      : <p>Se usaron las comprobaciones generales de AURA, sin condiciones propias.</p>}
  </section>;
};

export default function DatasetRulesEditor({ fields, samples, rules, onChange }: {
  fields: string[]; samples: Record<string, unknown>[]; rules: DatasetRules; onChange: (rules: DatasetRules) => void;
}) {
  const update = (name: string, key: keyof ColumnRule, value: unknown) => {
    const next = { ...rules, [name]: { ...rules[name] } };
    if (value === undefined) delete next[name][key];
    else Object.assign(next[name], { [key]: value });
    if (!Object.keys(next[name]).length) delete next[name];
    onChange(next);
  };
  return <div className="dataset-rule-columns">{fields.map((name, index) => {
    const rule = rules[name] ?? {};
    const prefix = `column-rule-${index}`;
    const example = samples.slice(0, 3).map(row => row[name] === '' || row[name] == null ? '(vacío)' : String(row[name])).join(' · ');
    const selectFlag = (key: 'required' | 'unique' | 'allowNegative', label: string, yes: string, no: string) => <label htmlFor={`${prefix}-${key}`}>{label}
      <select id={`${prefix}-${key}`} value={rule[key] === undefined ? '' : String(rule[key])} onChange={event => update(name, key, event.target.value === '' ? undefined : event.target.value === 'true')}>
        <option value="">Comprobación general</option><option value="true">{yes}</option><option value="false">{no}</option>
      </select></label>;
    return <details key={name} className="dataset-rule-column">
      <summary><span>{name}</span><span className="dataset-rule-column-note">{describeRule(rule).length ? `${describeRule(rule).length} condiciones elegidas` : 'Comprobación general'}</span></summary>
      <p className="dataset-rule-examples">Ejemplos: {example}</p>
      <div className="dataset-rule-fields">
        <label htmlFor={`${prefix}-type`}>¿Qué contiene esta columna?
          <select id={`${prefix}-type`} value={rule.type ?? ''} onChange={event => update(name, 'type', event.target.value || undefined)}>
            <option value="">Detectar automáticamente</option><option value="identifier">Identificadores (conservar como texto)</option><option value="string">Texto</option><option value="number">Números</option><option value="date">Fechas</option>
          </select></label>
        {selectFlag('required', 'Celdas vacías', 'No permitir vacíos', 'Permitir vacíos')}
        {selectFlag('unique', 'Valores repetidos', 'No permitir repetidos', 'Permitir repetidos')}
        {selectFlag('allowNegative', 'Números negativos', 'Permitir negativos', 'No permitir negativos')}
        <label htmlFor={`${prefix}-values`}>Valores permitidos (uno por línea)
          <textarea id={`${prefix}-values`} rows={3} value={rule.allowedValues?.join('\n') ?? ''} onChange={event => update(name, 'allowedValues', event.target.value === '' ? undefined : event.target.value.split('\n'))} />
          <span>Escribe las formas válidas tal como deben aparecer. Las mayúsculas y los acentos cuentan.</span>
        </label>
        <label htmlFor={`${prefix}-date`}>Formato de fecha
          <select id={`${prefix}-date`} value={rule.dateFormat ?? ''} onChange={event => update(name, 'dateFormat', event.target.value || undefined)}><option value="">Detectar automáticamente</option><option value="ISO">Año-mes-día · 2024-03-15</option><option value="DMY">Día/mes/año · 15/03/2024</option><option value="MDY">Mes/día/año · 03/15/2024</option></select>
        </label>
        {(['min', 'max', 'length'] as const).map(key => <label key={key} htmlFor={`${prefix}-${key}`}>{ { min: 'Número mínimo', max: 'Número máximo', length: 'Cantidad exacta de caracteres' }[key] }
          <input id={`${prefix}-${key}`} type="number" step={key === 'length' ? '1' : 'any'} min={key === 'length' ? 1 : undefined} value={rule[key] ?? ''} onChange={event => update(name, key, event.target.value === '' ? undefined : Number(event.target.value))} />
        </label>)}
        <label className="dataset-rule-checkbox"><input type="checkbox" checked={rule.integer === true} onChange={event => update(name, 'integer', event.target.checked ? true : undefined)} />Solo permitir números enteros</label>
      </div>
      <button type="button" className="btn-s btn-sm" onClick={() => { const next = { ...rules }; delete next[name]; onChange(next); }}>Restablecer esta columna</button>
    </details>;
  })}</div>;
}
