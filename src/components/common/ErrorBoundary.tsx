// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// Boundary generico con fallback a render-prop: il fallback riceve l'errore e
// una funzione `reset` per ritentare (es. ricaricare la scena 3D).

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: (error: Error, reset: () => void) => ReactNode;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    return error ? this.props.fallback(error, this.reset) : this.props.children;
  }
}
