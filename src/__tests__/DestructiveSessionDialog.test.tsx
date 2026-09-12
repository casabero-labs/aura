// @vitest-environment jsdom

import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DestructiveSessionDialog from '../components/DestructiveSessionDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

describe('UX-03 destructive session dialog', () => {
  it('opens as a modal, names Cerrar, and focuses Cancelar', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Cerrar sesión y destruir datos locales';
    document.body.appendChild(opener);
    opener.focus();

    render(<DestructiveSessionDialog onCancel={vi.fn()} onConfirm={vi.fn()} />);

    const dialog = screen.getByTestId('destroy-session-dialog');
    expect(dialog.getAttribute('open')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('cancels from Escape and returns focus to the opener', () => {
    const onCancel = vi.fn();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<DestructiveSessionDialog onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent(screen.getByTestId('destroy-session-dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside the dialog', () => {
    render(<DestructiveSessionDialog onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByTestId('destroy-session-dialog');
    const destroy = screen.getByTestId('destroy-session-confirm');
    destroy.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });
});
