import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializePerformanceMonitoring } from "./lib/performance-monitor";

const isDev = import.meta.env.DEV;

function logDev(message: string, ...args: unknown[]) {
  if (isDev) {
    console.log(message, ...args);
  }
}

// Global error handlers for unhandled async errors
if (typeof window !== "undefined") {
  // Handle unhandled promise rejections (async errors not caught)
  window.addEventListener("unhandledrejection", (event) => {
    if (isDev) {
      console.error('[Unhandled Promise Rejection]', event.reason);
    }
    // Prevent default browser error handling
    event.preventDefault();
  });

  // Handle global synchronous errors
  window.addEventListener("error", (event) => {
    if (isDev) {
      console.error('[Global Error]', event.error);
    }
  });
}

logDev('[App Startup] Application initializing...');
logDev('[App Startup] Environment:', import.meta.env.MODE);
logDev('[App Startup] Production Mode:', import.meta.env.PROD);

if (typeof window !== "undefined") {
  const searchParams = new URLSearchParams(window.location.search);
  const enablePerfMonitoring = isDev || searchParams.get("perf") === "1" || searchParams.get("perf") === "true";

  // Defer non-essential diagnostics to avoid blocking initial hydration work.
  const deferredInit = () => initializePerformanceMonitoring({
    enabled: enablePerfMonitoring,
    reportOnUnload: enablePerfMonitoring,
  });

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => deferredInit(), { timeout: 2000 });
  } else {
    window.setTimeout(deferredInit, 0);
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('[App Startup] ERROR: Root element not found!');
  throw new Error('Root element not found');
}

function hasServerRenderedMarkup(container: HTMLElement): boolean {
  return Array.from(container.childNodes).some((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return Boolean(node.textContent?.trim());
    }

    // Ignore comment nodes like <!--app-html--> used by the HTML shell.
    return false;
  });
}

logDev('[App Startup] Mounting React app...');
if (hasServerRenderedMarkup(rootElement)) {
  logDev('[App Startup] Detected pre-rendered HTML, hydrating React app...');
  hydrateRoot(rootElement, <App />);
} else {
  logDev('[App Startup] No pre-rendered HTML detected, using createRoot...');
  createRoot(rootElement).render(<App />);
}
logDev('[App Startup] React app mounted successfully');
