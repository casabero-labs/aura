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

  return (
    <div
      className={`file-drop ${isDragging ? 'file-drop--active' : ''} ${error ? 'file-drop--error' : ''}`}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
    >
      <div className="file-drop-main">
        <h3>{uploadCopy.title}</h3>
        <p className="file-drop-eyebrow" id={hintId}>{uploadCopy.privacy} {uploadCopy.hint}</p>
        <div className="file-drop-actions">
          <label className="btn-p btn-sm" htmlFor={inputId}>Seleccionar archivo</label>
          <span className="file-drop-status" data-testid="file-drop-status">
            {selectedName || 'Ningún archivo seleccionado'}
          </span>
        </div>
        <p className="file-drop-error" id={errorId} role={error ? 'alert' : undefined}>
          {error}
        </p>
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
