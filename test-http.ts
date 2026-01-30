import http from "http";

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/api/public/pages/sdfds",
  method: "GET",
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log("Headers:", res.headers);
  
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  
  res.on("end", () => {
    console.log("\n✅ SUCCESS - Response body:");
    console.log(data);
    try {
      const json = JSON.parse(data);
      console.log("Parsed JSON:", JSON.stringify(json, null, 2));
    } catch (e) {
      console.log("(Not JSON)");
    }
    process.exit(0);
  });
});

req.on("error", (error) => {
  console.error("❌ Request error:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
});

req.end();
