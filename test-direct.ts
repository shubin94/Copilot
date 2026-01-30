import http from "http";

const options = {
  hostname: "127.0.0.1",
  port: 5001,
  path: "/api/public/pages/sdfds",
  method: "GET",
};

console.log("Making request to http://127.0.0.1:5001/api/public/pages/sdfds");

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("\n✅ Response:");
    console.log(data);
    process.exit(0);
  });
});

req.on("error", (e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});

req.end();
