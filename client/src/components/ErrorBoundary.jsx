// ErrorBoundary.jsx — Catches React render errors and shows a friendly screen
// instead of a blank white page.
//
// Must be a class component — React's error boundary API only works with classes.

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log to console — replace with a proper error service (e.g. Sentry) later
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 48 }}>🃏</div>
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ color: 'var(--text2)', textAlign: 'center', margin: 0 }}>
          The app hit an unexpected error. Tap below to reload and rejoin your game.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
        {import.meta.env.DEV && (
          <pre style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 340 }}>
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
