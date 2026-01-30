import http from "http";

const req = http.request({
  hostname: "localhost",
  port: 5000,
  path: "/api/public/pages/sdfds",
  method: "GET",
}, (res) => {
  console.log("✅ Connected to 5000!");
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("Response:", JSON.stringify(json, null, 2));
    } catch {
      console.log("Response:", data);
    }
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error("❌ Connection failed:", err.code, err.message);
  process.exit(1);
});

req.setTimeout(5000);
console.log("Connecting to localhost:5000/api/public/pages/sdfds...");
req.end();
