import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="w-full max-w-2xl mx-auto border-2 border-dashed border-[var(--border-color)] rounded-sm bg-[var(--bg-color)] hover:bg-[var(--technical-bg)] hover:border-[var(--main-color)] transition-all cursor-pointer p-16 flex flex-col items-center justify-center gap-8 group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--main-color)]" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[var(--main-color)]" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[var(--main-color)]" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--main-color)]" />

      <div className="p-6 bg-[var(--technical-bg)] border border-[var(--border-color)] rounded-none group-hover:border-[var(--main-color)] transition-all">
        <UploadCloud size={32} className="text-[var(--secondary-color)] group-hover:text-[var(--main-color)]" />
      </div>
      <div className="text-center space-y-3">
        <h3 className="text-3xl font-display font-bold text-[var(--main-color)] tracking-tight uppercase">Cargar_Dataset</h3>
        <p className="text-[10px] text-[var(--secondary-color)] font-mono uppercase tracking-[0.4em] font-medium">Arrastre un CSV o haga clic para buscar ./archivos</p>
      </div>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        id="fileInput"
        onChange={handleChange}
      />
      <label
        htmlFor="fileInput"
        className="absolute inset-0 cursor-pointer"
      />
    </div>
  );
};

export default FileUpload;