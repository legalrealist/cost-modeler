import { Component, type ReactNode } from 'react';
import { CostModelerPage } from '@/pages/CostModelerPage';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The calculator hit an unexpected error. Try reloading the page or resetting your inputs.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  window.location.href = window.location.pathname;
                }}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Reset & reload
              </button>
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 text-sm border rounded-md hover:bg-secondary"
              >
                Try again
              </button>
            </div>
            <details className="text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">Error details</summary>
              <pre className="mt-2 text-xs bg-secondary p-3 rounded-md overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <CostModelerPage />
    </ErrorBoundary>
  );
}
