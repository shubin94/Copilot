import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { PerformanceMonitor } from "./lib/performance-monitor";

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
