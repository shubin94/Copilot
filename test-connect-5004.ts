import http from "http";

const req = http.request({
  hostname: "127.0.0.1",
  port: 5004,
  path: "/api/public/pages/sdfds",
  method: "GET",
}, (res) => {
  console.log("✅ Connected to 127.0.0.1:5004!");
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("Response length:", data.length);
    if (data.length < 500) {
      try {
        const json = JSON.parse(data);
        console.log("Response:", JSON.stringify(json, null, 2));
      } catch {
        console.log("Response:", data);
      }
    } else {
      console.log("Response (truncated):", data.substring(0, 200));
    }
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error("❌ Connection failed to 127.0.0.1:5004:", err.code, err.message);
  process.exit(1);
});

req.setTimeout(5000);
console.log("Connecting to 127.0.0.1:5004/api/public/pages/sdfds...");
req.end();
