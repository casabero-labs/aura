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
        <div className="aura-system error-boundary-surface" data-casabero-theme="editorial">
          <div className="error-boundary-content">
            <p className="error-boundary-eyebrow">
              AURA · error
            </p>
            <h1 className="error-boundary-title">
              Algo salió mal.
            </h1>
            <p className="error-boundary-copy">
              Reinicia la página o vuelve a intentarlo.
            </p>
            <button
              className="btn-p"
              onClick={this.handleRetry}
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
