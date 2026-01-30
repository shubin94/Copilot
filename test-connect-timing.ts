import http from "http";
import express from "express";

const app = express();
app.get("/test", (req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

server.listen(5002, "127.0.0.1", () => {
  console.log("✅ Server callback fired - port 5002");
  
  // Try to connect immediately
  setTimeout(() => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: 5002,
      path: "/test",
      method: "GET",
    }, (res) => {
      console.log("✅ Connection succeeded!");
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.log("Response:", data);
        process.exit(0);
      });
    });
    
    req.on("error", (err) => {
      console.error("❌ Connection failed:", err.message);
      process.exit(1);
    });
    
    req.end();
  }, 100);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});

console.log("Server.listen() called for 127.0.0.1:5002");
