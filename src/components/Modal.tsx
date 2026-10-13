import React, { useEffect, useRef } from "react"

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, children, width = '480px' }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose()
    }

    document.addEventListener("keydown", handleKey)

    window.setTimeout(() => boxRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus(), 0);

    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="modal-box" role="dialog" aria-modal="true" aria-label={title || 'Dialog'} style={{ '--modal-width': width } as React.CSSProperties}>
        {title && (
          <div className="modal-header flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
              {title}
            </h3>
            <button className="modal-close" aria-label="Close dialog" onClick={onClose}>&#x2715;</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmClass = 'btn-primary', onConfirm, onCancel }: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-box" role="alertdialog" aria-modal="true" aria-label={title} style={{ width: 400 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
          {title}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          {message}
        </p>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
