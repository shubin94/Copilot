import React from 'react';
import { AlertTriangle, Wifi, Clock, RefreshCw, Database } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

/**
 * Degraded Experience UI Components
 * 
 * Used when the application cannot render in normal mode
 * Provides limited functionality and graceful degradation
 */

/**
 * Fallback UI for slow network conditions
 */
export function SlowNetworkFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white shadow-lg">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-yellow-100 rounded-full">
              <Clock className="h-8 w-8 text-yellow-600 animate-pulse" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Slow Connection
            </h2>
            <p className="text-gray-600 text-sm">
              Your connection is slow. The page may load more slowly than usual.
            </p>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <p className="text-xs text-yellow-700">
              💡 Tip: Disable images and videos for faster loading
            </p>
          </div>

          {onRetry && (
            <Button
              onClick={onRetry}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}

          <p className="text-xs text-gray-500">
            Waiting for page to fully load...
          </p>
        </div>
      </Card>
    </div>
  );
}

/**
 * Fallback UI for data loading errors
 */
export function DataLoadingFallback({ 
  message = "Unable to load content",
  onRetry,
  showDetails = false 
}: { 
  message?: string;
  onRetry?: () => void;
  showDetails?: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-red-100 rounded-full">
              <Database className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Data Error
            </h2>
            <p className="text-gray-600 text-sm">
              {message}
            </p>
          </div>

          {showDetails && (
            <div className="bg-gray-100 p-3 rounded-lg text-left">
              <p className="text-xs text-gray-700 font-mono break-words">
                Failed to fetch required data. Please check your connection.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Loading
              </Button>
            )}

            <Button
              onClick={() => {
                window.location.href = '/';
              }}
              variant="outline"
              className="w-full"
            >
              Go to Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Fallback UI for JavaScript disabled
 */
export function JavaScriptDisabledFallback() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />

        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            JavaScript Disabled
          </h1>
          <p className="text-gray-600 text-lg">
            This application requires JavaScript to be enabled.
          </p>
        </div>

        <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-left space-y-2">
          <p className="font-bold text-gray-900">To enable JavaScript:</p>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
            <li>
              <strong>Chrome:</strong> Click Menu → Settings → Privacy → Content Settings → JavaScript
            </li>
            <li>
              <strong>Firefox:</strong> Type about:config → Search for javascript.enabled → Toggle to true
            </li>
            <li>
              <strong>Safari:</strong> Preferences → Security → Enable JavaScript
            </li>
            <li>
              <strong>Edge:</strong> Settings → Privacy → Content → JavaScript
            </li>
          </ol>
        </div>

        <p className="text-sm text-gray-500">
          After enabling JavaScript, please refresh this page.
        </p>
      </div>
    </div>
  );
}

/**
 * Fallback UI while JavaScript is loading
 */
export function JavaScriptLoadingFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="animate-spin">
            <div className="h-12 w-12 border-4 border-gray-200 border-t-blue-600 rounded-full" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Loading Application
          </h1>
          <p className="text-gray-600">
            Please wait while we load the application...
          </p>
        </div>

        <div className="flex justify-center gap-1">
          <div className="animate-bounce h-2 w-2 bg-blue-600 rounded-full" style={{ animationDelay: '0s' }} />
          <div className="animate-bounce h-2 w-2 bg-blue-600 rounded-full" style={{ animationDelay: '0.1s' }} />
          <div className="animate-bounce h-2 w-2 bg-blue-600 rounded-full" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback UI for service/data not found
 */
export function NotFoundFallback({ 
  title = "Not Found",
  description = "The item you're looking for doesn't exist or has been removed.",
  onGoHome
}: {
  title?: string;
  description?: string;
  onGoHome?: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="text-6xl">🔍</div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {title}
            </h2>
            <p className="text-gray-600">
              {description}
            </p>
          </div>

          <Button
            onClick={onGoHome || (() => window.location.href = '/')}
            className="w-full"
          >
            Go to Home
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Fallback UI for server errors
 */
export function ServerErrorFallback({
  statusCode = 500,
  onRetry
}: {
  statusCode?: number;
  onRetry?: () => void;
}) {
  const messages: Record<number, { title: string; description: string }> = {
    500: {
      title: 'Server Error',
      description: 'Something went wrong on our end. Please try again later.'
    },
    502: {
      title: 'Bad Gateway',
      description: 'The server is temporarily unavailable. Please try again.'
    },
    503: {
      title: 'Service Unavailable',
      description: 'The service is temporarily unavailable. We\'re working on it.'
    },
    504: {
      title: 'Gateway Timeout',
      description: 'The server took too long to respond. Please try again.'
    },
  };

  const message = messages[statusCode] || {
    title: `Error ${statusCode}`,
    description: 'An unexpected error occurred. Please try again.'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white shadow-lg">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-red-100 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {message.title}
            </h2>
            <p className="text-gray-600 text-sm">
              {message.description}
            </p>
          </div>

          <div className="space-y-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}

            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
              className="w-full"
            >
              Go to Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Minimal skeleton loader
 */
export function SkeletonLoader({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      ))}
    </div>
  );
}

export default {
  SlowNetworkFallback,
  DataLoadingFallback,
  JavaScriptDisabledFallback,
  JavaScriptLoadingFallback,
  NotFoundFallback,
  ServerErrorFallback,
  SkeletonLoader,
};
