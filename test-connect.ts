import http from "http";

const req = http.request({
  hostname: "127.0.0.1",
  port: 5001,
  path: "/test",
  method: "GET",
}, (res) => {
  console.log("✅ Connected!");
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("Response:", data);
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error("❌ Connection failed:", err.code, err.message);
  process.exit(1);
});

req.on("timeout", () => {
  console.error("❌ Request timeout");
  req.destroy();
  process.exit(1);
});

req.setTimeout(5000);
console.log("Connecting to 127.0.0.1:5001/test...");
req.end();
