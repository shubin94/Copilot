import express from "express";
import http from "http";

const app = express();

// Add routes before creating server
app.get("/test", (req, res) => {
  res.json({ ok: true });
});

// Create HTTP server
const server = http.createServer(app);

// Listen on 0.0.0.0
server.listen(5003, "0.0.0.0", () => {
  console.log("✅ Direct server listening on 0.0.0.0:5003");
  console.log("server.listening:", server.listening);
  console.log("server.address():", server.address());
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});

console.log("Setup complete");
