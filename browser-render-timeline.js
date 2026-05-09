/**
 * BROWSER RENDER TIMELINE ANALYZER
 * 
 * This script is meant to run in the browser console while the /search page loads.
 * It traces the complete render pipeline and identifies where the 5-8s delay occurs.
 * 
 * Usage:
 * 1. Paste this script into the browser console before navigating to /search
 * 2. Or navigate to /search, then paste and it will listen from that point
 * 3. Watch the console for real-time events
 */

// Create a global timeline object
window.__RENDER_TIMELINE__ = {
  startTime: performance.now(),
  events: [],
  metrics: {},
};

const timeline = window.__RENDER_TIMELINE__;

function recordBrowserEvent(label, details = {}) {
  const now = performance.now() - timeline.startTime;
  const event = { label, timestamp: now, details };
  timeline.events.push(event);

  // Color-coded console output
  let color = "#999";
  if (label.includes("Visible")) color = "#0a0";
  if (label.includes("Error")) color = "#f00";
  if (label.includes("Complete")) color = "#00f";
  if (label.includes("Loading")) color = "#f90";

  console.log(
    `%c[${now.toFixed(0)}ms] ${label}%c${
      Object.keys(details).length > 0 ? " → " + JSON.stringify(details) : ""
    }`,
    `color: ${color}; font-weight: bold;`,
    `color: ${color};`
  );
}

// Monitor API calls
const originalFetch = window.fetch;
window.fetch = function (...args) {
  const url = args[0];

  if (
    typeof url === "string" &&
    url.includes("/api/services")
  ) {
    recordBrowserEvent("API Request Initiated", { url: url.substring(0, 60) });
    const fetchStart = performance.now();

    return originalFetch.apply(this, args).then((response) => {
      const fetchTime = performance.now() - fetchStart;
      recordBrowserEvent("API Response Received", {
        status: response.status,
        duration: fetchTime.toFixed(0),
      });

      return response.clone().json().then((data) => {
        recordBrowserEvent("API Response Parsed", {
          services: data.services?.length || 0,
          totalImages: data.services?.reduce(
            (sum, s) => sum + (s.images?.length || 0),
            0
          ),
        });

        // Return original response as stream
        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      });
    });
  }

  return originalFetch.apply(this, args);
};

// Monitor image loading
const originalImageConstructor = window.Image;
let imageLoadCount = 0;

window.Image = function (...args) {
  const img = new originalImageConstructor(...args);
  const originalLoad = img.addEventListener.bind(img);

  img.addEventListener = function (event, handler, ...rest) {
    if (event === "load") {
      img._onLoadTime = performance.now();
      recordBrowserEvent("Image Load Event Attached", {
        src: img.src?.substring(0, 50) || "pending",
      });

      return originalLoad(event, function (...args) {
        const loadTime = performance.now() - img._onLoadTime;
        imageLoadCount++;
        recordBrowserEvent("Image Loaded", {
          imageNumber: imageLoadCount,
          duration: loadTime.toFixed(0),
          src: img.src?.substring(0, 50),
        });
        handler.apply(this, args);
      }, ...rest);
    }

    if (event === "error") {
      return originalLoad(event, function (...args) {
        recordBrowserEvent("Image Error", {
          src: img.src?.substring(0, 50),
        });
        handler.apply(this, args);
      }, ...rest);
    }

    return originalLoad(event, handler, ...rest);
  };

  return img;
};

// Monitor DOM mutations for React renders
const observer = new MutationObserver((mutations) => {
  const hasServiceCards = mutations.some((m) => {
    if (m.addedNodes.length > 0) {
      // Check for cards or grid elements
      const text = m.addedNodes[0]?.className || "";
      return text.includes("card") || text.includes("grid");
    }
    return false;
  });

  if (hasServiceCards) {
    const cardCount = document.querySelectorAll("[class*='card']").length;
    recordBrowserEvent("Service Cards Mounted", {
      cardCount,
    });
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false,
});

recordBrowserEvent("Browser Timeline Monitor Initialized");

// Helper to get current status
window.getTimelineStatus = function () {
  console.log("\n" + "=".repeat(80));
  console.log("CURRENT RENDER TIMELINE STATUS");
  console.log("=".repeat(80));

  const events = timeline.events;

  console.log("\nEvents so far:");
  events.forEach((e, i) => {
    console.log(
      `  ${i + 1}. [${e.timestamp.toFixed(0)}ms] ${e.label}`,
      e.details
    );
  });

  // Try to calculate some metrics
  const apiStart = events.find((e) => e.label === "API Request Initiated");
  const apiParsed = events.find((e) => e.label === "API Response Parsed");
  const firstCardMount = events.find((e) =>
    e.label.includes("Service Cards Mounted")
  );
  const firstImageLoad = events.find((e) => e.label === "Image Loaded");
  const lastImageLoad = events.filter((e) => e.label === "Image Loaded").pop();

  console.log("\n" + "=".repeat(80));
  console.log("KEY TIMINGS");
  console.log("=".repeat(80));

  if (apiStart && apiParsed) {
    console.log(
      `API Response Time: ${(apiParsed.timestamp - apiStart.timestamp).toFixed(0)}ms`
    );
  }

  if (firstCardMount && apiStart) {
    console.log(
      `Time from API Start to First Card Mount: ${(firstCardMount.timestamp - apiStart.timestamp).toFixed(0)}ms`
    );
  }

  if (firstImageLoad && apiStart) {
    console.log(
      `Time from API Start to First Image Load: ${(firstImageLoad.timestamp - apiStart.timestamp).toFixed(0)}ms`
    );
  }

  if (lastImageLoad) {
    console.log(
      `Time from Start to Last Image Load: ${lastImageLoad.timestamp.toFixed(0)}ms`
    );
  }

  if (firstImageLoad && lastImageLoad) {
    console.log(
      `Total Image Loading Duration: ${(lastImageLoad.timestamp - firstImageLoad.timestamp).toFixed(0)}ms`
    );
  }

  const currentTime = performance.now() - timeline.startTime;
  console.log(`\nCurrent elapsed time: ${currentTime.toFixed(0)}ms`);

  // Estimate when all images will be loaded (if still loading)
  const imageLoadTimes = events
    .filter((e) => e.label === "Image Loaded")
    .map((e) => e.details.duration);
  if (imageLoadTimes.length > 0) {
    const avgImageLoadTime =
      imageLoadTimes.reduce((a, b) => a + Number(b), 0) / imageLoadTimes.length;
    console.log(`Avg Image Load Time: ${avgImageLoadTime.toFixed(0)}ms`);
  }

  console.log("=".repeat(80) + "\n");
};

// Also use Performance Observer to track Core Web Vitals
if ("PerformanceObserver" in window) {
  try {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      recordBrowserEvent("LCP (Largest Contentful Paint)", {
        time: lastEntry.renderTime.toFixed(0),
        size: (lastEntry.size / 1024).toFixed(0) + " KB",
      });
    });

    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        recordBrowserEvent("FID (First Input Delay)", {
          duration: entry.processingDuration.toFixed(0),
        });
      });
    });

    fidObserver.observe({ type: "first-input", buffered: true });

    // Cumulative Layout Shift (CLS)
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          recordBrowserEvent("CLS (Cumulative Layout Shift)", {
            value: entry.value.toFixed(3),
          });
        }
      });
    });

    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    console.error("PerformanceObserver error:", e);
  }
}

// Also capture Navigation Timing data
const navTiming = performance.getEntriesByType("navigation")[0];
if (navTiming) {
  console.log("\n" + "=".repeat(80));
  console.log("NAVIGATION TIMING");
  console.log("=".repeat(80));
  console.log(`DNS Lookup: ${(navTiming.domainLookupEnd - navTiming.domainLookupStart).toFixed(0)}ms`);
  console.log(`TCP Connection: ${(navTiming.connectEnd - navTiming.connectStart).toFixed(0)}ms`);
  console.log(`Request Time: ${(navTiming.responseStart - navTiming.requestStart).toFixed(0)}ms`);
  console.log(`Response Time: ${(navTiming.responseEnd - navTiming.responseStart).toFixed(0)}ms`);
  console.log(`DOM Interactive: ${navTiming.domInteractive.toFixed(0)}ms`);
  console.log(`DOM Content Loaded: ${navTiming.domContentLoadedEventEnd.toFixed(0)}ms`);
  console.log(`Load Complete: ${navTiming.loadEventEnd.toFixed(0)}ms`);
  console.log("=".repeat(80) + "\n");
}

console.log(
  "%cBROWSER RENDER TIMELINE MONITOR ACTIVE",
  "color: #0a0; font-size: 16px; font-weight: bold;"
);
console.log("Call getTimelineStatus() to see current status");
console.log("The timeline will update in real-time as events occur");
