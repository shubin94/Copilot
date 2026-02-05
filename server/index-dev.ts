import "dotenv/config";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import type { Express } from "express";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";

import viteConfig from "../vite.config";

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

(async () => {
  try {
    const { loadAllSecrets } = await import("./lib/secretsLoader.ts");
    await loadAllSecrets();

    const { default: runApp } = await import("./app.ts");
    const { config, validateConfig } = await import("./config.ts");
    const { validateDatabase } = await import("./startup.ts");

    if (config.env.isProd) {
      validateConfig();
    }
    await validateDatabase();
    const server = await runApp(setupVite);
    console.log(`✅ Server fully started and listening on port ${config.server.port}`);

    process.stdin.resume();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})().catch((err) => {
  console.error('Fatal async error:', err);
  process.exit(1);
});

// Handle unhandled errors gracefully
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  // Don't exit for unhandled rejections
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Don't exit - try to keep server running
});

// Prevent premature exit
setInterval(() => {}, 1000);
