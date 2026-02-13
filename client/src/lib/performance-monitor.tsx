/**
 * Performance Monitoring & Metrics Collection
 * 
 * Tracks page load times, API latency, and Core Web Vitals
 */

import React from 'react';

interface PerformanceMetrics {
  pageLoadTime?: number;
  apiLatency?: Record<string, number[]>;
  coreWebVitals?: {
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
  };
  resourceTiming?: {
    name: string;
    duration: number;
    size?: number;
  }[];
  customMetrics?: Record<string, number>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics = {};
  private apiLatencies: Map<string, number[]> = new Map();
  private startTime: number = Date.now();
  private observers: Map<string, PerformanceObserver> = new Map();

  private constructor() {
    this.initializeMetrics();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance observers for Core Web Vitals
   */
  private initializeMetrics() {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      // Monitor Largest Contentful Paint (LCP)
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.coreWebVitals = {
            ...this.metrics.coreWebVitals,
            lcp: lastEntry.renderTime || lastEntry.loadTime,
          };
        });

        try {
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
          this.observers.set('lcp', lcpObserver);
        } catch (e) {
          // LCP not supported
        }
      }

      // Monitor First Input Delay (FID)
      if ('PerformanceObserver' in window) {
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const firstEntry = entries[0];
          this.metrics.coreWebVitals = {
            ...this.metrics.coreWebVitals,
            fid: firstEntry.processingDuration,
          };
        });

        try {
          fidObserver.observe({ type: 'first-input', buffered: true });
          this.observers.set('fid', fidObserver);
        } catch (e) {
          // FID not supported
        }
      }

      // Monitor Cumulative Layout Shift (CLS)
      if ('PerformanceObserver' in window) {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            clsValue += (entry as any).value;
          }
          this.metrics.coreWebVitals = {
            ...this.metrics.coreWebVitals,
            cls: clsValue,
          };
        });

        try {
          clsObserver.observe({ type: 'layout-shift', buffered: true });
          this.observers.set('cls', clsObserver);
        } catch (e) {
          // CLS not supported
        }
      }

      // Track navigation timing
      if (window.performance && window.performance.timing) {
        window.addEventListener('load', () => {
          setTimeout(() => {
            const timing = window.performance.timing;
            this.metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
          }, 0);
        });
      }
    } catch (error) {
      console.warn('Performance monitoring initialization failed:', error);
    }
  }

  /**
   * Track API call latency
   */
  trackAPICall(endpoint: string, duration: number) {
    if (!this.apiLatencies.has(endpoint)) {
      this.apiLatencies.set(endpoint, []);
    }

    const latencies = this.apiLatencies.get(endpoint)!;
    latencies.push(duration);

    // Keep only last 100 calls per endpoint
    if (latencies.length > 100) {
      latencies.shift();
    }

    this.metrics.apiLatency = Object.fromEntries(this.apiLatencies);
  }

  /**
   * Track custom metrics
   */
  trackCustomMetric(name: string, value: number) {
    if (!this.metrics.customMetrics) {
      this.metrics.customMetrics = {};
    }
    this.metrics.customMetrics[name] = value;
  }

  /**
   * Get average latency for specific endpoint
   */
  getAverageLatency(endpoint: string): number {
    const latencies = this.apiLatencies.get(endpoint);
    if (!latencies || latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /**
   * Get average latency across all endpoints
   */
  getAverageLatencyAll(): number {
    let totalLatency = 0;
    let totalCount = 0;

    this.apiLatencies.forEach((latencies) => {
      totalLatency += latencies.reduce((a, b) => a + b, 0);
      totalCount += latencies.length;
    });

    return totalCount > 0 ? totalLatency / totalCount : 0;
  }

  /**
   * Get slowest endpoint
   */
  getSlowestEndpoint(): { endpoint: string; avgLatency: number } | null {
    let slowest = { endpoint: '', avgLatency: 0 };

    this.apiLatencies.forEach((latencies, endpoint) => {
      if (latencies.length === 0) return;
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      if (avg > slowest.avgLatency) {
        slowest = { endpoint, avgLatency: avg };
      }
    });

    return slowest.avgLatency > 0 ? slowest : null;
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const slowest = this.getSlowestEndpoint();
    const avgLatency = this.getAverageLatencyAll();

    return {
      pageLoadTime: this.metrics.pageLoadTime,
      averageAPILatency: avgLatency,
      slowestEndpoint: slowest?.endpoint,
      slowestEndpointLatency: slowest?.avgLatency,
      coreWebVitals: this.metrics.coreWebVitals,
      totalAPITracked: this.apiLatencies.size,
      sessionDuration: Date.now() - this.startTime,
    };
  }

  /**
   * Report metrics to monitoring service
   */
  report(endpoint: string = '/api/metrics') {
    if (typeof navigator === 'undefined' || typeof fetch === 'undefined') {
      return;
    }

    try {
      const summary = this.getSummary();

      // Send report asynchronously
      navigator.sendBeacon?.(endpoint, JSON.stringify({
        type: 'performance_metrics',
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        ...summary,
      }));
    } catch (error) {
      console.warn('Failed to report performance metrics:', error);
    }
  }

  /**
   * Log metrics to console (development)
   */
  logMetrics() {
    if (process.env.NODE_ENV === 'development') {
      const summary = this.getSummary();
      console.log('Performance Metrics:', {
        ...summary,
        allMetrics: this.getMetrics(),
      });
    }
  }

  /**
   * Clean up and disconnect observers
   */
  cleanup() {
    this.observers.forEach((observer) => {
      try {
        observer.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    this.observers.clear();
  }
}

/**
 * Hook for React components to measure performance
 */
export function usePerformanceMonitoring(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();

  const trackMetric = (metricName: string, value: number) => {
    monitor.trackCustomMetric(`${componentName}.${metricName}`, value);
  };

  const trackAPICall = (endpoint: string, duration: number) => {
    monitor.trackAPICall(endpoint, duration);
  };

  const getMetrics = () => {
    return monitor.getMetrics();
  };

  return { trackMetric, trackAPICall, getMetrics };
}

/**
 * Higher-order component to measure render time
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceWrappedComponent(props: P) {
    const startTime = React.useRef(Date.now());

    React.useEffect(() => {
      const renderTime = Date.now() - startTime.current;
      const monitor = PerformanceMonitor.getInstance();
      monitor.trackCustomMetric(`${componentName}.renderTime`, renderTime);
    }, []);

    return <Component {...props} />;
  };
}

/**
 * Measure async operation timing
 */
export async function measureAsync<T>(
  operation: () => Promise<T>,
  operationName: string,
  endpoint?: string
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    if (endpoint) {
      PerformanceMonitor.getInstance().trackAPICall(endpoint, duration);
    }

    PerformanceMonitor.getInstance().trackCustomMetric(operationName, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.warn(`${operationName} failed after ${duration}ms`, error);
    throw error;
  }
}

// Auto-report metrics on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const monitor = PerformanceMonitor.getInstance();
    monitor.report();
    monitor.cleanup();
  });
}

export default PerformanceMonitor;
