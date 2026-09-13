import React, { ReactNode, useEffect, useId, useRef } from 'react';

export interface EditorialDialogProps {
  open?: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  className?: string;
  bodyClassName?: string;
  header?: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  testId?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function EditorialDialog({
  open = true,
  title,
  description,
  children,
  actions,
  onClose,
  closeLabel = 'Cerrar',
  closeOnBackdrop = true,
  className = '',
  bodyClassName = '',
  header,
  initialFocusRef,
  testId,
}: EditorialDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
    }

    requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferred || first || dialog).focus();
    });

    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  const close = () => {
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    if (!items.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
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

  return (
    <dialog
      ref={dialogRef}
      className={`editorial-dialog ${className}`.trim()}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close();
      }}
      data-testid={testId}
    >
      {header ?? (
        <div className="editorial-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="editorial-dialog__close" onClick={close} aria-label={closeLabel}>
            {closeLabel}
          </button>
        </div>
      )}
      {header && <span className="sr-only" id={titleId}>{title}</span>}
      {description && <p className="editorial-dialog__description" id={descriptionId}>{description}</p>}
      <div className={`editorial-dialog__body ${bodyClassName}`.trim()}>{children}</div>
      {actions && <div className="editorial-dialog__actions">{actions}</div>}
    </dialog>
  );
}
