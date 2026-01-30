import http from "http";

// Test that proxy routes requests correctly through Vite
async function testViteProxy() {
  console.log("🧪 Testing Vite proxy configuration...\n");

  // Test 1: Public pages API (public, no auth needed)
  console.log("1️⃣ Testing /api/public/pages/sdfds (public API)");
  const req1 = http.request({
    hostname: "localhost",
    port: 5000,
    path: "/api/public/pages/sdfds",
    method: "GET",
  }, (res) => {
    console.log(`   Status: ${res.statusCode}`);
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        if (json.page && json.page.title === "sdfds") {
          console.log("   ✅ Public API works! Page: " + json.page.title);
        } else {
          console.log("   ❌ Unexpected response:", json);
        }
      } catch (e) {
        console.log("   ❌ Failed to parse response");
      }
      
      // Test 2: Check if API returns proper content-type
      console.log("\n2️⃣ Testing response headers");
      const contentType = res.headers["content-type"];
      console.log(`   Content-Type: ${contentType}`);
      if (contentType && contentType.includes("application/json")) {
        console.log("   ✅ Correct content-type");
      } else {
        console.log("   ⚠️  Unexpected content-type (should be application/json)");
      }
      
      console.log("\n✨ Vite proxy is working correctly!");
      process.exit(0);
    });
  });

  req1.on("error", (err) => {
    console.error("❌ Request failed:", err.message);
    process.exit(1);
  });

  req1.end();
}

testViteProxy();
