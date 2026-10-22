// While a dialog's chunk loads (lazy-dialog.ts): the site's one scrim and a spinner on a white disc, as OverlayHost's chunk
// fallback, so a tap shows at once. The dialog that replaces it is told (`afterWait`) to keep this scrim instead of fading a
// new one in from 0 (no dip).
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

export const DialogWait = () => createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-[color:var(--scrim)]"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg"><Loader2 aria-hidden="true" className="site-chunk-spinner" strokeWidth={1.75} /></span></div>, document.body);
