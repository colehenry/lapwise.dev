"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  suppressPrefetchErrors?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Suppress prefetch errors in development
    if (this.props.suppressPrefetchErrors) {
      const isPrefetchError =
        error.message.includes("Failed to fetch") ||
        error.message.includes("fetch");

      if (isPrefetchError) {
        // Silently suppress prefetch errors
        console.debug("Suppressed prefetch error:", error.message);
        return;
      }
    }

    // Log other errors
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // If we're suppressing prefetch errors and this is one, render children anyway
      if (
        this.props.suppressPrefetchErrors &&
        this.state.error?.message.includes("fetch")
      ) {
        return this.props.children;
      }

      // Otherwise show fallback
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-8">
            <div className="bg-bg-tertiary rounded-lg border border-border-primary p-8 max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-400 mb-4">
                An error occurred while loading this page.
              </p>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
