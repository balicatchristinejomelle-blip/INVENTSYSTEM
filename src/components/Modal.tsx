import React, { useEffect, useRef, useState } from "react"
import ActionButton, { DraftDismissContext, DraftTrackingContext } from './ActionButton';
import { hasUnsavedChanges } from '../uiSubmission';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  draft?: unknown;
  dirty?: boolean;
  dialogRole?: 'dialog' | 'alertdialog';
}

export default function Modal({ open, onClose, title, children, width = '480px', draft, dirty = false, dialogRole = 'dialog' }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const originalDraft = useRef<string | undefined>(undefined);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const currentDirty = useRef(dirty);
  currentDirty.current = dirty;
  const childDrafts = useRef(new Map<string, boolean>());
  const unsaved = () => hasUnsavedChanges(currentDraft.current, originalDraft.current, currentDirty.current, [...childDrafts.current.values()].some(Boolean));
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const requestDismiss = (action: () => void) => {
    if (unsaved()) setDiscard(() => action);
    else action();
  };
  const dismissRef = useRef(requestDismiss);
  dismissRef.current = requestDismiss;

  useEffect(() => {
    if (!open) return
    originalDraft.current = JSON.stringify(currentDraft.current);
    setDiscard(null);

    const previous = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== boxRef.current) return;
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault(); event.stopImmediatePropagation(); dismissRef.current(() => closeRef.current());
      }
      if (event.key === 'Tab') {
        const focusable = [...(boxRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"], summary') || [])].filter(element => element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first) { event.preventDefault(); boxRef.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !boxRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !boxRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener("keydown", handleKey)

    window.setTimeout(() => boxRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus(), 0);

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { document.removeEventListener('keydown', handleKey); window.removeEventListener('beforeunload', beforeUnload); if (previous?.isConnected) previous.focus(); };
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) requestDismiss(onClose); }}>
      <div ref={boxRef} className="modal-box" role={dialogRole} tabIndex={-1} aria-modal="true" aria-label={title || 'Dialog'} style={{ '--modal-width': width } as React.CSSProperties}>
        {title && (
          <div className="modal-header flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
              {title}
            </h3>
            <button className="modal-close" aria-label="Close dialog" onClick={() => requestDismiss(onClose)}>&#x2715;</button>
          </div>
        )}
        <DraftTrackingContext.Provider value={(id, changed) => { if (changed) childDrafts.current.set(id, true); else childDrafts.current.delete(id); }}><DraftDismissContext.Provider value={requestDismiss}>{children}</DraftDismissContext.Provider></DraftTrackingContext.Provider>
        <ConfirmModal open={!!discard} title="Unsaved changes" message="Your changes have not been saved. Keep editing or leave this form without saving." confirmLabel="Leave without saving" cancelLabel="Keep editing" confirmClass="btn-danger" onCancel={() => setDiscard(null)} onConfirm={() => { const action = discard; setDiscard(null); action?.(); }} />
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
  if (!open) return null

  return (
    <Modal open={open} onClose={onCancel} title={title} width="400px" dialogRole="alertdialog">
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          {message}
        </p>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <ActionButton className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </ActionButton>
        </div>
    </Modal>
  )
}
