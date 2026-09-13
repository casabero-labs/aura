import React, { useCallback, useRef, useState } from 'react';
import { FileUp, ShieldCheck } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const uploadCopy = {
  title: 'Cargar CSV',
  privacy: 'El archivo se procesa en el navegador. No se envía a ningún servidor.',
};

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
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
      aria-describedby={error ? 'csv-upload-error' : 'csv-upload-help'}
    >
      <span className="file-drop-icon"><FileUp size={24} /></span>
      <div className="file-drop-main">
        <h3>{uploadCopy.title}</h3>
        <p className="file-drop-eyebrow" id="csv-upload-help">{uploadCopy.privacy}</p>
        <div className="file-drop-actions">
          <button className="btn-p btn-sm" type="button" onClick={() => inputRef.current?.click()}>
            <FileUp size={13} /> Seleccionar archivo
          </button>
          <span className="file-drop-status">
            {selectedName ? (
              <><ShieldCheck size={12} /> {selectedName}</>
            ) : (
              'Arrastra un CSV o haz clic'
            )}
          </span>
        </div>
        {error && <p className="file-drop-error" id="csv-upload-error" role="alert">{error} Puedes elegir otro archivo.</p>}
      </div>
      <input ref={inputRef} type="file" accept=".csv" className="file-drop-input" aria-label="Archivo CSV" onChange={handleChange} data-testid="csv-file-input" />
    </div>
  );
};

export default FileUpload;
