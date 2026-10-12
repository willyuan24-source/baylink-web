import { useEffect, useState } from 'react';

/**
 * For a dialog that stays mounted after its first open (BayBay: the conversation survives closing the panel). After a
 * failed load or a crash it is unmounted (`failed`) until the reader opens it again; then a fresh boundary (a new `key`)
 * tries once more. Without this, the failed boundary stayed mounted and 问 BayBay did nothing until the page reloaded.
 */
export function useReopenAfterFailure(open: boolean): { key: string; failed: boolean; fail: () => void } {
  const [state, setState] = useState({ attempt: 0, failed: false });
  useEffect(() => { if (open) setState(current => current.failed ? { ...current, failed: false } : current); }, [open]);
  return { key: `attempt-${state.attempt}`, failed: state.failed, fail: () => setState(current => ({ attempt: current.attempt + 1, failed: true })) };
}
