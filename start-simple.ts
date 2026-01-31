import express from "express";
import http from "http";
import { registerRoutes } from "./server/routes.ts";

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
  process.exit(1);
});

async function start() {
  console.log("🚀 Starting minimal server...");
  
  try {
    const app = express();
    console.log("Express app created");
    const server = await registerRoutes(app);
    console.log("Routes registered");
    
    const PORT = 5001;
    const HOST = "127.0.0.1";
    
    // Add a simple test route
    app.get("/test", (req, res) => {
      console.log("[server] GET /test");
      res.json({ status: "ok" });
    });
    
    // Add request logging
    app.use((req, res, next) => {
      console.log(`[server] ${req.method} ${req.path}`);
      next();
    });
    
    console.log(`Attempting to listen on ${HOST}:${PORT}`);
    console.log("Server object:", {
      listening: server.listening,
      address: server.address(),
    });
    
    const listeningServer = server.listen(PORT, HOST, () => {
      console.log(`✅ Server listening on http://${HOST}:${PORT}`);
      console.log("After listen callback - server.listening:", server.listening);
      console.log("Server address:", server.address());
      console.log("Server ready to accept requests");
    });
    
    // Check status after a small delay
    setTimeout(() => {
      console.log("1 second later - server.listening:", server.listening);
      console.log("Server address:", server.address());
    }, 1000);
    
    listeningServer.on("error", (error) => {
      console.error("❌ Server listen error:", error);
      process.exit(1);
    });
    
    listeningServer.on("close", () => {
      console.error("❌ Server closed unexpectedly!");
      process.exit(1);
    });
    
    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });
    
    console.log("Setup complete, server is running...");
    
  } catch (error) {
    console.error("❌ Failed to start:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "");
    process.exit(1);
  }
}

start().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
