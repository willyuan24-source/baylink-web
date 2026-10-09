import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { getLocale, translateText } from '../i18n/locale';
import { reportClientError } from '../lib/client-errors';
import { FEEDBACK_EMAIL, openFeedback } from '../features/feedback/open-feedback';

type Props = { children: ReactNode };
type State = { hasError: boolean };

const copy = (zh: string, en: string) => getLocale() === 'en' ? en : translateText(zh);
// Inline on purpose: the page must look right even when a stylesheet chunk is what failed. Tokens only (src/tokens.css).
const page: CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem 1.5rem', background: 'var(--color-bg)', color: 'var(--color-ink)', textAlign: 'center', fontFamily: 'var(--font-sans)' };
const button: CSSProperties = { minHeight: '3rem', padding: '.625rem 1.75rem', borderRadius: '.875rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' };

/**
 * 根级错误边界：任何渲染异常兜底为可恢复的页面，而不是整站白屏。Reports an anonymous beacon (kind render, or chunk when a
 * stale deploy's code failed to load) and offers 反馈 in the reader's language.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    reportClientError('render', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={page}>
        <div aria-hidden="true" style={{ fontSize: '2.5rem' }}>🦦</div>
        <h1 style={{ fontSize: '1.375rem', lineHeight: 1.4, fontWeight: 600, margin: 0 }}>{copy('页面出了点小问题', 'Something went wrong on this page')}</h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-ink-2)', margin: 0, maxWidth: '22rem', lineHeight: 1.7 }}>
          {copy('刷新一下通常就能恢复。如果反复出现，请告诉我们你刚才在做什么。', 'Reloading usually fixes it. If it keeps happening, please tell us what you were doing.')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', justifyContent: 'center' }}>
          <button type="button" onClick={() => window.location.reload()} style={{ ...button, border: '1px solid var(--color-brand)', background: 'var(--color-brand)', color: 'var(--color-surface)' }}>
            {copy('刷新页面', 'Reload the page')}
          </button>
          <button type="button" onClick={() => void openFeedback({ kind: 'page', reason: 'other' }).then(opened => { if (!opened) window.location.href = `mailto:${FEEDBACK_EMAIL}`; })}
            style={{ ...button, border: '1px solid var(--color-line-strong)', background: 'var(--color-surface)', color: 'var(--color-ink)' }}>
            {copy('告诉我们', 'Tell us')}
          </button>
        </div>
      </div>
    );
  }
}
