import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * 根级错误边界：任何渲染异常兜底为可恢复的品牌化页面，而不是整站白屏。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px 24px',
        backgroundColor: '#F7F4EC',
        color: '#17202A',
        textAlign: 'center',
        fontFamily: "'Plus Jakarta Sans', 'Noto Sans SC', sans-serif",
      }}>
        <div style={{ fontSize: '40px' }}>🦦</div>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>页面出了点小问题</h1>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: 0, maxWidth: '320px', lineHeight: 1.6 }}>
          刷新一下通常就能恢复。如果反复出现，欢迎联系我们反馈。
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            padding: '10px 28px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: '#16A66A',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          刷新页面
        </button>
      </div>
    );
  }
}
