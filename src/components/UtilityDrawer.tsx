import { useEffect, useRef, type ReactNode } from 'react';

export default function UtilityDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [...(panel.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

    requestAnimationFrame(() => focusable()[0]?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
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

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);

  return (
    <>
      <div className="utility-backdrop" onClick={onClose} data-testid="utility-backdrop" />
      <aside
        ref={panel}
        className="utility-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="utility-drawer"
      >
        {children}
      </aside>
    </>
  );
}
