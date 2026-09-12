import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DestructiveSessionDialog({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const modal = dialog.current!;
    const focusable = () => [...modal.querySelectorAll<HTMLElement>('button:not([disabled])')];
    modal.showModal();
    cancel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener('keydown', onKeyDown);
    return () => {
      modal.removeEventListener('keydown', onKeyDown);
      modal.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className="modal-container modal-container--sm session-dialog"
      aria-labelledby="destroy-title" aria-describedby="destroy-description"
      onCancel={event => { event.preventDefault(); onCancel(); }} data-testid="destroy-session-dialog">
      <div className="modal-header">
        <AlertTriangle size={20} aria-hidden="true" />
        <h3 id="destroy-title">Cerrar sesión y destruir datos</h3>
        <button className="modal-close" aria-label="Cerrar" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="modal-body" id="destroy-description">
        <p>Se eliminarán el análisis actual, diagnósticos, scripts, decisiones humanas y archivos preparados.</p>
        <p>La configuración del proveedor y los modelos se conservarán.</p>
        <p>Esta acción no se puede deshacer.</p>
      </div>
      <div className="modal-actions">
        <button ref={cancel} className="btn-s" onClick={onCancel}>Cancelar</button>
        <button className="btn-p btn-p--destructive" onClick={onConfirm} data-testid="destroy-session-confirm">
          <Trash2 size={14} /> Destruir datos locales
        </button>
      </div>
    </dialog>
  );
}
