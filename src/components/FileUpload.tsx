import React, { useId, useRef, useState } from 'react';
import { parseDatasetRules, validateDatasetRules, type DatasetRules } from '../services/ruleChecks';
import { parseCsv } from '../services/csvService';
import DatasetRulesEditor from './DatasetRulesEditor';

interface FileUploadProps { onFileSelect: (file: File, rules?: DatasetRules) => void; busy?: boolean }
export const uploadCopy = {
  title: 'Cargar CSV',
  privacy: 'El archivo se procesa en el navegador. No se envía a ningún servidor.',
  hint: 'UTF-8 o Latin-1. Primera fila con nombres de columna.',
};

export default function FileUpload({ onFileSelect, busy = false }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId(); const rulesId = useId(); const titleId = useId();
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ fields: string[]; samples: Record<string, unknown>[] } | null>(null);
  const [rules, setRules] = useState<DatasetRules>({});
  const [rulesError, setRulesError] = useState('');
  const [rulesName, setRulesName] = useState('');
  const [rulesLoading, setRulesLoading] = useState(false);
  const readId = useRef(0); const rulesRead = useRef(0);
  const disabled = busy || reading || rulesLoading;
  const accept = async (files: FileList | File[]) => {
    if (busy || !files.length) return;
    if (files.length !== 1) { setError('Elige un solo archivo CSV para esta revisión.'); return; }
    const selected = files[0];
    if (!selected.name.toLowerCase().endsWith('.csv')) { setError('Elige un archivo .csv.'); return; }
    const current = ++readId.current;
    setReading(true); setError(''); setPreview(null); setFile(null);
    try {
      const parsed = await parseCsv(selected, 5);
      if (current !== readId.current) return;
      setFile(selected); setPreview({ fields: parsed.meta.fields, samples: parsed.data });
      setRules({}); setRulesName(''); setRulesError(''); setRulesLoading(false); rulesRead.current++;
    } catch (error) { if (current === readId.current) setError(error instanceof Error ? error.message : 'No se pudo leer el CSV. Selecciona otro archivo.'); }
    finally { if (current === readId.current) setReading(false); }
  };
  const start = () => {
    if (!file || !preview || disabled || rulesError) return;
    try { validateDatasetRules(rules, preview.fields); setError(''); onFileSelect(file, Object.keys(rules).length ? rules : undefined); }
    catch (error) { setError(error instanceof Error ? error.message : 'Revisa las condiciones elegidas.'); }
  };
  const choose = <><button type="button" className="btn-s btn-sm" disabled={busy || reading} onClick={() => inputRef.current?.click()}>{file ? 'Cambiar archivo' : 'Seleccionar archivo'}</button>
    <input ref={inputRef} id={inputId} aria-label="Archivo CSV" tabIndex={-1} type="file" accept=".csv" className="sr-only" data-testid="csv-file-input" disabled={busy || reading} onChange={event => { if (event.target.files) void accept(event.target.files); event.target.value = ''; }} /></>;
  return <div className="dataset-intake" aria-busy={disabled}>
    {!preview ? <div className={`file-drop ${dragging ? 'file-drop--active' : ''}`} role="group" aria-labelledby={titleId}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) void accept(event.dataTransfer.files); }}>
      <div className="file-drop-body"><h3 id={titleId}>{uploadCopy.title}</h3>
        <p className="file-drop-invitation">Arrastra tu archivo aquí</p>
        <p className="file-drop-hint">O selecciónalo desde tu equipo. Después podrás elegir las reglas y excepciones antes de analizarlo.</p>
        <div className="file-drop-actions">{choose}</div>
        <p className="file-drop-status" data-testid="file-drop-status" role="status">{reading ? 'Leyendo las columnas…' : 'Un archivo .csv · ' + uploadCopy.hint}</p>
      </div></div>
      : <section className="dataset-setup" aria-labelledby={titleId}>
        <div className="dataset-setup-heading"><div><h2 id={titleId}>Reglas y excepciones</h2><p className="dataset-file-name">{file?.name} · {preview.fields.length} columnas</p></div>{choose}</div>
        <p>Elige qué está permitido en tu archivo. Puedes dejar las comprobaciones generales y analizarlo directamente.</p>
        <p className="dataset-setup-note">Estas decisiones se aplican al análisis. No cambian tus datos. Permitir negativos no elimina otros avisos, como los valores extremos.</p>
        <DatasetRulesEditor fields={preview.fields} samples={preview.samples} rules={rules} onChange={next => { setRules(next); setError(''); }} />
        <details className="dataset-advanced"><summary>Opciones avanzadas: importar reglas</summary>
          <p>Si ya tienes un archivo de reglas, puedes importarlo. Reemplazará las condiciones elegidas en pantalla.</p>
          <label htmlFor={rulesId}>Archivo de reglas (.json)</label>
          <input id={rulesId} type="file" accept=".json" disabled={busy} onChange={async event => {
            const selected = event.target.files?.[0]; if (!selected) return;
            const read = ++rulesRead.current; setRulesLoading(true); setRulesError('');
            try {
              if (selected.size > 65536) throw new Error('El archivo de reglas debe pesar menos de 64 KB.');
              const parsed = parseDatasetRules(await selected.text()); validateDatasetRules(parsed, preview.fields);
              if (read === rulesRead.current) { setRules(parsed); setRulesName(selected.name); }
            } catch (error) { if (read === rulesRead.current) setRulesError(error instanceof Error ? error.message : 'No se pudieron leer las reglas.'); }
            finally { if (read === rulesRead.current) setRulesLoading(false); }
          }} />
          {rulesError && <p role="alert">{rulesError}</p>}
          <p role="status">{rulesLoading ? 'Leyendo reglas…' : rulesName ? `Reglas listas: ${rulesName}` : 'Sin archivo de reglas.'}</p>
          <button type="button" className="btn-s btn-sm" onClick={() => { rulesRead.current++; setRules({}); setRulesName(''); setRulesError(''); setRulesLoading(false); const input = document.getElementById(rulesId) as HTMLInputElement; if (input) input.value = ''; }}>Retirar reglas</button>
        </details>
        <div className="dataset-start"><p>{Object.keys(rules).length ? `Elegiste condiciones para ${Object.keys(rules).length} columnas.` : 'Se usarán las comprobaciones generales de AURA.'}</p><button type="button" className="btn-p" disabled={disabled || !!rulesError} onClick={start}>{busy ? 'Analizando…' : 'Analizar dataset'}</button></div>
      </section>}
    {error && <p className="file-drop-error" role="alert">{error}</p>}
    <p className="dataset-privacy">{uploadCopy.privacy}</p>
  </div>;
}
