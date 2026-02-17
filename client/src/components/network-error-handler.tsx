import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface NetworkErrorProps {
  isVisible?: boolean;
  onRetry?: () => void;
  message?: string;
  dismissable?: boolean;
  onDismiss?: () => void;
}

/**
 * Network Error Handler Component
 * 
 * Displays network status and provides retry mechanism
 * Can be shown as overlay or inline component
 */
export function NetworkErrorHandler({
  isVisible,
  onRetry,
  message = 'Network connection lost',
  dismissable = false,
  onDismiss,
}: NetworkErrorProps) {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [isDismissed, setIsDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      onRetry?.();
    } finally {
      setRetrying(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Determine visibility
  const shouldShow = isVisible !== undefined 
    ? isVisible && !isDismissed
    : !isOnline && !isDismissed;

  if (!shouldShow) {
    return null;
  }

  // Full page error modal for offline state
  if (!isOnline && typeof window !== 'undefined' && window.location.pathname !== '/') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="bg-white max-w-md w-full mx-4">
          <div className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="p-4 bg-red-100 rounded-full">
                <WifiOff className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              You're Offline
            </h2>

            <p className="text-gray-600 mb-6">
              {message}. Please check your internet connection and try again.
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {retrying ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </>
                )}
              </Button>

              {dismissable && (
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  className="w-full"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Inline toast-style notification for minor connectivity issues
  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full mx-4">
      <Card className="bg-yellow-50 border border-yellow-200 shadow-lg">
        <div className="p-4 flex items-start gap-4">
          <div className="flex-shrink-0 pt-0.5">
            <WifiOff className="h-5 w-5 text-yellow-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-yellow-900 text-sm">
              Network Issue
            </h3>
            <p className="text-yellow-800 text-sm mt-1">
              {message}
            </p>
          </div>

          <div className="flex-shrink-0 flex gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={retrying}
              className="h-8"
            >
              {retrying ? (
                <RotateCcw className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
            </Button>

            {dismissable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 px-2"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default NetworkErrorHandler;
