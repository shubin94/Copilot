import React, { ReactNode, Component, ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // If true, only catches errors in this subtree
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Global Error Boundary Component
 * 
 * Catches synchronous errors and React lifecycle errors
 * Provides recovery options and detailed error reporting
 * 
 * Usage:
 * <ErrorBoundary onError={reportToSentry}>
 *   <YourApp />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Update state
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call optional error reporting handler (e.g., Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to monitoring service
    if (typeof window !== 'undefined' && (window as any).__reportError) {
      (window as any).__reportError({
        type: 'error_boundary',
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  handleNavigateHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, isolate } = this.props;

    if (!hasError) {
      return children;
    }

    // If too many errors, show critical state
    if (errorCount > 3) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white">
            <div className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Critical Error</h1>
              <p className="text-gray-600 mb-6">
                Multiple errors detected. Please reload the page or try again later.
              </p>
              <div className="space-y-2">
                <Button
                  onClick={this.handleReloadPage}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button
                  onClick={this.handleNavigateHome}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Home
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Default error UI
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-white">
          <div className="p-8">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <AlertTriangle className="h-8 w-8 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Oops! Something went wrong
                </h1>
                <p className="text-gray-600">
                  We encountered an unexpected error. Please try one of the options below.
                </p>
              </div>
            </div>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <h2 className="font-bold text-sm text-red-900 mb-2">Error Details:</h2>
                <p className="text-xs text-red-800 font-mono mb-3 break-words">
                  {error.toString()}
                </p>
                {errorInfo?.componentStack && (
                  <>
                    <h3 className="font-bold text-sm text-red-900 mb-2">Component Stack:</h3>
                    <pre className="text-xs text-red-800 overflow-auto max-h-48 p-2 bg-white rounded border border-red-100">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleReloadPage}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reload Page
              </Button>
              <Button
                onClick={this.handleNavigateHome}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </div>

            {/* Footer Note */}
            <p className="text-xs text-gray-500 mt-6 text-center">
              Error Count: {errorCount} | If the problem persists, please contact support.
            </p>
          </div>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
