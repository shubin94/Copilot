import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";

const url = config.supabase.url;
const key = config.supabase.serviceRoleKey;
export const supabase = (url && key) ? createClient(url, key) : null as any;

export async function ensureBucket(name: string) {
  if (!supabase) {
    if (config.env.isProd) throw new Error("Supabase not configured");
    return;
  }
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b: any) => b.name === name);
  if (!exists) {
    await supabase.storage.createBucket(name, { public: true });
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
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) return dataUrl;
  const contentType = m[1].trim().toLowerCase();
  if (!UPLOAD_DATAURL_ALLOWED_TYPES.has(contentType)) {
    throw new Error("Unsupported content type");
  }
  const base64 = m[2];
  const buffer = Buffer.from(base64, "base64");
  await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: true });
  const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
  return (data as any)?.publicUrl || dataUrl;
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
    await supabase.storage.from(bucket).upload(path, buffer, { contentType: ct, upsert: true });
    const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
    return (data as any)?.publicUrl || source;
  } catch {
    if (config.env.isProd) throw new Error("Upload failed");
    return source;
  }
}
