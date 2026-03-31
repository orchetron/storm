/**
 * ErrorBoundary — React Error Boundary for Storm TUI components.
 * Catches render errors in child tree and shows fallback UI.
 *
 * @module
 */

import React from "react";
import { colors as staticColors } from "../theme/colors.js";

export interface ErrorBoundaryProps {
  /** Fallback UI to render when an error is caught */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React Error Boundary for Storm TUI components.
 * Catches render errors in child tree and shows fallback UI.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(this.state.error, this.reset);
      }
      if (fallback) return fallback;
      // Default fallback: show error in a box
      return React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", { color: staticColors.error, bold: true }, "Error: " + this.state.error.message),
      );
    }
    return this.props.children;
  }
}
