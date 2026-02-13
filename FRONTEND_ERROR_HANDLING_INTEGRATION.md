# Frontend Survival Audit - Integration Guide

Comprehensive documentation for using error handling, performance monitoring, and fallback components throughout the detective profile page and the application.

## Overview

The frontend survival audit provides four key layers of protection:

1. **Global Error Boundary** - Catches React component errors
2. **Error Handling Utilities** - API and data validation errors
3. **Network Error Handler** - Connectivity issues
4. **Performance Monitoring** - Page performance tracking
5. **Fallback UI** - Degraded experience components

---

## 1. Global Error Boundary

### Setup in `App.tsx` or `main.tsx`

```tsx
import { ErrorBoundary } from '@/components/error-boundary';
import Sentry from '@sentry/react'; // Optional

function App() {
  return (
    <ErrorBoundary 
      onError={(error, errorInfo) => {
        // Send to monitoring service
        Sentry.captureException(error, { contexts: { react: errorInfo } });
      }}
    >
      <YourApplication />
    </ErrorBoundary>
  );
}
```

### Key Features

- **Synchronous Error Catching**: Catches errors in component render
- **Error Escalation**: Shows critical error UI after 3+ errors
- **Development Details**: Shows component stack in dev mode
- **Recovery Actions**: Provides "Try Again", "Reload", and "Go Home" options
- **Error Reporting**: Integrates with monitoring services (Sentry, etc.)

### Error Boundary Props

```tsx
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;           // Custom fallback UI
  onError?: (error, errorInfo) => void;  // Error handler
  isolate?: boolean;              // Only catch subtree errors
}
```

---

## 2. Error Handling Utilities

Located in `lib/error-handler.ts`

### Usage in Components

```tsx
import {
  classifyError,
  getUserFriendlyErrorMessage,
  logError,
  safeDeepAccess,
  validateRating,
  validatePrice,
  retryWithExponentialBackoff,
  safeLoadData,
} from '@/lib/error-handler';

// Classify and handle errors
try {
  const response = await api.call();
} catch (error) {
  const errorType = classifyError(error);
  const message = getUserFriendlyErrorMessage(
    errorType,
    'fetching detective profile'
  );
  
  logError(error, {
    operation: 'fetchDetectiveProfile',
    serviceId: serviceId,
    recoverable: true,
  });
  
  toast({ title: 'Error', description: message, variant: 'destructive' });
}
```

### Safe Data Validation

```tsx
// Safe property access with defaults
const avgRating = safeDeepAccess(serviceData, 'detective.avgRating', 0);
const reviewCount = safeDeepAccess(serviceData, 'reviewCount', 0);

// Validate specific data types
const rating = validateRating(user.lastRating); // Returns 1-5
const basePrice = validatePrice(service.basePrice); // Returns >= 0
```

### Retry Logic

```tsx
// Retry failed API calls with exponential backoff
const data = await retryWithExponentialBackoff(
  () => api.service.get(serviceId),
  3,  // max retries
  1000, // initial delay ms
  (attempt, error) => {
    console.log(`Retry attempt ${attempt} failed:`, error);
  }
);
```

### Safe Data Loading

```tsx
const { data, error } = await safeLoadData(
  () => api.users.getById(userId),
  {
    operation: 'loadUserProfile',
    userId,
    recoverable: true,
  },
  undefined // fallback value
);

if (error) {
  // Handle error with user-friendly message
  console.error(error.errorMessage);
}
```

---

## 3. Network Error Handler

Located in `components/network-error-handler.tsx`

### Usage in Detective Profile

```tsx
import { NetworkErrorHandler } from '@/components/network-error-handler';

function DetectiveProfile() {
  const [showNetworkError, setShowNetworkError] = useState(false);

  return (
    <>
      <NetworkErrorHandler
        isVisible={showNetworkError}
        onRetry={() => {
          setShowNetworkError(false);
          // Retry your operation
          queryClient.refetchQueries();
        }}
        message="Failed to load detective profile"
        dismissable={true}
        onDismiss={() => setShowNetworkError(false)}
      />
      
      {/* Your component content */}
    </>
  );
}
```

### Auto-Detection (Recommended)

```tsx
<NetworkErrorHandler
  // isVisible omitted - auto-detects offline status
  onRetry={refetchData}
  message="Connection lost"
  dismissable={true}
/>
```

### Component Behavior

- **Offline State**: Shows full-page modal overlay
- **Minor Issues**: Shows inline toast notification
- **Auto-Recovery**: Detects when connection is restored
- **No UI**: Hidden when connection is healthy

---

## 4. Performance Monitoring

Located in `lib/performance-monitor.ts`

### Basic Usage

```tsx
import { PerformanceMonitor, usePerformanceMonitoring } from '@/lib/performance-monitor';

// In components
function DetectiveProfile() {
  const { trackMetric, trackAPICall, getMetrics } = 
    usePerformanceMonitoring('DetectiveProfile');

  useEffect(() => {
    const start = Date.now();
    
    // After data loads
    const duration = Date.now() - start;
    trackMetric('dataLoadTime', duration);
  }, [trackMetric]);

  return <div>{/* component */}</div>;
}
```

### Track API Calls

```tsx
import { measureAsync } from '@/lib/performance-monitor';

// Automatic timing and reporting
const data = await measureAsync(
  () => api.service.get(serviceId),
  'detectiveProfileLoad',
  '/api/services/:id'
);
```

### Get Performance Summary

```tsx
const monitor = PerformanceMonitor.getInstance();

// Get a summary
console.log(monitor.getSummary());
// {
//   pageLoadTime: 2500,
//   averageAPILatency: 200,
//   slowestEndpoint: '/api/services/:id',
//   slowestEndpointLatency: 650,
//   coreWebVitals: { lcp: 2200, fid: 100, cls: 0.1 },
//   totalAPITracked: 12,
//   sessionDuration: 45000
// }
```

### Manual Metrics Reporting

```tsx
// Report to your analytics service
const monitor = PerformanceMonitor.getInstance();

// Auto-reports on page unload, or manually:
monitor.report('/api/metrics');
monitor.logMetrics(); // Dev only
```

### HOC for Component Timing

```tsx
import { withPerformanceMonitoring } from '@/lib/performance-monitor';

// Wraps component to auto-track render time
const MonitoredComponent = withPerformanceMonitoring(
  YourComponent,
  'YourComponent'
);
```

---

## 5. Fallback UI Components

Located in `components/fallback-ui.tsx`

### Slow Network Fallback

```tsx
import { SlowNetworkFallback } from '@/components/fallback-ui';

if (isSlowConnection) {
  return <SlowNetworkFallback onRetry={refetch} />;
}
```

### Data Loading Error

```tsx
import { DataLoadingFallback } from '@/components/fallback-ui';

if (dataError && !data) {
  return (
    <DataLoadingFallback
      message="Failed to load detective profile"
      onRetry={refetchData}
      showDetails={process.env.NODE_ENV === 'development'}
    />
  );
}
```

### Not Found

```tsx
import { NotFoundFallback } from '@/components/fallback-ui';

if (!serviceData) {
  return (
    <NotFoundFallback
      title="Service Not Found"
      description="This detective service no longer exists."
      onGoHome={() => navigate('/')}
    />
  );
}
```

### Server Error

```tsx
import { ServerErrorFallback } from '@/components/fallback-ui';

if (error?.status >= 500) {
  return (
    <ServerErrorFallback
      statusCode={error.status}
      onRetry={refetchData}
    />
  );
}
```

### JavaScript Disabled

```tsx
import { JavaScriptDisabledFallback } from '@/components/fallback-ui';

// In a noscript tag in HTML
<noscript>
  <JavaScriptDisabledFallback />
</noscript>
```

### Skeleton Loader

```tsx
import { SkeletonLoader } from '@/components/fallback-ui';

if (isLoading) {
  return <SkeletonLoader count={5} />;
}
```

---

## Integration Example: Detective Profile Page

Complete example showing all components working together:

```tsx
import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

import { ErrorBoundary } from '@/components/error-boundary';
import { NetworkErrorHandler } from '@/components/network-error-handler';
import { 
  DataLoadingFallback,
  NotFoundFallback,
  ServerErrorFallback,
} from '@/components/fallback-ui';
import {
  classifyError,
  getUserFriendlyErrorMessage,
  logError,
  validateRating,
  validatePrice,
  safeDeepAccess,
} from '@/lib/error-handler';
import { 
  usePerformanceMonitoring,
  measureAsync,
} from '@/lib/performance-monitor';

export default function DetectiveProfile() {
  const [, params] = useRoute("/service/:id");
  const serviceId = params?.id;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { trackMetric, trackAPICall } = usePerformanceMonitoring('DetectiveProfile');
  const [dataError, setDataError] = useState(null);
  const [networkErrorVisible, setNetworkErrorVisible] = useState(false);

  // Fetch with monitoring
  const { data: serviceData, isLoading: isLoadingService, error: serviceError } = 
    useQuery({
      queryKey: ['service', serviceId],
      queryFn: () => measureAsync(
        () => api.service.get(serviceId),
        'detectiveProfileLoad',
        '/api/services/:id'
      ),
      onError: (error) => {
        const errorType = classifyError(error);
        logError(error, {
          operation: 'fetchDetectiveProfile',
          serviceId,
          recoverable: true,
        });
        
        setDataError({
          type: errorType,
          message: getUserFriendlyErrorMessage(
            errorType,
            'loading detective profile'
          ),
        });
      },
    });

  // Validate and safe-access data
  useEffect(() => {
    if (isLoadingService) return;

    // Validate loaded data
    if (serviceData) {
      const avgRating = validateRating(safeDeepAccess(serviceData, 'avgRating', 5));
      const basePrice = validatePrice(safeDeepAccess(serviceData, 'service.basePrice', 0));
      
      trackMetric('dataValidation', avgRating > 0 ? 1 : 0);
      
      if (basePrice === 0) {
        console.warn('Price validation failed:', serviceData.service.basePrice);
      }
    }
  }, [serviceData, isLoadingService, trackMetric]);

  // Handle mutations with error recovery
  const submitReview = useMutation({
    mutationFn: async (data: any) => {
      try {
        return await measureAsync(
          () => api.reviews.create(data),
          'submitReview',
          '/api/reviews'
        );
      } catch (error) {
        const errorType = classifyError(error);
        logError(error, {
          operation: 'submitReview',
          serviceId,
          userId: user?.id,
          recoverable: true,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'service', serviceId] });
      toast({ title: "Review submitted", description: "Thanks for your feedback" });
    },
    onError: (error: any) => {
      const errorType = classifyError(error);
      const message = getUserFriendlyErrorMessage(errorType, 'submitting review');
      toast({ title: "Failed to submit", description: message, variant: "destructive" });
    },
  });

  // Handle retry with exponential backoff
  const handleRetry = async () => {
    try {
      await retryWithExponentialBackoff(
        () => queryClient.refetchQueries({ queryKey: ['service', serviceId] }),
        2,
        500,
        (attempt) => {
          console.log(`Retry attempt ${attempt}`);
        }
      );
      setDataError(null);
    } catch (error) {
      const errorType = classifyError(error);
      setDataError({
        type: errorType,
        message: getUserFriendlyErrorMessage(errorType, 'retrying'),
      });
    }
  };

  // Loading state
  if (isLoadingService) {
    return <SkeletonLoader count={5} />;
  }

  // Server error
  if (serviceError?.status >= 500) {
    return <ServerErrorFallback statusCode={serviceError.status} onRetry={handleRetry} />;
  }

  // Data loading error
  if (dataError && !serviceData) {
    return (
      <DataLoadingFallback
        message={dataError.message}
        onRetry={handleRetry}
        showDetails={process.env.NODE_ENV === 'development'}
      />
    );
  }

  // Not found
  if (!serviceData?.service || !serviceData?.detective) {
    return (
      <NotFoundFallback
        title="Service Not Found"
        description="The service you're looking for doesn't exist or has been removed."
        onGoHome={() => window.location.href = '/'}
      />
    );
  }

  return (
    <ErrorBoundary
      onError={(error, info) => {
        logError(error, {
          operation: 'detectiveProfileRender',
          serviceId,
          recoverable: false,
        });
      }}
    >
      <NetworkErrorHandler
        onRetry={() => {
          setNetworkErrorVisible(false);
          queryClient.refetchQueries({ queryKey: ['service', serviceId] });
        }}
        dismissable={true}
      />

      {/* Your page content */}
      <div>
        <h1>{serviceData.service.title}</h1>
        {/* Rest of component */}
      </div>
    </ErrorBoundary>
  );
}
```

---

## Best Practices

### 1. Error Classification

Always classify errors to provide context-appropriate UX:

```tsx
const errorType = classifyError(error);
const message = getUserFriendlyErrorMessage(errorType, 'operation');
```

### 2. Validation Before Use

Validate all external data:

```tsx
const safeValue = validatePrice(unknownData);
const safeRating = validateRating(userInput);
```

### 3. Retry with Backoff

Use exponential backoff for transient failures:

```tsx
const data = await retryWithExponentialBackoff(operation, 3, 1000);
```

### 4. Data Safety

Use safe access for nested properties:

```tsx
const value = safeDeepAccess(obj, 'deeply.nested.property', defaultValue);
```

### 5. Always Log Errors

Include operation context in error logs:

```tsx
logError(error, {
  operation: 'detectiveProfileLoad',
  serviceId,
  userId: user?.id,
  recoverable: true,
});
```

### 6. Performance Tracking

Track metrics for important operations:

```tsx
trackMetric('criticalOperation', duration);
trackAPICall('/api/endpoint', responseTime);
```

### 7. Graceful Degradation

Always provide fallback UI:

```tsx
if (error) return <DataLoadingFallback onRetry={retry} />;
if (!data) return <NotFoundFallback />;
if (offline) return <SlowNetworkFallback />;
```

---

## Monitoring Integration

Send metrics to your monitoring service:

```tsx
// In app initialization
const monitor = PerformanceMonitor.getInstance();

// Sends automatically on page unload
window.addEventListener('beforeunload', () => {
  monitor.report('/api/metrics');
});

// Or manually:
monitor.report('/your-metrics-endpoint');
```

---

## Testing Error Scenarios

For testing in development:

```tsx
// Simulate network error
window.dispatchEvent(new Event('offline'));

// Simulate slow network
const monitor = PerformanceMonitor.getInstance();
monitor.trackAPICall('/api/test', 5000); // 5s latency

// Simulate component error
throw new Error('Test error');
```

---

## Migration Checklist

- [ ] Wrap app in `ErrorBoundary`
- [ ] Import error utilities in pages needing them
- [ ] Add `NetworkErrorHandler` to main layout
- [ ] Add performance monitoring to key operations
- [ ] Update API calls to use `measureAsync`
- [ ] Replace generic error screens with fallback UI
- [ ] Add validation for all external data
- [ ] Configure error reporting service (Sentry, etc)
- [ ] Test all error scenarios
- [ ] Monitor metrics in production

---

## Troubleshooting

### Boundary isn't catching errors

- Make sure it wraps the component with the error
- Only catches render/lifecycle errors, not event handlers
- Use try-catch in event handlers manually

### Performance metrics not reporting

- Check that `navigator.sendBeacon` is supported
- Verify metrics endpoint is accessible
- Check browser console for errors

### Network handler always showing

- Verify `navigator.onLine` is working
- Check browser's offline mode
- Clear localStorage if stuck state

