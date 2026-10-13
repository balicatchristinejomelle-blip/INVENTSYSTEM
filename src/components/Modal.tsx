import React from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, children, width = '480px' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ '--modal-width': width } as React.CSSProperties}>
        {title && (
          <div className="modal-header flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>{title}</h3>
            <button className="modal-close" aria-label="Close dialog" onClick={onClose}>&#x2715;</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
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
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 400 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, marginBottom: 10 }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{message}</p>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={confirmClass} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
