import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AURA ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="aura-system" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2.5rem',
          background: 'var(--bg)',
          color: 'var(--ink)',
        }}>
          <div style={{
            maxWidth: 480,
            textAlign: 'center',
          }}>
            <p style={{
              color: 'var(--ink3)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 1rem',
            }}>
              AURA · error
            </p>
            <h1 style={{
              fontFamily: 'var(--serif)',
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: '0 0 1rem',
              color: 'var(--ink)',
            }}>
              Algo salió mal.
            </h1>
            <p style={{
              fontFamily: 'var(--serif)',
              fontSize: 15,
              lineHeight: 1.8,
              color: 'var(--ink2)',
              margin: '0 0 2rem',
            }}>
              Reinicia la página o vuelve a intentarlo.
            </p>
            <button
              className="btn-p"
              onClick={this.handleRetry}
              style={{ minHeight: 38, padding: '0 24px' }}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
