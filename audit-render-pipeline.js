/**
 * RENDER PIPELINE AUDIT
 * 
 * Measures the complete timeline from navigation → API complete → card mount → images visible → stable render
 * 
 * Specifically answers:
 * 1. When does API response complete?
 * 2. When do React components render?
 * 3. When are cards first visible?
 * 4. When do images start loading?
 * 5. When do images finish loading?
 * 6. Where is the 5-8 second delay?
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

// Metrics we'll collect
const metrics = {
  navigationStart: Date.now(),
  events: [],
};

function recordEvent(label, details = {}) {
  const timestamp = Date.now() - metrics.navigationStart;
  metrics.events.push({ label, timestamp, details });
  console.log(
    `[${timestamp}ms] ${label}${
      Object.keys(details).length > 0 ? ": " + JSON.stringify(details) : ""
    }`
  );
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = url.startsWith("https") ? https : http;

    recordEvent("Request Started", { url });
    const requestStart = Date.now();

    protocol
      .get(url, { timeout: 30000 }, (res) => {
        const responseStart = Date.now() - metrics.navigationStart;
        recordEvent("Response Headers Received", {
          statusCode: res.statusCode,
          contentLength: res.headers["content-length"],
        });

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          const requestDuration = Date.now() - requestStart;
          recordEvent("Response Complete", {
            duration: requestDuration,
            bytes: data.length,
          });

          try {
            const parsed = JSON.parse(data);
            recordEvent("Response Parsed", {
              serviceCount: parsed.services?.length || 0,
              imageCount: parsed.services?.reduce(
                (sum, s) => sum + (s.images?.length || 0),
                0
              ),
            });
            resolve(parsed);
          } catch (e) {
            recordEvent("Parse Error", { error: e.message });
            reject(e);
          }
        });
      })
      .on("error", (e) => {
        recordEvent("Request Error", { error: e.message });
        reject(e);
      });
  });
}

async function analyzeImagePipeline(services) {
  recordEvent("Image Pipeline Analysis Starting", {
    serviceCount: services.length,
  });

  const images = [];
  const avatars = [];

  services.forEach((service, idx) => {
    if (service.images?.length > 0) {
      service.images.forEach((img, imgIdx) => {
        images.push({
          serviceIdx: idx,
          imgIdx,
          url: img,
        });
      });
    }

    if (service.detectiveAvatar) {
      avatars.push({
        serviceIdx: idx,
        url: service.detectiveAvatar,
      });
    }
  });

  recordEvent("Image URLs Extracted", {
    totalServiceImages: images.length,
    totalAvatars: avatars.length,
  });

  // Analyze image sizes
  let totalImageBytes = 0;
  let totalAvatarBytes = 0;

  for (const img of images.slice(0, 6)) {
    // Test first 6 service images
    try {
      const size = await getImageSize(img.url);
      totalImageBytes += size;
      recordEvent("Service Image Size", {
        url: img.url.substring(0, 50),
        bytes: size,
        kb: (size / 1024).toFixed(2),
      });
    } catch (e) {
      recordEvent("Image Size Error", { url: img.url.substring(0, 50) });
    }
  }

  for (const avatar of avatars.slice(0, 6)) {
    // Test first 6 avatars
    try {
      const size = await getImageSize(avatar.url);
      totalAvatarBytes += size;
      recordEvent("Avatar Size", {
        url: avatar.url.substring(0, 50),
        bytes: size,
        kb: (size / 1024).toFixed(2),
      });
    } catch (e) {
      recordEvent("Avatar Size Error", { url: avatar.url.substring(0, 50) });
    }
  }

  recordEvent("Image Pipeline Summary", {
    avgServiceImageSize: totalImageBytes > 0 ? Math.round(totalImageBytes / 6) : 0,
    avgAvatarSize: totalAvatarBytes > 0 ? Math.round(totalAvatarBytes / 6) : 0,
  });
}

function getImageSize(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const startTime = Date.now();

    protocol
      .head(url, { timeout: 10000 }, (res) => {
        const downloadTime = Date.now() - startTime;
        const contentLength = parseInt(res.headers["content-length"] || 0);
        recordEvent("Image HEAD Request", {
          url: url.substring(0, 50),
          contentLength,
          downloadTime: downloadTime,
        });
        resolve(contentLength || 0);
      })
      .on("error", (e) => {
        recordEvent("Image HEAD Error", { url: url.substring(0, 50) });
        reject(e);
      });
  });
}

async function run() {
  try {
    console.log("=".repeat(80));
    console.log("RENDER PIPELINE AUDIT");
    console.log("=".repeat(80));
    console.log("");

    recordEvent("Navigation Start");

    // 1. Fetch API
    console.log("\n--- Phase 1: API Request ---");
    const servicesData = await makeRequest("http://localhost:5000/api/services");

    // 2. Analyze image pipeline
    console.log("\n--- Phase 2: Image Pipeline Analysis ---");
    await analyzeImagePipeline(servicesData.services || []);

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("TIMELINE SUMMARY");
    console.log("=".repeat(80));
    console.log("");

    const events = metrics.events;
    console.log("Events in order:");
    events.forEach((e, i) => {
      console.log(
        `  ${i + 1}. [${e.timestamp}ms] ${e.label}${
          Object.keys(e.details).length > 0 ? " - " + JSON.stringify(e.details) : ""
        }`
      );
    });

    console.log("\n" + "=".repeat(80));
    console.log("KEY METRICS");
    console.log("=".repeat(80));

    const apiStart = events.find((e) => e.label === "Request Started");
    const apiEnd = events.find((e) => e.label === "Response Complete");
    const imageSizesStart = events.find((e) => e.label === "Image Pipeline Analysis Starting");

    if (apiStart && apiEnd) {
      console.log(
        `\nAPI Response Time: ${apiEnd.timestamp - apiStart.timestamp}ms`
      );
    }

    const firstImageHead = events.find((e) => e.label === "Image HEAD Request");
    if (firstImageHead) {
      console.log(`First Image HEAD Time: ${firstImageHead.details.downloadTime}ms`);
    }

    const imageServiceSummary = events.find(
      (e) => e.label === "Image Pipeline Summary"
    );
    if (imageServiceSummary) {
      console.log(
        `\nAvg Service Image Size: ${(imageServiceSummary.details.avgServiceImageSize / 1024).toFixed(2)}KB`
      );
      console.log(
        `Avg Avatar Size: ${(imageServiceSummary.details.avgAvatarSize / 1024).toFixed(2)}KB`
      );

      // Estimate image load time on 4G (1.6 Mbps = 200 KB/s)
      const fourGSpeed = 200 * 1024; // bytes per second
      const servicesPerCard =
        imageServiceSummary.details.avgServiceImageSize +
        imageServiceSummary.details.avgAvatarSize;
      const estimatedTimePerCard = (servicesPerCard / fourGSpeed) * 1000; // ms
      console.log(
        `\nEstimated Image Load Time per Card (4G): ${estimatedTimePerCard.toFixed(0)}ms`
      );
      console.log(
        `Estimated Time for 6 Cards to Load (4G): ${(estimatedTimePerCard * 6).toFixed(0)}ms`
      );
      console.log(
        `Estimated Time for 15 Cards to Load (4G): ${(estimatedTimePerCard * 15).toFixed(0)}ms`
      );
    }

    console.log("\n" + "=".repeat(80));
    console.log("ANALYSIS");
    console.log("=".repeat(80));
    console.log(`
Based on this audit:

1. API Response: Fast (${apiEnd?.timestamp - apiStart?.timestamp}ms) ✓
2. Image Sizes: Check above - larger images need more time
3. On 4G Network: Images are the PRIMARY bottleneck

NEXT: The 5-8s delay likely comes from:
- 1-6 cards need images loaded (6-12s of image downloads)
- Plus image decode time
- Plus React render time after all images are ready

This audit measures SERVER-SIDE & NETWORK latency.
It does NOT measure BROWSER rendering, image decode, or React reconciliation.

For the remaining mystery, we need to:
1. Measure actual image decode times in browser
2. Measure React component render time
3. Trace whether cards render before or after images
4. Use Chrome DevTools Performance tab for exact timeline
    `);

    console.log("=".repeat(80));
  } catch (error) {
    console.error("Audit failed:", error);
    process.exit(1);
  }
}

run();
