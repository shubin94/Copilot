# Enhanced Detective Profile: Integration Guide

This guide shows exactly how to integrate the frontend survival audit components into the detective profile page.

## Current State

The detective-profile.tsx page currently has:
- Basic error states (loading, service not found, detective deleted)
- Manual error handling in mutations
- No performance monitoring
- No network error detection
- No fallback UI components
- No validation utilities

## Step-by-Step Integration

### Step 1: Add Imports

Add these imports at the top of `detective-profile.tsx`:

```tsx
// Error handling utilities
import {
  classifyError,
  getUserFriendlyErrorMessage,
  logError,
  safeDeepAccess,
  validateRating,
  validatePrice,
  retryWithExponentialBackoff,
  safeLoadData,
  validateServiceData,
  getRecoveryAction,
} from '@/lib/error-handler';

// Performance monitoring
import {
  usePerformanceMonitoring,
  measureAsync,
  PerformanceMonitor,
} from '@/lib/performance-monitor';

// Network error handling
import { NetworkErrorHandler } from '@/components/network-error-handler';

// Fallback UI
import {
  DataLoadingFallback,
  NotFoundFallback,
  ServerErrorFallback,
  SlowNetworkFallback,
  SkeletonLoader,
} from '@/components/fallback-ui';
```

### Step 2: Add State for Error Handling

Add these state variables within the component:

```tsx
export default function DetectiveProfile() {
  const [, params] = useRoute("/service/:id");
  const serviceId = params?.id;

  // NEW: Error handling state
  const [dataValidationError, setDataValidationError] = useState<{
    type: 'validation' | 'server' | 'network' | 'not-found';
    message: string;
  } | null>(null);
  
  const [networkErrorVisible, setNetworkErrorVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // NEW: Performance monitoring
  const { trackMetric, trackAPICall, getMetrics } = 
    usePerformanceMonitoring('DetectiveProfile');

  // Existing code...
```

### Step 3: Enhanced useService Hook

Replace the basic `useService` call with enhanced error handling:

```tsx
// BEFORE:
const { data: serviceData, isLoading: isLoadingService, error: serviceError } = 
  useService(serviceId, isPreview);

// AFTER:
const {
  data: serviceData,
  isLoading: isLoadingService,
  error: serviceError,
} = useQuery({
  queryKey: ['service', serviceId, isPreview],
  queryFn: async () => {
    try {
      return await measureAsync(
        () => {
          // Ensure serviceId is a string
          if (!serviceId || typeof serviceId !== 'string') {
            throw new Error('Invalid service ID');
          }
          return api.service.get(serviceId, isPreview);
        },
        'detectiveProfileLoad',
        `/api/services/${serviceId}`
      );
    } catch (error) {
      const errorType = classifyError(error);
      logError(error, {
        operation: 'fetchDetectiveProfile',
        serviceId: serviceId || 'unknown',
        recoverable: true,
      });
      
      // Set validation error
      setDataValidationError({
        type: errorType as any,
        message: getUserFriendlyErrorMessage(errorType, 'loading detective profile'),
      });
      
      throw error;
    }
  },
  onError: (error: any) => {
    if (error?.status >= 500) {
      setNetworkErrorVisible(true);
    }
  },
  enabled: !!serviceId,
});
```

### Step 4: Data Validation Effect

Add this effect to validate the loaded data:

```tsx
// NEW: Validate loaded service data
useEffect(() => {
  if (!serviceData || isLoadingService) return;

  try {
    const validation = validateServiceData(serviceData);
    
    if (!validation.valid) {
      logError(
        new Error(`Data validation failed: ${validation.errors.join(', ')}`),
        {
          operation: 'validateDetectiveProfile',
          serviceId,
          recoverable: true,
        }
      );
      
      setDataValidationError({
        type: 'validation',
        message: 'Incomplete detective profile data. Some features may not work.',
      });
      
      return;
    }

    // Data is valid, clear validation error
    setDataValidationError(null);

    // Track successful data load
    trackMetric('dataValidationSuccess', 1);
  } catch (error) {
    console.warn('Data validation error:', error);
  }
}, [serviceData, isLoadingService, serviceId, trackMetric]);
```

### Step 5: Safe Data Extraction

Replace the current data extraction with safe validation:

```tsx
// BEFORE:
const basePrice = (() => {
  const raw = service.basePrice;
  if (!raw) return 0;
  const parsed = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return isNaN(parsed) ? 0 : parsed;
})();

// AFTER:
const basePrice = validatePrice(safeDeepAccess(serviceData, 'service.basePrice', 0));
const offerPrice = (() => {
  const raw = safeDeepAccess(serviceData, 'service.offerPrice', null);
  return validatePrice(raw) > 0 ? validatePrice(raw) : null;
})();

// Safe detective data access
const detectiveName = safeDeepAccess(serviceData, 'detective.businessName', 'Unknown Detective');
const avgRating = validateRating(safeDeepAccess(serviceData, 'avgRating', 5));
const reviewCount = safeDeepAccess(serviceData, 'reviewCount', 0);
```

### Step 6: Enhanced Submit Review with Error Handling

Update the submitReview mutation:

```tsx
// BEFORE:
const submitReview = useMutation({
  mutationFn: async () => {
    if (existingUserReview?.id) {
      return api.reviews.update(existingUserReview.id, { rating, comment });
    }
    return api.reviews.create({ serviceId: serviceId!, rating, comment });
  },
  onSuccess: () => {
    // ... existing code
  },
  onError: (error: any) => {
    toast({ title: "Failed to submit", description: error?.message || "Could not submit review", variant: "destructive" });
  },
});

// AFTER:
const submitReview = useMutation({
  mutationFn: async () => {
    try {
      if (!serviceId) throw new Error('Service ID is required');
      if (!user?.id) throw new Error('User authentication required');
      
      // Validate input
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        throw new Error('Invalid rating value');
      }
      if (typeof comment !== 'string') {
        throw new Error('Invalid comment format');
      }

      const reviewData = { serviceId, rating: validateRating(rating), comment: comment.trim() };

      const response = await measureAsync(
        () => {
          if (existingUserReview?.id) {
            return api.reviews.update(existingUserReview.id, { rating: reviewData.rating, comment: reviewData.comment });
          }
          return api.reviews.create(reviewData);
        },
        'submitReview',
        '/api/reviews'
      );

      return response;
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
    queryClient.invalidateQueries({ queryKey: ['reviews', 'detective'] });
    queryClient.invalidateQueries({ queryKey: ['services', serviceId] });

    setRating(5);
    setComment("");
    toast({ title: "Review submitted", description: "Thanks for your feedback" });
  },
  onError: (error: any) => {
    const errorType = classifyError(error);
    const message = getUserFriendlyErrorMessage(errorType, 'submitting your review');
    
    toast({
      title: "Failed to submit review",
      description: message,
      variant: "destructive"
    });
  },
});
```

### Step 7: Handle Retry with Exponential Backoff

Add this handler function:

```tsx
// NEW: Retry handler with exponential backoff
const handleRetry = async () => {
  setIsRetrying(true);
  setDataValidationError(null);
  
  try {
    await retryWithExponentialBackoff(
      () => queryClient.refetchQueries({ queryKey: ['service', serviceId, isPreview] }),
      2,  // max retries
      500 // initial delay
    );
  } catch (error) {
    const errorType = classifyError(error);
    setDataValidationError({
      type: errorType as any,
      message: getUserFriendlyErrorMessage(errorType, 'retrying service load'),
    });
  } finally {
    setIsRetrying(false);
  }
};
```

### Step 8: Update Error States

Replace the existing error state JSX with enhanced fallback UI:

```tsx
// BEFORE:
if (serviceError || !serviceData) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Navbar />
      <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Service Not Found</h2>
          <p className="text-gray-600">The service you're looking for doesn't exist or has been removed.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// AFTER (in the JSX return):
// Server error (5xx)
if (serviceError?.status >= 500) {
  return (
    <>
      <Navbar />
      <ServerErrorFallback
        statusCode={serviceError.status}
        onRetry={handleRetry}
      />
      <Footer />
    </>
  );
}

// Data validation error
if (dataValidationError && !serviceData) {
  return (
    <>
      <Navbar />
      <DataLoadingFallback
        message={dataValidationError.message}
        onRetry={handleRetry}
        showDetails={process.env.NODE_ENV === 'development'}
      />
      <Footer />
    </>
  );
}

// Service not found
if (!serviceData?.service || !serviceData?.detective) {
  return (
    <>
      <Navbar />
      <NotFoundFallback
        title="Service Not Found"
        description="The service you're looking for doesn't exist or has been removed."
        onGoHome={() => window.location.href = '/'}
      />
      <Footer />
    </>
  );
}
```

### Step 9: Update Loading State

Enhance the loading skeleton:

```tsx
// BEFORE:
if (isLoadingService) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Navbar />
      <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Existing skeleton code */}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// AFTER (use the SkeletonLoader component):
if (isLoadingService) {
  return (
    <>
      <Navbar />
      <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
        <SkeletonLoader count={6} />
      </main>
      <Footer />
    </>
  );
}
```

### Step 10: Add Network Error Handler

Add this to the main JSX return (inside the div, after Navbar):

```tsx
return (
  <div className="min-h-screen bg-white font-sans text-gray-900">
    <NetworkErrorHandler
      isVisible={networkErrorVisible}
      onRetry={() => {
        setNetworkErrorVisible(false);
        handleRetry();
      }}
      message="Failed to load detective profile. Check your connection."
      dismissable={true}
      onDismiss={() => setNetworkErrorVisible(false)}
    />
    
    <SEO {...seoProps} />
    <Navbar />
    
    {/* Rest of component */}
  </div>
);
```

### Step 11: Wrap in Error Boundary

For the whole page file, you can optionally wrap the default export:

```tsx
// At the top of the file
function DetectiveProfileContent() {
  // All your component code here
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* JSX */}
    </div>
  );
}

// At the bottom
export default function DetectiveProfile() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logError(error, {
          operation: 'DetectiveProfilePageRender',
          recoverable: false,
        });
      }}
    >
      <DetectiveProfileContent />
    </ErrorBoundary>
  );
}
```

---

## Testing the Integration

### Test Error Scenarios

1. **Invalid Service ID**
   ```
   URL: /service/invalid-id
   Expected: Shows NotFoundFallback
   ```

2. **Network Error**
   ```
   Open DevTools → Network tab → Offline
   Expected: Shows NetworkErrorHandler
   ```

3. **Server Error (500)**
   ```
   Mock API error in React Query
   Expected: Shows ServerErrorFallback with retry button
   ```

4. **Slow Network**
   ```
   DevTools → Network → Slow 3G
   Expected: Page still loads, shows SlowNetworkFallback
   ```

5. **Data Validation Error**
   ```
   Return incomplete data from API
   Expected: Shows DataLoadingFallback with validation error
   ```

6. **Review Submission Error**
   ```
   Submit review with invalid data
   Expected: Toast with user-friendly error message
   ```

### Manual Testing Checklist

- [ ] Test on slow 3G connection
- [ ] Test offline mode
- [ ] Test with invalid service ID
- [ ] Test with missing detective data
- [ ] Test review submission error
- [ ] Test retry functionality
- [ ] Verify performance metrics are tracked
- [ ] Check error logs in console
- [ ] Test on different browsers
- [ ] Test on mobile devices

---

## Performance Monitoring Dashboard

To view collected metrics:

```tsx
// In browser console:
const monitor = PerformanceMonitor.getInstance();
console.log(monitor.getSummary());
// Output:
// {
//   pageLoadTime: 2500,
//   averageAPILatency: 150,
//   slowestEndpoint: '/api/services/:id',
//   slowestEndpointLatency: 800,
//   coreWebVitals: { lcp: 2200, fid: 45, cls: 0.05 },
//   totalAPITracked: 8,
//   sessionDuration: 45000
// }
```

---

## Modified Files Summary

1. **detective-profile.tsx** - Add error handling, validation, and monitoring
2. **app.tsx or main.tsx** - Wrap with ErrorBoundary
3. **layout.tsx** (if exists) - Add NetworkErrorHandler

---

## Before & After Comparison

| Aspect | Before | After |
|--------|--------|-------|
| Error handling | Basic try-catch | Comprehensive with classification |
| User feedback | Generic errors | User-friendly messages |
| Network errors | Ignored | Detected and handled |
| Performance tracking | None | Full Core Web Vitals + API timing |
| Data validation | Minimal | Complete with safe accessors |
| Fallback UI | None | Multiple fallback states |
| Retry logic | Manual | Automatic with exponential backoff |
| Offline support | None | Full offline detection |
| Error logging | Manual console | Structured logging with context |
| User experience | Jarring failures | Graceful degradation |

---

## Common Issues & Solutions

### Issue: Error boundary shows but component recovers

**Solution**: Use error boundary as outer wrapper, not around individual components.

### Issue: Metrics aren't being reported

**Solution**: Check that `navigator.sendBeacon` is supported and endpoint is accessible.

### Issue: Retry keeps failing

**Solution**: Make sure to clear error state when starting retry.

### Issue: Network handler always visible

**Solution**: Wrap in condition to check if error is network-related.

---

## Performance Targets

After integration, aim for:

- Page Load Time: < 2.5s
- API Latency: < 200ms average
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1

Monitor these in production using the PerformanceMonitor.

