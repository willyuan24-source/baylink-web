// What a lazy chrome control shows while its chunk loads, and if it cannot load (UI9-NAV). Shared by the overlays
// (OverlayHost) and the header's own lazy pieces (the account menu, the Aa sheet, /about's Disclosure), so a chunk that
// fails never reaches the root ErrorBoundary and replaces the page.
import { Component, type ReactNode, type RefObject } from 'react';
import { Loader2, X } from 'lucide-react';
import { ModalShell } from './ui/Modal';
import { forgetLostChunks, isChunkLoadFailure } from '../lib/chunk-recovery';
import { reportClientError } from '../lib/error-beacon';
import { translateText, useLocale } from '../i18n/locale';

/**
 * Contains a lazy piece whose chunk failed twice (offline, a stale deploy) or that crashed: it shows `fallback` (nothing
 * by default) and calls `onFail`, and the page stays. Reported like the root boundary (`chunk` for code that did not load,
 * anything else `render`). The lost chunk is forgotten here, so mounting the piece again loads it again (React.lazy alone
 * keeps the failure until the page reloads). The owner unmounts the boundary (or changes its key) to try again.
 */
export class ChunkBoundary extends Component<{ onFail?: (lostChunk: boolean) => void; fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    const lostChunk = isChunkLoadFailure(error);
    reportClientError(lostChunk ? 'chunk' : 'render', error);
    forgetLostChunks();
    this.props.onFail?.(lostChunk);
  }
  render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}

/**
 * "正在打开…" while a sheet's chunk loads (BB launcher item e): F's Sheet frame (the .ui-sheet classes of ui.css, without
 * importing the Sheet into the shell) with the arriving sheet's title, size and, for BayBay, its deep-green header, so the
 * real sheet replaces it in place. `drawer` is BayBay's panel: no desktop scrim (captain decision 7) and its 440px width.
 * The close is F's CloseButton look (ui-icon-button ui-close, named 关闭 / Close); the component itself would bring
 * Button.tsx and its card stylesheets into the shell.
 */
export function SheetChunkFallback({ title, label, onClose, restoreFocusRef, drawer, className }: { title: string; label: string; onClose: () => void; restoreFocusRef?: RefObject<HTMLElement>; drawer?: boolean; className?: string }) {
  const locale = useLocale();
  const close = locale === 'en' ? 'Close' : translateText('关闭', locale);
  return <ModalShell onClose={onClose} className={`ui-sheet-backdrop site-chunk-sheet${drawer ? ' site-chunk-sheet--drawer' : ''}${className ? ` ${className}` : ''}`} label={label} restoreFocusRef={restoreFocusRef}>
    <div className="ui-sheet">
      <div className="ui-sheet__handle" aria-hidden="true" />
      <div className="ui-sheet__header">
        <p className="ui-sheet__title">{title}</p>
        <button type="button" className="ui-icon-button ui-close" aria-label={close} title={close} onClick={onClose}><X aria-hidden="true" strokeWidth={1.75} /></button>
      </div>
      <div className="ui-sheet__body site-chunk-sheet__body"><Loader2 aria-hidden="true" className="site-chunk-spinner" strokeWidth={1.75} /><p role="status">{label}</p></div>
    </div>
  </ModalShell>;
}
