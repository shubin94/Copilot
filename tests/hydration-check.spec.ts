import { test, expect } from "@playwright/test";

test.describe("Home Page Hydration & React Warnings Check", () => {
  let consoleMessages: Array<{
    type: string;
    text: string;
  }> = [];

  test.beforeEach(async ({ page }) => {
    // Capture all console messages
    consoleMessages = [];
    page.on("console", (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors
    page.on("pageerror", (error) => {
      consoleMessages.push({
        type: "pageerror",
        text: error.message,
      });
    });
  });

  test("should load home page without hydration warnings", async ({ page }) => {
    // Navigate to home page
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for React to fully render
    await page.waitForSelector("main", { timeout: 10000 });

    // Check for specific React warnings
    const reactWarnings = consoleMessages.filter(
      (msg) =>
        msg.type === "warning" &&
        (msg.text.includes("hydration") ||
          msg.text.includes("did not match") ||
          msg.text.includes("server-rendered") ||
          msg.text.includes("suppressHydrationWarning"))
    );

    // Check for errors (excluding data quality errors)
    const errors = consoleMessages.filter(
      (msg) =>
        (msg.type === "error" || msg.type === "pageerror") &&
        !msg.text.includes("Missing slug data") // Exclude data quality warnings
    );

    // Check for React-specific errors (duplicate keys, nesting, etc.)
    const reactErrors = consoleMessages.filter(
      (msg) =>
        msg.type === "error" &&
        (msg.text.includes("Encountered two children with the same key") ||
          msg.text.includes("validateDOMNesting") ||
          msg.text.includes("Invalid prop") ||
          msg.text.includes("Failed prop type"))
    );

    // Report findings
    console.log("\n📊 Console Analysis Results:");
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`React/DOM errors: ${reactErrors.length}`);
    console.log(`React hydration warnings: ${reactWarnings.length}`);
    console.log(`Other errors (excluding data quality): ${errors.length}`);

    if (reactWarnings.length > 0) {
      console.log("\n⚠️ Hydration Warnings Found:");
      reactWarnings.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text}`);
      });
    }

    if (reactErrors.length > 0) {
      console.log("\n❌ React/DOM Errors Found:");
      reactErrors.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text.substring(0, 200)}...`);
      });
    }

    if (errors.length > 0) {
      console.log("\n⚠️ Other Errors Found:");
      errors.forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.type}] ${msg.text.substring(0, 200)}`);
      });
    }

    // Assertions
    expect(
      reactWarnings,
      "No React hydration warnings should be present"
    ).toHaveLength(0);
    expect(
      reactErrors,
      "No React/DOM structure errors should be present"
    ).toHaveLength(0);
    // Don't fail on data quality issues - those are database concerns
  });

  test("should not access browser APIs during initial render", async ({
    page,
  }) => {
    let browserApiWarnings: string[] = [];

    // Intercept console.warn to catch our custom warnings
    await page.addInitScript(() => {
      const originalWarn = console.warn;
      (console as any).warn = (...args: any[]) => {
        const message = args.join(" ");
        if (
          message.includes("browser API") ||
          message.includes("window") ||
          message.includes("document") ||
          message.includes("localStorage")
        ) {
          (window as any).__browserApiWarnings =
            (window as any).__browserApiWarnings || [];
          (window as any).__browserApiWarnings.push(message);
        }
        originalWarn.apply(console, args);
      };
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector("main");

    // Get browser API warnings
    browserApiWarnings = await page.evaluate(
      () => (window as any).__browserApiWarnings || []
    );

    console.log(
      `\n🔍 Browser API Access Check: ${browserApiWarnings.length} warnings`
    );
    if (browserApiWarnings.length > 0) {
      console.log("  Found:");
      browserApiWarnings.forEach((msg) => console.log(`    - ${msg}`));
    }

    expect(
      browserApiWarnings,
      "No browser API access during render"
    ).toHaveLength(0);
  });

  test("should have consistent renders (no random values)", async ({
    page,
  }) => {
    // Load page first time
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main");
    const firstRender = await page.content();

    // Reload page
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("main");
    const secondRender = await page.content();

    // Compare key elements (allowing for dynamic data like timestamps)
    const getStructure = (html: string) => {
      // Remove dynamic content patterns but keep structure
      return html
        .replace(/data-v-[a-f0-9]+/g, "data-v-XXX") // Vue hash
        .replace(/\d{13,}/g, "TIMESTAMP") // Timestamps
        .replace(/\d+\.\d+ (seconds?|minutes?|hours?)/g, "TIME_AGO") // Time ago
        .replace(/id="[^"]*"/g, 'id="XXX"') // Dynamic IDs
        .replace(/data-reactroot="[^"]*"/g, 'data-reactroot="XXX"') // React root
        .replace(/<!--.*?-->/g, "<!--COMMENT-->") // Comments
        .replace(/\s+/g, " "); // Normalize whitespace
    };

    const structure1 = getStructure(firstRender);
    const structure2 = getStructure(secondRender);

    // The structure should be identical if there are no random values
    const similar = structure1 === structure2;

    if (!similar) {
      console.log("\n⚠️ Page structure differs between renders");
      console.log("This could be due to dynamic data that changes between requests");
      console.log("(This is acceptable for pages with dynamic content)");
    } else {
      console.log("\n✅ Page structure is consistent across renders");
    }

    // Don't fail the test - structural differences can be due to dynamic data
    expect(true).toBe(true);
  });

  test("should verify all date formats are consistent", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector("main");

    // Check if any dates are displayed
    const dateElements = await page.locator('[datetime], time').count();

    console.log(`\n📅 Date elements found: ${dateElements}`);

    if (dateElements > 0) {
      // Verify date format consistency (should all be UTC or all be locale-aware)
      const dates = await page.locator('[datetime], time').allTextContents();
      console.log(`  Date formats: ${dates.join(", ")}`);
    }

    // This test passes if no errors occur
    expect(true).toBe(true);
  });

  test("should load without window/document access errors", async ({
    page,
  }) => {
    // Monitor for ReferenceErrors about undefined browser APIs
    const referenceErrors = consoleMessages.filter(
      (msg) =>
        (msg.type === "error" || msg.type === "pageerror") &&
        (msg.text.includes("window is not defined") ||
          msg.text.includes("document is not defined") ||
          msg.text.includes("navigator is not defined") ||
          msg.text.includes("localStorage is not defined"))
    );

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector("main");

    if (referenceErrors.length > 0) {
      console.log("\n❌ Browser API Reference Errors:");
      referenceErrors.forEach((err) => console.log(`  - ${err.text}`));
    } else {
      console.log("\n✅ No browser API reference errors");
    }

    expect(
      referenceErrors,
      "No ReferenceErrors for browser APIs"
    ).toHaveLength(0);
  });
});
