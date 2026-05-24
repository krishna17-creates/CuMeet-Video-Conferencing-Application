/**
 * Error Boundary
 * Catches React errors and displays fallback UI
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
              backgroundColor: '#2a2a2a',
              padding: '30px',
              borderRadius: '8px',
              border: '1px solid #e63946',
            }}
          >
            <h1 style={{ color: '#e63946', marginBottom: '20px' }}>
              Oops! Something went wrong
            </h1>

            <p style={{ marginBottom: '20px', color: '#ccc' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>

            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details
                style={{
                  marginTop: '20px',
                  padding: '10px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  textAlign: 'left',
                  color: '#aaa',
                  fontSize: '12px',
                }}
              >
                <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.href = '/'}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
