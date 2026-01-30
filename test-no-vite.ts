import "dotenv/config";
import { app } from "./server/app.ts";
import { registerRoutes } from "./server/routes.ts";

async function startServerNoVite() {
  console.log("Starting server without Vite...");
  
  const server = await registerRoutes(app);
  console.log("Routes registered");
  
  const port = 5004;
  const host = "127.0.0.1";
  
  console.log(`Listening on ${host}:${port}`);
  
  return new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => {
      console.log(`✅ Server successfully listening on ${host}:${port}`);
      console.log("server.listening:", server.listening);
      resolve();
    });
    
    server.on("error", (err) => {
      console.error("Server error:", err);
      reject(err);
    });
  });
}

startServerNoVite()
  .then(() => {
    console.log("Server is running!");
  })
  .catch(err => {
    console.error("Failed:", err);
    process.exit(1);
  });
