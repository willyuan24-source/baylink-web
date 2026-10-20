import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { getLocale, translateText } from '../i18n/locale';
import { reportClientError } from '../lib/error-beacon';
import { FEEDBACK_EMAIL } from '../features/feedback/contact';

type Props = { children: ReactNode };
type State = { hasError: boolean };

const copy = (zh: string, en: string) => getLocale() === 'en' ? en : translateText(zh);
// Inline on purpose: the page must look right even when a stylesheet chunk is what failed. Tokens only (src/tokens.css).
const page: CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem 1.5rem', background: 'var(--color-bg)', color: 'var(--color-ink)', textAlign: 'center', fontFamily: 'var(--font-sans)' };
// The sheet loads on demand like everywhere else; if it cannot (offline, a stranded deploy), the reader gets the email.
const tellUs = () => void import('../features/feedback/open-feedback')
  .then(feedback => feedback.openFeedback({ kind: 'page', reason: 'other' }), () => false)
  .then(opened => { if (!opened) window.location.href = `mailto:${FEEDBACK_EMAIL}`; });
// One 48px look (回到首页); 重试 fills it with the brand, 反馈 is its quiet text form.
const button: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: '3rem', padding: '0 1.75rem', border: '1px solid var(--color-line-strong)', borderRadius: '.875rem', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' };

/**
 * 根级错误边界：任何渲染异常兜底为可恢复的页面，而不是整站白屏。Reports an anonymous beacon (kind render, or chunk when a
 * stale deploy's code failed to load). The chunk-error state of the content arrangement, in the reader's language: the
 * heading 这一页没打开, then 重试 (the primary; it reloads) · 回到首页 (a plain link, outside the router this boundary sits
 * above; the JSX host gives it the reader's language, i18n/host.ts) · 反馈.
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
        <h1 style={{ fontSize: '1.375rem', lineHeight: 1.4, fontWeight: 600, margin: 0 }}>{copy('这一页没打开', 'This page did not open')}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" onClick={() => window.location.reload()} style={{ ...button, borderColor: 'var(--color-brand)', background: 'var(--color-brand)', color: 'var(--color-surface)' }}>
            {copy('重试', 'Try again')}
          </button>
          <a href="/" style={button}>
            {copy('回到首页', 'Back to home')}
          </a>
          <button type="button" onClick={tellUs} style={{ ...button, borderColor: 'transparent', background: 'transparent', color: 'var(--color-brand-deep)', textDecoration: 'underline' }}>
            {copy('反馈', 'Feedback')}
          </button>
        </div>
      </div>
    );
  }
}
