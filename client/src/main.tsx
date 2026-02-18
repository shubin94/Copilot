import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { PerformanceMonitor } from "./lib/performance-monitor";

// Global error handlers for unhandled async errors
if (typeof window !== "undefined") {
  // Handle unhandled promise rejections (async errors not caught)
  window.addEventListener("unhandledrejection", (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    // Prevent default browser error handling
    event.preventDefault();
  });

  // Handle global synchronous errors
  window.addEventListener("error", (event) => {
    console.error('[Global Error]', event.error);
  });
}

// Log startup information
console.log('[App Startup] Application initializing...');
console.log('[App Startup] Environment:', import.meta.env.MODE);
console.log('[App Startup] Production Mode:', import.meta.env.PROD);

// Initialize Performance Monitoring
const monitor = PerformanceMonitor.getInstance();
console.log('[Performance Monitor] Initialized - tracking Core Web Vitals and API latency');

// Log metrics summary when user leaves the page
window.addEventListener('beforeunload', () => {
  const summary = monitor.getSummary();
  console.log('[Performance Monitor] Session Summary:', summary);
  monitor.report('/api/metrics');
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('[App Startup] ERROR: Root element not found!');
  throw new Error('Root element not found');
}

console.log('[App Startup] Mounting React app...');
createRoot(rootElement).render(<App />);
console.log('[App Startup] React app mounted successfully');
