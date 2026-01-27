import { createClient } from "@supabase/supabase-js";

function isSupabasePublicUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

async function ensureBucket(supabase: any, name: string) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b: any) => b.name === name);
  if (!exists) await supabase.storage.createBucket(name, { public: true });
}

async function uploadFromUrlOrDataUrl(supabase: any, bucket: string, path: string, source: string): Promise<string> {
  await ensureBucket(supabase, bucket);
  if (source.startsWith("data:")) {
    const m = source.match(/^data:(.+?);base64,(.+)$/);
    if (!m) return source;
    const contentType = m[1];
    const base64 = m[2];
    const buffer = Buffer.from(base64, "base64");
    await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: true });
    const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
    return (data as any)?.publicUrl || source;
  }
  const res = await fetch(source);
  if (!res.ok) return source;
  const ct = res.headers.get("content-type") || "application/octet-stream";
  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);
  await supabase.storage.from(bucket).upload(path, buffer, { contentType: ct, upsert: true });
  const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
  return (data as any)?.publicUrl || source;
}

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  let updatedCount = 0;

  // Detectives
  {
    let from = 0;
    const step = 500;
    while (true) {
      const { data: rows, error } = await supabase.from("detectives").select("*").range(from, from + step - 1);
      if (error) throw error;
      if (!rows || rows.length === 0) break;
      for (const d of rows) {
        let changed = false;
        let logo = d.logo || null;
        if (logo && !isSupabasePublicUrl(logo)) {
          logo = await uploadFromUrlOrDataUrl(supabase, "detective-assets", `logos/${d.id}.png`, logo);
          changed = true;
        }
        let businessDocuments = d.business_documents || [];
        if (Array.isArray(businessDocuments) && businessDocuments.length > 0) {
          const next: string[] = [];
          for (let i = 0; i < businessDocuments.length; i++) {
            const doc = businessDocuments[i];
            next.push(!isSupabasePublicUrl(doc) ? await uploadFromUrlOrDataUrl(supabase, "detective-assets", `documents/${d.id}-${i}.pdf`, doc) : doc);
          }
          businessDocuments = next;
          changed = true;
        }
        let identityDocuments = d.identity_documents || [];
        if (Array.isArray(identityDocuments) && identityDocuments.length > 0) {
          const next: string[] = [];
          for (let i = 0; i < identityDocuments.length; i++) {
            const doc = identityDocuments[i];
            next.push(!isSupabasePublicUrl(doc) ? await uploadFromUrlOrDataUrl(supabase, "detective-assets", `identity/${d.id}-${i}.pdf`, doc) : doc);
          }
          identityDocuments = next;
          changed = true;
        }
        if (changed) {
          const { error: uerr } = await supabase.from("detectives").update({
            logo,
            business_documents: businessDocuments,
            identity_documents: identityDocuments,
            updated_at: new Date().toISOString(),
          }).eq("id", d.id);
          if (uerr) throw uerr;
          updatedCount++;
        }
      }
      from += step;
    }
  }

  // Services
  {
    let from = 0;
    const step = 500;
    while (true) {
      const { data: rows, error } = await supabase.from("services").select("*").range(from, from + step - 1);
      if (error) throw error;
      if (!rows || rows.length === 0) break;
      for (const s of rows) {
        const imgs = s.images || [];
        const next: string[] = [];
        let changed = false;
        for (let i = 0; i < imgs.length; i++) {
          const u = imgs[i];
          next.push(!isSupabasePublicUrl(u) ? await uploadFromUrlOrDataUrl(supabase, "service-images", `banners/${s.id}-${i}.jpg`, u) : u);
          if (!isSupabasePublicUrl(u)) changed = true;
        }
        if (changed) {
          const { error: uerr } = await supabase.from("services").update({
            images: next,
            updated_at: new Date().toISOString(),
          }).eq("id", s.id);
          if (uerr) throw uerr;
          updatedCount++;
        }
      }
      from += step;
    }
  }

  // Site Settings
  {
    const { data: rows, error } = await supabase.from("site_settings").select("*").range(0, 0);
    if (error) throw error;
    if (rows && rows.length > 0) {
      const s = rows[0];
      let logoUrl = s.logo_url || null;
      if (logoUrl && !isSupabasePublicUrl(logoUrl)) {
        logoUrl = await uploadFromUrlOrDataUrl(supabase, "site-assets", "logos/site-logo.png", logoUrl);
        const { error: uerr } = await supabase.from("site_settings").update({
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        }).eq("id", s.id);
        if (uerr) throw uerr;
        updatedCount++;
      }
    }
  }

  console.log(`Migration via REST complete. Updated rows: ${updatedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

