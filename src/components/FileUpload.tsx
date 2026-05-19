import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, FileUp, ShieldCheck } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const uploadCopy = {
  title: 'Cargar CSV local',
  privacy: 'El archivo se lee en el navegador antes de cualquier diagnostico.',
  nextStep: 'El siguiente paso genera un perfil determinista del dataset.',
  constraints: ['CSV tabular', 'Preview hasta 5.000 filas', 'Sin envio del archivo crudo', 'Reglas reproducibles'],
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
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
      }}
    >
      <span className="file-drop-icon"><FileUp size={22} /></span>
      <div className="file-drop-main">
        <p className="file-drop-eyebrow">entrada local-first</p>
        <h3>{uploadCopy.title}</h3>
        <p>{uploadCopy.privacy} {uploadCopy.nextStep}</p>
        <div className="file-drop-checks">
          {uploadCopy.constraints.map((item) => (
            <span key={item}><CheckCircle2 size={12} /> {item}</span>
          ))}
        </div>
        <div className="file-drop-actions">
          <button className="btn-p btn-sm" type="button">
            <FileSpreadsheet size={13} /> Seleccionar archivo
          </button>
          <span className="file-drop-status">
            {selectedName ? (
              <><ShieldCheck size={12} /> {selectedName}</>
            ) : (
              'Arrastra un CSV o haz clic'
            )}
          </span>
        </div>
        {error && <p className="file-drop-error">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} />
    </div>
  );
};

export default FileUpload;
