import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { PerformanceMonitor } from "./lib/performance-monitor";

// Initialize Performance Monitoring
const monitor = PerformanceMonitor.getInstance();
console.log('[Performance Monitor] Initialized - tracking Core Web Vitals and API latency');

// Log metrics summary when user leaves the page
window.addEventListener('beforeunload', () => {
  const summary = monitor.getSummary();
  console.log('[Performance Monitor] Session Summary:', summary);
  monitor.report('/api/metrics');
});

createRoot(document.getElementById("root")!).render(<App />);
