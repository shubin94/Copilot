import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Ensure vendor packages are in separate chunks
          if (id.includes('node_modules')) {
            // Core vendors
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react';
            }
            if (id.includes('node_modules/wouter')) {
              return 'router';
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'query';
            }
            if (id.includes('node_modules/framer-motion')) {
              return 'animation';
            }
            
            // Split Radix into smaller chunks - this is 274 KB total!
            if (id.includes('node_modules/@radix-ui')) {
              if (id.includes('dialog') || id.includes('tooltip') || id.includes('popover') || id.includes('alert-dialog') || id.includes('hover-card')) {
                return 'radix-overlays';
              }
              if (id.includes('dropdown') || id.includes('select') || id.includes('menubar') || id.includes('navigation-menu')) {
                return 'radix-selects';
              }
              if (id.includes('accordion') || id.includes('tabs') || id.includes('collapsible') || id.includes('toggle-group')) {
                return 'radix-menus';
              }
              if (id.includes('context-menu') || id.includes('toggle') || id.includes('slider')) {
                return 'radix-interactive';
              }
              return 'radix-other';
            }
            
            // Icon library
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
            
            // Payment gateways  
            if (id.includes('node_modules/@paypal') || id.includes('node_modules/razorpay')) {
              return 'payment-sdk';
            }
            
            // Other heavy services
            if (id.includes('node_modules/@supabase')) {
              return 'supabase';
            }
            if (id.includes('node_modules/googleapis')) {
              return 'googleapis';
            }
            if (id.includes('node_modules/nodemailer') || id.includes('node_modules/resend')) {
              return 'email-services';
            }
            if (id.includes('node_modules/date-fns') || id.includes('node_modules/uuid') || id.includes('node_modules/nanoid')) {
              return 'utils';
            }
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
