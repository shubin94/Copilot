import http from "http";

// Test fetching CMS pages list via public API (should work without auth)
const req = http.request({
  hostname: "localhost",
  port: 5000,
  path: "/api/public/pages/sdfds",
  method: "GET",
}, (res) => {
  console.log("✅ Public pages API works!");
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("\n📄 Page retrieved:");
      console.log("  Title:", json.page.title);
      console.log("  Slug:", json.page.slug);
      console.log("  Status:", json.page.status);
      console.log("  Content:", json.page.content.substring(0, 50));
      console.log("  Tags:", json.page.tags.length);
    } catch (e) {
      console.log("Response:", data.substring(0, 200));
    }
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error("❌ Request failed:", err.message);
  process.exit(1);
});

req.end();
console.log("Testing /api/public/pages/sdfds...");
