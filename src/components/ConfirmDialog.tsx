'use client';

import { useEffect, useRef } from 'react';

/**
 * Modal confirmation built on the native <dialog> element, which provides the
 * backdrop, focus trapping and Escape-to-close.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Escape key / programmatic close — keep the parent's state in sync.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // Clicking the backdrop (outside the panel) cancels.
      onClick={(e) => {
        if (e.target === ref.current && !busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-surface p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="p-5 space-y-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <div className="text-sm text-muted">{message}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          autoFocus
          className={`rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
            destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-hover'
          }`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
