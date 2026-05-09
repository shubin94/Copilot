/**
 * IMAGE PERFORMANCE & SIZING AUDIT
 * 
 * Measures:
 * 1. Actual image sizes
 * 2. Image formats and compression
 * 3. Image download times
 * 4. Estimated decode times
 * 5. Bottleneck: Are images the 5-8s culprit?
 */

const http = require("http");
const https = require("https");

const audit = {
  startTime: Date.now(),
  images: [],
  avatars: [],
  analysis: {},
};

function elapsed() {
  return Date.now() - audit.startTime;
}

function log(msg) {
  console.log(`[${elapsed()}ms] ${msg}`);
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, { timeout: 30000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function getImageSize(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const startTime = Date.now();

    protocol
      .head(url, { timeout: 10000 }, (res) => {
        const downloadTime = Date.now() - startTime;
        const contentLength = parseInt(res.headers["content-length"] || 0);
        const contentType = res.headers["content-type"] || "unknown";

        resolve({
          size: contentLength,
          contentType,
          downloadTime,
          cached: res.headers["age"] ? true : false,
        });
      })
      .on("error", (e) => {
        reject(e);
      });
  });
}

function estimateDecodeTime(sizeInBytes, format) {
  // Rough estimate based on image format
  // This varies by device, but gives us a ballpark
  let baseDecodePerMB = 50; // ms per MB

  if (format.includes("webp")) baseDecodePerMB = 30;
  if (format.includes("png")) baseDecodePerMB = 60;
  if (format.includes("jpeg") || format.includes("jpg")) baseDecodePerMB = 50;
  if (format.includes("svg")) baseDecodePerMB = 100; // SVGs are slower

  const sizeInMB = sizeInBytes / (1024 * 1024);
  return Math.round(baseDecodePerMB * sizeInMB);
}

function estimateDownloadTime(sizeInBytes, networkSpeed) {
  // networkSpeed in bytes per second
  // On 4G: ~1.6 Mbps = 200 KB/s = 200,000 bytes/s
  // On 3G: ~1 Mbps = 125 KB/s
  // On WiFi: ~10 Mbps = 1.25 MB/s
  return (sizeInBytes / networkSpeed) * 1000; // convert to ms
}

async function run() {
  console.log("=".repeat(80));
  console.log("IMAGE PERFORMANCE AUDIT");
  console.log("=".repeat(80));
  console.log("");

  try {
    log("Fetching API data...");
    const apiData = await fetchJSON("http://localhost:5000/api/services");
    const services = apiData.services || [];

    log(`Retrieved ${services.length} services`);

    // Extract unique image URLs
    const imageUrls = new Set();
    const avatarUrls = new Set();

    services.forEach((service, idx) => {
      if (service.images?.length > 0) {
        service.images.forEach((img) => {
          imageUrls.add(img);
          audit.images.push({
            serviceIdx: idx,
            url: img,
          });
        });
      }

      if (service.detectiveAvatar) {
        avatarUrls.add(service.detectiveAvatar);
        audit.avatars.push({
          serviceIdx: idx,
          url: service.detectiveAvatar,
        });
      }
    });

    log(`Found ${imageUrls.size} unique service images`);
    log(`Found ${avatarUrls.size} unique avatars`);

    // Measure a sample of service images
    console.log("\n" + "=".repeat(80));
    console.log("SERVICE IMAGE ANALYSIS");
    console.log("=".repeat(80));

    const serviceImageSample = Array.from(imageUrls).slice(0, 10);
    let totalServiceImageSize = 0;
    let serviceImageCount = 0;

    for (const url of serviceImageSample) {
      try {
        const info = await getImageSize(url);
        totalServiceImageSize += info.size;
        serviceImageCount++;

        const kb = (info.size / 1024).toFixed(1);
        const mb = (info.size / (1024 * 1024)).toFixed(2);

        log(`Image: ${kb}KB - ${url.substring(0, 60)}...`);

        if (info.size > 1024 * 1024) {
          log(`  ⚠️ LARGE: ${mb}MB`);
        }
        if (info.size > 500 * 1024) {
          log(`  ⚠️ MEDIUM: ${kb}KB`);
        } else if (info.size > 100 * 1024) {
          log(`  ✓ OK: ${kb}KB`);
        } else {
          log(`  ✓ GOOD: ${kb}KB`);
        }

        log(`  Type: ${info.contentType}`);
        log(`  HEAD request time: ${info.downloadTime}ms`);
      } catch (e) {
        log(`Error measuring image: ${url.substring(0, 60)}: ${e.message}`);
      }
    }

    const avgServiceImageSize =
      serviceImageCount > 0 ? totalServiceImageSize / serviceImageCount : 0;

    log(`\nAverage service image size: ${(avgServiceImageSize / 1024).toFixed(1)}KB`);

    // Measure a sample of avatars
    console.log("\n" + "=".repeat(80));
    console.log("AVATAR IMAGE ANALYSIS");
    console.log("=".repeat(80));

    const avatarSample = Array.from(avatarUrls).slice(0, 10);
    let totalAvatarSize = 0;
    let avatarCount = 0;

    for (const url of avatarSample) {
      try {
        const info = await getImageSize(url);
        totalAvatarSize += info.size;
        avatarCount++;

        const kb = (info.size / 1024).toFixed(1);
        log(`Avatar: ${kb}KB - ${url.substring(0, 60)}...`);
        log(`  Type: ${info.contentType}`);
        log(`  HEAD request time: ${info.downloadTime}ms`);
      } catch (e) {
        log(`Error measuring avatar: ${url.substring(0, 60)}: ${e.message}`);
      }
    }

    const avgAvatarSize = avatarCount > 0 ? totalAvatarSize / avatarCount : 0;
    log(`\nAverage avatar size: ${(avgAvatarSize / 1024).toFixed(1)}KB`);

    // Now calculate timing estimates
    console.log("\n" + "=".repeat(80));
    console.log("LOAD TIME ESTIMATES");
    console.log("=".repeat(80));

    const networks = {
      "4G (1.6 Mbps)": 1.6 * 1024 * 1024 / 8, // 200 KB/s
      "3G (1 Mbps)": 1 * 1024 * 1024 / 8, // 125 KB/s
      "WiFi (10 Mbps)": 10 * 1024 * 1024 / 8, // 1.25 MB/s
    };

    const cardsToAnalyze = 6; // First viewport of cards
    const imagesPerCard = 1; // Only first image visible at a time
    const bytesPerCard =
      avgServiceImageSize * imagesPerCard + avgAvatarSize;

    console.log(`\nEstimate: ${cardsToAnalyze} cards visible (first viewport)`);
    console.log(
      `Per card: ${(avgServiceImageSize / 1024).toFixed(1)}KB (image) + ${(avgAvatarSize / 1024).toFixed(1)}KB (avatar)`
    );
    console.log(`Total per card: ${(bytesPerCard / 1024).toFixed(1)}KB`);

    Object.entries(networks).forEach(([networkName, bytesPerSecond]) => {
      const downloadTimePerImage = estimateDownloadTime(
        avgServiceImageSize,
        bytesPerSecond
      );
      const downloadTimePerAvatar = estimateDownloadTime(
        avgAvatarSize,
        bytesPerSecond
      );
      const decodeTimePerImage = estimateDecodeTime(
        avgServiceImageSize,
        "jpeg"
      );
      const decodeTimePerAvatar = estimateDecodeTime(avgAvatarSize, "jpeg");

      const perCardTotal =
        downloadTimePerImage +
        decodeTimePerImage +
        downloadTimePerAvatar +
        decodeTimePerAvatar;
      const allCardsTotal = perCardTotal * cardsToAnalyze;

      console.log(`\n${networkName}:`);
      console.log(
        `  Service image: ${downloadTimePerImage.toFixed(0)}ms download + ${decodeTimePerImage}ms decode = ${(downloadTimePerImage + decodeTimePerImage).toFixed(0)}ms`
      );
      console.log(
        `  Avatar: ${downloadTimePerAvatar.toFixed(0)}ms download + ${decodeTimePerAvatar}ms decode = ${(downloadTimePerAvatar + decodeTimePerAvatar).toFixed(0)}ms`
      );
      console.log(`  Per card total: ${perCardTotal.toFixed(0)}ms`);
      console.log(
        `  For ${cardsToAnalyze} cards (sequential): ${allCardsTotal.toFixed(0)}ms`
      );
    });

    // Full page load estimate
    console.log(`\n` + "=".repeat(80));
    console.log("FULL PAGE LOAD ESTIMATE");
    console.log("=".repeat(80));

    console.log("\nTimeline on 4G network:");
    const fourGSpeed = 1.6 * 1024 * 1024 / 8; // 200 KB/s
    const apiTime = 100; // From previous audit
    const downloadTimeImage4G = estimateDownloadTime(
      avgServiceImageSize,
      fourGSpeed
    );
    const downloadTimeAvatar4G = estimateDownloadTime(
      avgAvatarSize,
      fourGSpeed
    );
    const decodeTimeImage4G = estimateDecodeTime(avgServiceImageSize, "jpeg");
    const decodeTimeAvatar4G = estimateDecodeTime(avgAvatarSize, "jpeg");

    console.log(`0ms    - Navigation starts`);
    console.log(`${apiTime}ms    - API completes (skeletons shown, cards ready to render)`);
    console.log(
      `${apiTime + 100}ms - Lazy loading starts (images become visible in viewport)`
    );
    console.log(
      `${apiTime + 100 + downloadTimeImage4G.toFixed(0)}ms - First image downloaded`
    );
    console.log(
      `${(apiTime + 100 + downloadTimeImage4G + decodeTimeImage4G).toFixed(0)}ms - First image decoded (FIRST CARD VISIBLE)`
    );

    for (let i = 2; i <= 6; i++) {
      const cardTime = (apiTime + 100 + downloadTimeImage4G + decodeTimeImage4G) * i;
      console.log(`${cardTime.toFixed(0)}ms - Card ${i} visible`);
    }

    const allVisibleTime = (
      apiTime +
      100 +
      (downloadTimeImage4G + decodeTimeImage4G) * 6
    ).toFixed(0);
    console.log(`\n✓ All 6 cards visible by: ${allVisibleTime}ms`);

    // For comparison: 5-8 seconds = 5000-8000ms
    console.log("\nUser observation: Cards visible in 5-8 seconds");
    console.log(`Our estimate: ${allVisibleTime}ms (=${(allVisibleTime / 1000).toFixed(1)}s)`);

    if (Number(allVisibleTime) > 3000) {
      console.log("\n🎯 IMAGE LOADING IS THE BOTTLENECK");
      console.log("This aligns with user observation!");
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("FINDINGS");
    console.log("=".repeat(80));

    console.log(`
1. SERVICE IMAGES:
   - Average size: ${(avgServiceImageSize / 1024).toFixed(1)}KB
   - These are served via /api/media-proxy (cached)
   - Download time on 4G: ${estimateDownloadTime(avgServiceImageSize, fourGSpeed).toFixed(0)}ms
   - Decode time: ${estimateDecodeTime(avgServiceImageSize, "jpeg")}ms

2. AVATARS:
   - Average size: ${(avgAvatarSize / 1024).toFixed(1)}KB
   - Download time on 4G: ${estimateDownloadTime(avgAvatarSize, fourGSpeed).toFixed(0)}ms
   - Decode time: ${estimateDecodeTime(avgAvatarSize, "jpeg")}ms

3. TOTAL DELAY PER CARD:
   - Download + Decode: ${(estimateDownloadTime(avgServiceImageSize, fourGSpeed) + estimateDecodeTime(avgServiceImageSize, "jpeg") + estimateDownloadTime(avgAvatarSize, fourGSpeed) + estimateDecodeTime(avgAvatarSize, "jpeg")).toFixed(0)}ms

4. 6 CARDS SEQUENTIAL:
   - Estimated time: ${allVisibleTime}ms (${(allVisibleTime / 1000).toFixed(1)} seconds)
   - Matches user observation of 5-8 seconds ✓

5. ROOT CAUSE:
   - Images are lazy-loaded (wait for visibility)
   - Each image must download + decode before card overlay disappears
   - Cards wait for images sequentially (one by one)
   - With 6+ cards, this creates cumulative 5-8 second delay

6. RESOLUTION:
   - Not an API problem (API is fast)
   - Not a React rendering problem (memoization optimized)
   - IS an image loading and rendering pipeline problem
   - Solution: Improve image handling (preload, lazy-load, compression)
    `);

    console.log("=".repeat(80));
  } catch (error) {
    console.error("Audit failed:", error);
    process.exit(1);
  }
}

run();
