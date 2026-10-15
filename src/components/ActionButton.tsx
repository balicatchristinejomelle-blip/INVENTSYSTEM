import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createSubmissionGate } from '../uiSubmission';
import { ConfirmModal } from './Modal';

export const DraftDismissContext = createContext<(action: () => void) => void>(action => action());
export const DraftTrackingContext = createContext<((id: string, dirty: boolean) => void) | null>(null);
export function useDraftProtection(value: unknown) {
  const register = useContext(DraftTrackingContext), id = useId();
  const encoded = JSON.stringify(value), initial = useRef(encoded);
  useEffect(() => { register?.(id, encoded !== initial.current); return () => register?.(id, false); }, [register, id, encoded]);
}
export function DismissButton({ onClick, ...props }: React.ComponentProps<'button'>) {
  const request = useContext(DraftDismissContext);
  return <button type="button" {...props} onClick={event => request(() => onClick?.(event))} />;
}
export default function ActionButton({ onClick, children, disabled, confirmMessage, onStart, busyLabel = 'Working…', ...props }: React.ComponentProps<'button'> & {
  confirmMessage?: string; onStart?: () => void; busyLabel?: string;
}) {
  const gate = useRef(createSubmissionGate());
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(false), [error, setError] = useState('');
  const eventRef = useRef<React.MouseEvent<HTMLButtonElement> | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || gate.current.busy) return;
    setError(''); setBusy(true); onStart?.();
    void gate.current.run(() => onClick?.(event)).catch(() => {
      if (mounted.current) setError('The action could not be completed. Review the record and try again.');
    }).finally(() => { if (mounted.current) setBusy(false); });
  };
  return <>
    <button type="button" {...props} disabled={disabled || busy} aria-busy={busy || undefined} onClick={event => {
      if (confirmMessage) { eventRef.current = event; setConfirmation(true); } else run(event);
    }}>{busy ? busyLabel : children}</button>
    {error && <span className="action-error" role="alert">{error}</span>}
    {confirmMessage && <ConfirmModal open={confirmation} title="Confirm action" message={confirmMessage} confirmLabel="Confirm" onCancel={() => setConfirmation(false)} onConfirm={() => { setConfirmation(false); if (eventRef.current) run(eventRef.current); }} />}
  </>;
}
