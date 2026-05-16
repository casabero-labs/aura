import React, { useCallback, useRef } from 'react';
import { FileUp } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const selected = event.dataTransfer.files?.[0];
    if (selected) onFileSelect(selected);
  }, [onFileSelect]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) onFileSelect(selected);
  }, [onFileSelect]);

  return (
    <div
      className="file-drop"
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
      }}
    >
      <span className="file-drop-icon"><FileUp size={22} /></span>
      <div>
        <h3>Seleccionar CSV</h3>
        <p>Arrastra el archivo o haz clic para cargarlo. AURA procesa la fase determinista en el navegador.</p>
      </div>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} />
    </div>
  );
};

export default FileUpload;
