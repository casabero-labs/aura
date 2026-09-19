import React, { useCallback, useId, useRef, useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
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

  const acceptFile = useCallback((selected?: File) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Selecciona un archivo .csv para iniciar el perfilamiento.');
      setSelectedName('');
      return;
    }

    setError('');
    setSelectedName(selected.name);
    onFileSelect(selected);
  }, [onFileSelect]);

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
