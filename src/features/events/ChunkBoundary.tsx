import { Component, type ReactNode } from 'react';
import { ErrorState } from '../../components/ui';
import { MoreLink } from '../../components/ui/TextLink';
import { useUiCopy } from '../../components/ui/ui-copy';

/**
 * The board's (or the rest of the catalog's, events-later.ts) failed-load state, inline in the list area: offline or not,
 * 重试, and 回到本周末 (UI9-EVENTS §7; the shared ErrorState's own link says 回到首页, so it is left out here).
 */
export function ChunkError({ onRetry }: { onRetry: () => void }) {
  const { t } = useUiCopy();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return <div className="ev-chunk-error">
    <ErrorState headingLevel="h2" onRetry={onRetry} homeTo={null}
      title={offline ? t('现在没有网络', 'You’re offline') : t('这一栏暂时没能加载', 'This view didn’t load')}
      body={offline ? t('连上网络后点「重试」。本周末的活动仍在「本周末」里。', 'Reconnect, then tap Try again. This weekend’s events are still under Weekend.')
        : t('可能是网络不稳。稍后再试一次，或先看本周末的活动。', 'The connection may be unstable. Try again in a moment, or see this weekend’s events.')} />
    <MoreLink to="/events" className="ev-chunk-error__back">{t('回到本周末', 'Back to this weekend')}</MoreLink>
  </div>;
}

/**
 * Catches a failed lazy load of a board (offline, a stale deploy) and offers a retry (RC-25: the error and offline states
 * use the WEB-UI ErrorState). The children get the attempt number for `retryableLazy`.
 */
export class ChunkBoundary extends Component<{ children: (attempt: number) => ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <ChunkError onRetry={() => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }))} />;
    return this.props.children(this.state.attempt);
  }
}
