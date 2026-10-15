/** UI-only lock: the existing transaction callback remains the sole business action. */
export function createSubmissionGate() {
  let busy = false;
  return {
    get busy() { return busy; },
    async run(action: () => unknown, settle: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 600))) {
      if (busy) return false;
      busy = true;
      try { await action(); await settle(); return true; }
      finally { busy = false; }
    },
  };
}
export const hasUnsavedChanges = (current: unknown, original: string | undefined, dirty = false, childDirty = false) =>
  dirty || childDirty || (current !== undefined && JSON.stringify(current) !== original);
