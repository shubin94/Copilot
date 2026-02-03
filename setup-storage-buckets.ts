import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageBuckets() {
  try {
    console.log("🔧 Setting up Supabase Storage Buckets\n");

    const buckets = [
      {
        name: "site-assets",
        isPublic: true,
        description: "Site logos, hero images, etc."
      },
      {
        name: "page-assets",
        isPublic: true,
        description: "CMS page and content images"
      },
      {
        name: "detective-assets",
        isPublic: true,
        description: "Detective logos and documents"
      },
      {
        name: "service-images",
        isPublic: true,
        description: "Service gallery images"
      },
      {
        name: "service-documents",
        isPublic: false,
        description: "Private service documents"
      }
    ];

    for (const bucket of buckets) {
      console.log(`📦 Processing bucket: ${bucket.name}`);

      // Check if bucket exists
      const { data: existing } = await supabase.storage.listBuckets();
      const bucketExists = existing?.some((b) => b.name === bucket.name);

      if (bucketExists) {
        console.log(`   ✅ Already exists`);
      } else {
        // Create bucket
        console.log(`   Creating...`);
        const { data, error } = await supabase.storage.createBucket(bucket.name, {
          public: bucket.isPublic,
        });

        if (error) {
          console.log(`   ❌ Error: ${error.message}`);
        } else {
          console.log(`   ✅ Created`);
        }
      }
    }

    console.log("\n✅ Storage buckets setup complete!");
    console.log("\n📋 Buckets created:");
    console.log("   - site-assets (public)");
    console.log("   - page-assets (public)");
    console.log("   - detective-assets (public)");
    console.log("   - service-images (public)");
    console.log("   - service-documents (private)");

    console.log("\n⚠️  Note: Supabase RLS policies allow public read by default for public buckets.");
    console.log("If you see 400 errors, check Supabase dashboard → Storage → Policies.");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

setupStorageBuckets();
