/**
 * Serverless Memory Optimization Layer
 * 
 * This module provides utilities to reduce memory consumption in serverless environments
 * where memory is limited (2048MB on Vercel).
 * 
 * Strategies:
 * 1. Defer non-critical imports
 * 2. Clean up large objects after use
 * 3. Use environment flags to skip unnecessary initialization
 * 4. Implement lazy loading for routes
 */

/**
 * Lazy load a module and cache the result
 * Reduces initial memory footprint by deferring imports
 */
const moduleCache = new Map<string, any>();

export function createLazyImport<T>(importFn: () => Promise<T>): () => Promise<T> {
  return async () => {
    const key = importFn.toString();
    if (moduleCache.has(key)) {
      return moduleCache.get(key);
    }
    const module = await importFn();
    moduleCache.set(key, module);
    return module;
  };
}

/**
 * Cleanup strategy for reducing memory between requests
 */
export function cleanupMemory() {
  // Only run in production to avoid issues in development
  if (process.env.NODE_ENV === 'production') {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear any large caches that accumulate over time
    if (moduleCache.size > 100) {
      // Keep only the 10 most recently used modules
      const entries = Array.from(moduleCache.entries());
      const toDelete = entries.slice(0, entries.length - 10);
      toDelete.forEach(([key]) => moduleCache.delete(key));
    }
  }
}

/**
 * Flag to conditionally load heavy dependencies
 */
export const shouldLoadHeavyDependencies = () => {
  // Skip in serverless if memory is constrained
  return process.env.VERCEL !== 'true' || process.env.ENABLE_HEAVY_DEPS === 'true';
};

/**
 * Optimize Sentry configuration for serverless
 */
export const getOptimizedSentryConfig = () => {
  return {
    tracesSampleRate: 0.05, // Lower than normal to reduce overhead
    profilesSampleRate: 0.01, // Very low to save memory
    // Only attach stack traces in error cases
    attachStacktrace: true,
    // Disable automatic session tracking
    autoSessionTracking: false,
  };
};

/**
 * Memory warning threshold - alert if exceeding this
 */
export const MEMORY_WARNING_THRESHOLD = 2400; // MB

/**
 * Monitor memory usage in serverless
 */
export function monitorMemoryUsage() {
  if (process.env.NODE_ENV === 'production') {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    if (heapUsedMB > MEMORY_WARNING_THRESHOLD) {
      console.warn(`⚠️  High memory usage in serverless: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    }
    
    // Log periodically
    return {
      heapUsedMB,
      heapTotalMB,
      externalMB: Math.round(memUsage.external / 1024 / 1024)
    };
  }
  return null;
}

/**
 * Stream response data instead of buffering
 * For large API responses, stream to reduce memory footprint
 */
export function shouldStreamResponse(contentLength: number): boolean {
  // Stream if content is larger than 1MB
  return contentLength > 1024 * 1024;
}

/**
 * Disable unnecessary features in serverless
 */
export const serverlessOptimizations = {
  // Disable profiling in Sentry for memory savings
  profilesSampleRate: 0.01,
  
  // Don't store request breadcrumbs  
  maxBreadcrumbs: 10,
  
  // Smaller request body capture
  maxRequestBodySize: 'small',
  
  // Skip source map processing
  sourceMapsIntegration: false,
};
