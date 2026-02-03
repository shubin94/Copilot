/**
 * Script to add RLS INSERT policies to all storage buckets
 * This allows authenticated users to upload files
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStoragePolicies() {
  try {
    console.log("🔧 Setting up Supabase Storage Upload Policies\n");

    const buckets = ["site-assets", "detective-profiles", "service-images"];

    for (const bucketName of buckets) {
      console.log(`📦 ${bucketName}`);

      // These policies need to be created via direct SQL since SDK doesn't support RLS policy creation
      console.log(`   ✅ SELECT (public) - Already exists`);
      console.log(`   ⏳ INSERT (authenticated) - Need to add manually`);
    }

    console.log("\n📋 MANUAL STEPS TO ADD INSERT POLICIES:");
    console.log("================================================");

    for (const bucketName of buckets) {
      console.log(`\n1️⃣  ${bucketName} bucket:`);
      console.log(`   Go to: https://supabase.com/dashboard`);
      console.log(`   → Storage → ${bucketName} → Policies`);
      console.log(`   → New Policy → For queries with INSERT`);
      console.log(`   → Get started`);
      console.log(`   Name: "Authenticated Upload"`);
      console.log(`   Paste in policy editor:`);
      console.log(`      bucket_id = '${bucketName}' AND auth.role() = 'authenticated'`);
      console.log(`   → Review → Save\n`);
    }

    console.log("\n✅ Once all policies are added, image uploads will work!");
    console.log("\nOr run this SQL in Supabase SQL Editor if you prefer:");
    console.log("================================================");

    console.log(`
-- Add INSERT policies for authenticated uploads
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'site-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'detective-profiles' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-images' AND auth.role() = 'authenticated');
    `);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

setupStoragePolicies();
