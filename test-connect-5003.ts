import http from "http";

const req = http.request({
  hostname: "127.0.0.1",
  port: 5003,
  path: "/test",
  method: "GET",
}, (res) => {
  console.log("✅ Connected to 5003!");
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("Response:", data);
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error("❌ Connection failed to 5003:", err.code, err.message);
  process.exit(1);
});

req.setTimeout(3000);
console.log("Connecting to 127.0.0.1:5003/test...");
req.end();
