// The boundary around a lazy piece of the chrome (UI9-NAV): the overlays (OverlayHost) and the header's own lazy pieces
// (the account menu, the Aa sheet, /about's Disclosure), so a chunk that fails never reaches the root ErrorBoundary and
// replaces the page.
import { Component, type ReactNode } from 'react';
import { forgetLostChunks, isChunkLoadFailure } from '../lib/chunk-recovery';
import { reportClientError } from '../lib/error-beacon';

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
