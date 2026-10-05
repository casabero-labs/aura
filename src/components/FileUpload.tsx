import React, { useCallback, useId, useRef, useState } from 'react';
import { parseDatasetRules, type DatasetRules } from '../services/ruleChecks';

interface FileUploadProps {
  onFileSelect: (file: File, rules?: DatasetRules) => void;
}

export const uploadCopy = {
  title: 'Cargar CSV',
  privacy: 'El archivo se procesa en el navegador. No se envía a ningún servidor.',
  hint: 'UTF-8 o Latin-1. Primera fila con nombres de columna. Arrastra o elige un .csv.',
};

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [error, setError] = useState('');
  const rulesId = useId();
  const [rules, setRules] = useState<DatasetRules | undefined>();
  const [rulesError, setRulesError] = useState('');
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesName, setRulesName] = useState('');
  const rulesRead = useRef(0);

  const acceptFile = useCallback((selected?: File) => {
    if (!selected) return;
    if (rulesLoading || rulesError) {
      setError(rulesLoading ? 'Espera a que termine la lectura de las reglas.' : 'Corrige o retira el archivo de reglas antes de cargar el CSV.');
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Selecciona un archivo .csv para iniciar el perfilamiento.');
      setSelectedName('');
      return;
    }

    setError('');
    setSelectedName(selected.name);
    onFileSelect(selected, rules);
  }, [onFileSelect, rules, rulesError, rulesLoading]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }, [acceptFile]);

  const titleId = useId();
  const statusText = selectedName ? `Archivo listo: ${selectedName}` : 'Sin archivo en la bandeja.';

  return (
    <div
      className={`file-drop ${isDragging ? 'file-drop--active' : ''} ${error ? 'file-drop--error' : ''}`}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={`${hintId} ${errorId}`}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
    >
      <div className="file-drop-layout">
        <div className="file-drop-index" aria-hidden="true">
          <span>Entrada</span>
          <strong className="file-drop-count">{selectedName ? '01' : '00'}</strong>
        </div>
        <div className="file-drop-body">
          <p className="file-drop-kicker">Registro de archivos</p>
          <h3 id={titleId}>{uploadCopy.title}</h3>
          <p className="file-drop-eyebrow" id={hintId}>{uploadCopy.privacy} {uploadCopy.hint}</p>
          <details>
            <summary>Reglas propias del archivo (opcional)</summary>
            <p>Antes de cargar el CSV, puedes elegir un archivo de reglas para indicar valores permitidos, claves únicas y límites. Sin estas reglas, AURA aplica solo sus comprobaciones generales.</p>
            <label htmlFor={rulesId}>Archivo de reglas (.json)</label>
            <input id={rulesId} type="file" accept=".json" onChange={async event => {
              const selected = event.target.files?.[0];
              const read = ++rulesRead.current;
              setRules(undefined); setRulesError(''); setRulesName('');
              if (!selected) { setRulesLoading(false); return; }
              setRulesLoading(true);
              try {
                if (selected.size > 65536) throw new Error('El archivo de reglas debe pesar menos de 64 KB.');
                const parsed = parseDatasetRules(await selected.text());
                if (read === rulesRead.current) { setRules(parsed); setRulesName(selected.name); }
              } catch (error) {
                if (read === rulesRead.current) setRulesError(error instanceof Error ? error.message : 'No se pudieron leer las reglas.');
              } finally { if (read === rulesRead.current) setRulesLoading(false); }
            }} />
            {rulesError && <p role="alert">{rulesError}</p>}
            <p role="status">{rulesLoading ? 'Leyendo reglas…' : rulesName ? `Reglas listas: ${rulesName}` : 'Sin reglas propias.'}</p>
            <button type="button" className="btn-s btn-sm" onClick={() => {
              rulesRead.current++; setRules(undefined); setRulesError(''); setRulesName(''); setRulesLoading(false); setError('');
              const input = document.getElementById(rulesId) as HTMLInputElement | null;
              if (input) input.value = '';
            }}>Retirar reglas</button>
          </details>
          <div className="file-drop-actions">
            <label className="btn-p btn-sm" htmlFor={inputId}>Seleccionar archivo</label>
          </div>
          <p className="file-drop-error" id={errorId} role={error ? 'alert' : undefined}>
            {error}
          </p>
          <p className="file-drop-status" data-testid="file-drop-status" role="status" aria-live="polite">
            {statusText}
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv"
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${hintId} ${errorId}`}
        onChange={(event) => acceptFile(event.target.files?.[0])}
        data-testid="csv-file-input"
      />
    </div>
  );
};

export default FileUpload;
