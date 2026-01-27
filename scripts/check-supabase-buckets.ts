import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log("Buckets:");
  for (const b of buckets || []) {
    console.log("-", b.name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

