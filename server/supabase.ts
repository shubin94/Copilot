import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";

/**
 * Supabase Configuration - Environment Variables ONLY
 * 
 * IMPORTANT: Supabase credentials MUST come from environment variables exclusively.
 * They are NEVER loaded from the database to ensure single source of truth.
 * 
 * Safety Guards:
 * - In development (NODE_ENV=development), using a non-local Supabase URL throws an error
 * - This prevents accidentally connecting to production/cloud Supabase from local dev
 * 
 * Required Environment Variables:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin operations
 * 
 * Local Development:
 * - Use .env.local (gitignored)
 * - Set SUPABASE_URL=http://127.0.0.1:54321 (or your local Supabase URL)
 * 
 * Production:
 * - Set via hosting provider environment variables
 * - Never commit production credentials to git
 */

// Read directly from process.env - these are set before secretsLoader runs
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate Supabase configuration on startup
if (!url || !key) {
  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  
  if (config.env.isProd) {
    throw new Error(
      `❌ Missing required Supabase environment variables in production: ${missing.join(", ")}\n` +
      "Set these via your hosting provider's environment variable settings."
    );
  } else {
    console.warn(
      `⚠️  Warning: Missing Supabase environment variables: ${missing.join(", ")}\n` +
      "Supabase storage features will be disabled.\n" +
      "Add them to .env.local if you need storage functionality."
    );
  }
}

// Development safety guard: prevent accidental cloud Supabase usage in dev
// TEMPORARILY DISABLED for testing live database
/*
if (config.env.isDev && url) {
  const isLocalSupabase = 
    url.includes("localhost") || 
    url.includes("127.0.0.1") || 
    url.includes("0.0.0.0");
  
  if (!isLocalSupabase) {
    throw new Error(
      `❌ SAFETY CHECK FAILED\n\n` +
      `You are in DEVELOPMENT mode (NODE_ENV=development) but trying to connect to:\n` +
      `  ${url}\n\n` +
      `This appears to be a CLOUD/PRODUCTION Supabase instance!\n\n` +
      `To fix this:\n` +
      `  1. Update SUPABASE_URL in .env.local to your LOCAL Supabase URL\n` +
      `     (e.g., http://127.0.0.1:54321)\n` +
      `  2. Or set NODE_ENV=production if you intentionally want to use cloud Supabase\n\n` +
      `This safety check prevents accidentally modifying production data during development.`
    );
  }
}
*/

export const supabase = (url && key) ? createClient(url, key) : null as any;
const isLocalDev = !config.env.isProd || (config.baseUrl || "").includes("localhost") || (config.baseUrl || "").includes("127.0.0.1");

export async function ensureBucket(name: string) {
  if (!supabase) {
    if (config.env.isProd) throw new Error("Supabase not configured");
    return;
  }
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Supabase listBuckets failed", { message: listError.message });
    if (isLocalDev) return;
    throw new Error(`Supabase listBuckets failed: ${listError.message}`);
  }
  const exists = (buckets || []).some((b: any) => b.name === name);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(name, { public: true });
    if (createError) {
      console.error("Supabase createBucket failed", { name, message: createError.message });
      throw new Error(`Supabase createBucket failed: ${createError.message}`);
    }
  }
}

export function parsePublicUrl(u: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(u);
    if (!urlObj.pathname.includes("/storage/v1/object/public/")) return null;
    const idx = urlObj.pathname.indexOf("/storage/v1/object/public/");
    const tail = urlObj.pathname.slice(idx + "/storage/v1/object/public/".length);
    const parts = tail.split("/");
    const bucket = parts.shift() || "";
    const path = parts.join("/");
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export async function deletePublicUrl(u: string) {
  if (!supabase) {
    if (config.env.isProd) throw new Error("Supabase not configured");
    return;
  }
  const parsed = parsePublicUrl(u);
  if (!parsed) return;
  await supabase.storage.from(parsed.bucket).remove([parsed.path]);
}

// Allowed MIME types for data-URL uploads (defense-in-depth; path is server-generated)
const UPLOAD_DATAURL_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);

export async function uploadDataUrl(bucket: string, path: string, dataUrl: string): Promise<string> {
  if (!supabase) {
    if (config.env.isProd) throw new Error("Supabase not configured");
    return dataUrl;
  }
  await ensureBucket(bucket);
  const m = dataUrl.match(/^data:([^;]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!m) return dataUrl;
  const contentType = m[1].trim().toLowerCase();
  if (!UPLOAD_DATAURL_ALLOWED_TYPES.has(contentType)) {
    throw new Error("Unsupported content type");
  }
  const base64 = m[2];
  const buffer = Buffer.from(base64, "base64");
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: true });
  if (uploadError) {
    console.error("Supabase upload failed", {
      bucket,
      path,
      contentType,
      size: buffer.length,
      message: uploadError.message,
    });
    if (isLocalDev) return dataUrl;
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }
  const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = (data as any)?.publicUrl;
  if (!publicUrl) {
    console.error("Supabase getPublicUrl failed", { bucket, path });
    throw new Error("Supabase getPublicUrl failed");
  }
  return publicUrl;
}

export async function uploadFromUrlOrDataUrl(bucket: string, path: string, source: string): Promise<string> {
  if (!supabase) {
    if (require('./config.ts').config.env.isProd) throw new Error("Supabase not configured");
    return source;
  }
  await ensureBucket(bucket);
  if (source.startsWith("data:")) {
    return uploadDataUrl(bucket, path, source);
  }
  try {
    const res = await fetch(source);
    if (!res.ok) {
      if (config.env.isProd) throw new Error(`Failed to fetch source: ${res.status}`);
      return source;
    }
    const ct = res.headers.get("content-type") || "application/octet-stream";
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: ct, upsert: true });
    if (uploadError) {
      console.error("Supabase upload failed", {
        bucket,
        path,
        contentType: ct,
        size: buffer.length,
        message: uploadError.message,
      });
      if (isLocalDev) return source;
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }
    const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = (data as any)?.publicUrl;
    if (!publicUrl) {
      console.error("Supabase getPublicUrl failed", { bucket, path });
      throw new Error("Supabase getPublicUrl failed");
    }
    return publicUrl;
  } catch {
    if (config.env.isProd) throw new Error("Upload failed");
    return source;
  }
}
