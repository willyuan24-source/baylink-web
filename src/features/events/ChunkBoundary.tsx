import { Component, type ReactNode } from 'react';
import { ErrorState } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';

function ChunkError({ onRetry }: { onRetry: () => void }) {
  const { t } = useUiCopy();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return <ErrorState headingLevel="h2" onRetry={onRetry} homeTo="/events"
    title={offline ? t('现在没有网络', 'You’re offline') : t('这一栏暂时没能加载', 'This view didn’t load')}
    body={offline ? t('连上网络后点「重试」。本周末的活动仍在「本周末」里。', 'Reconnect, then tap Try again. This weekend’s events are still under Weekend.')
      : t('可能是网络不稳。稍后再试一次，或先看本周末的活动。', 'The connection may be unstable. Try again in a moment, or see this weekend’s events.')} />;
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
