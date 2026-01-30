import "dotenv/config";
import { app } from "./server/app.ts";
import { registerRoutes } from "./server/routes.ts";
import http from "http";

async function test() {
  const server = await registerRoutes(app);
  
  server.listen(5000, "localhost", () => {
    console.log("✅ Server listening on localhost:5000");
    
    // Try to connect back to itself
    setTimeout(() => {
      console.log("Attempting to fetch /api/public/pages/sdfds...");
      const req = http.request({
        hostname: "localhost",
        port: 5000,
        path: "/api/public/pages/sdfds",
        method: "GET",
      }, (res) => {
        console.log("✅ Request succeeded!");
        console.log("Status:", res.statusCode);
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            console.log("Page data:", json);
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
    }, 500);
  });
  
  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

test();
console.log("Starting test...");
