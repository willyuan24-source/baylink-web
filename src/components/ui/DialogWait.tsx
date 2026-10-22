// While a dialog's chunk loads (lazy-dialog.ts): the site's one scrim and a spinner on a white disc, as OverlayHost's chunk
// fallback, so a tap shows at once. The dialog that replaces it is told (`afterWait`) to keep this scrim instead of fading a
// new one in from 0 (no dip).
import { Suspense, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { ChunkBoundary } from '../ChunkBoundary';

export const DialogWait = () => createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-[color:var(--scrim)]"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg"><Loader2 aria-hidden="true" className="site-chunk-spinner" strokeWidth={1.75} /></span></div>, document.body);

/**
 * A lazy dialog (lazy-dialog.ts) in place: DialogWait until its chunk arrives, then the dialog, told (`afterWait`) that
 * DialogWait's scrim is already up; `onFail` when the chunk cannot load (`lostChunk`, as ChunkBoundary) or the dialog crashes. Read once per open (useState). The confirm card
 * and the guide lightbox share it, so the guide article's chunk carries one element, not the boundary and the wait.
 */
export function DialogSlot<P extends object>({ dialog, onFail, props }: { dialog: { current: () => { Dialog: ComponentType<P & { afterWait?: boolean }>; waits: boolean } }; onFail: (lostChunk: boolean) => void; props: P }) {
  const [{ Dialog, waits }] = useState(dialog.current);
  return <ChunkBoundary onFail={onFail}><Suspense fallback={<DialogWait />}><Dialog {...props} afterWait={waits} /></Suspense></ChunkBoundary>;
}
