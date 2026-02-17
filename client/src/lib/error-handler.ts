/**
 * Enhanced Error Handling for Detective Profile
 * 
 * Provides error recovery, user-friendly messages, and logging
 */

interface ErrorContext {
  operation: string;
  serviceId?: string;
  userId?: string;
  recoverable?: boolean;
  shouldRetry?: boolean;
}

export interface ErrorState {
  hasError: boolean;
  errorMessage: string;
  errorType: 'network' | 'validation' | 'not-found' | 'server' | 'unknown';
  recoveryAction?: () => void;
  timestamp: number;
}

/**
 * Classify error types for better UX
 */
export function classifyError(error: any): ErrorState['errorType'] {
  if (!error) return 'unknown';

  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.response?.status;

  if (status === 404 || message.includes('not found')) return 'not-found';
  if (status === 400 || message.includes('invalid')) return 'validation';
  if (status >= 500) return 'server';
  if (message.includes('network') || message.includes('offline')) return 'network';

  return 'unknown';
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(
  errorType: ErrorState['errorType'],
  operation: string,
  context?: Partial<ErrorContext>
): string {
  const messages: Record<ErrorState['errorType'], string> = {
    'not-found': `The ${operation} you're looking for doesn't exist or has been removed.`,
    'validation': `The ${operation} data is invalid. Please check your input and try again.`,
    'server': `We're experiencing server issues with ${operation}. Please try again in a moment.`,
    'network': `Network connection error. Please check your internet and try again.`,
    'unknown': `An unexpected error occurred while ${operation}. Please try again.`,
  };

  return messages[errorType];
}

/**
 * Safe error logger with context
 */
export function logError(
  error: any,
  context: ErrorContext,
  isProduction = process.env.NODE_ENV === 'production'
) {
  const errorData = {
    timestamp: new Date().toISOString(),
    operation: context.operation,
    serviceId: context.serviceId,
    userId: context.userId,
    errorType: classifyError(error),
    message: error?.message || String(error),
    stack: error?.stack,
    recoverable: context.recoverable ?? true,
    environment: isProduction ? 'production' : 'development',
  };

  // Log to console in development
  if (!isProduction) {
    console.error(
      `[${context.operation}] Error:`,
      errorData,
      error
    );
  }

  // Send to monitoring service in production
  if (isProduction && typeof window !== 'undefined' && (window as any).__reportError) {
    (window as any).__reportError({
      type: 'detective_profile_error',
      ...errorData,
    });
  }

  return errorData;
}

/**
 * Safely validate object properties
 */
export function safeDeepAccess<T>(
  obj: any,
  path: string,
  defaultValue: T
): T {
  try {
    const value = path.split('.').reduce((current, key) => current?.[key], obj);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Rating validation with safe defaults
 */
export function validateRating(value: any): number {
  if (typeof value === 'number' && value >= 1 && value <= 5) {
    return value;
  }
  return 5;
}

/**
 * Price validation with safe defaults
 */
export function validatePrice(raw: any): number {
  if (!raw) return 0;
  const parsed = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Retry strategy for failed operations
 */
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        onRetry?.(attempt, lastError);

        // Don't retry on client errors (4xx)
        if ((error as any)?.status >= 400 && (error as any)?.status < 500) {
          throw error;
        }

        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Safe data loading with error recovery
 */
export async function safeLoadData<T>(
  loader: () => Promise<T>,
  context: ErrorContext,
  fallback?: T
): Promise<{ data: T | undefined; error: ErrorState | null }> {
  try {
    const data = await loader();
    return { data, error: null };
  } catch (error) {
    const errorType = classifyError(error);
    const errorData = logError(error, context);

    return {
      data: fallback,
      error: {
        hasError: true,
        errorMessage: getUserFriendlyErrorMessage(errorType, context.operation, context),
        errorType,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Validate service data structure
 */
export function validateServiceData(data: any) {
  const errors: string[] = [];

  if (!data) {
    errors.push('Service data is empty');
    return { valid: false, errors };
  }

  if (!data.service) {
    errors.push('Service information is missing');
  }

  if (!data.detective) {
    errors.push('Detective information is missing');
  }

  if (typeof data.avgRating !== 'number') {
    errors.push('Rating information is invalid');
  }

  if (typeof data.reviewCount !== 'number') {
    errors.push('Review count is invalid');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create recovery action for common errors
 */
export function getRecoveryAction(
  errorType: ErrorState['errorType'],
  retryFn?: () => void
): (() => void) | undefined {
  if (errorType === 'network' && retryFn) {
    return retryFn;
  }

  if (errorType === 'server' && retryFn) {
    return () => {
      setTimeout(retryFn, 2000); // Wait 2s before retry
    };
  }

  if (errorType === 'not-found') {
    return () => {
      window.location.href = '/';
    };
  }

  return undefined;
}
