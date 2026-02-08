import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { randomBytes } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: true,
});

const db = drizzle(pool, { schema });

async function fixProductionSecrets() {
  try {
    console.log("🔧 FIXING PRODUCTION SECRETS FOR DEPLOYMENT\n");
    
    // Your production URLs - must be provided via environment variables
    const FRONTEND_URL = process.env.FRONTEND_URL;
    const FRONTEND_VERCEL = process.env.FRONTEND_VERCEL;
    const BACKEND_URL = process.env.BACKEND_URL;
    
    if (!FRONTEND_URL) {
      throw new Error("FRONTEND_URL environment variable is required (e.g., https://www.askdetectives.com)");
    }
    if (!FRONTEND_VERCEL) {
      throw new Error("FRONTEND_VERCEL environment variable is required (e.g., https://askdetectives1.vercel.app)");
    }
    if (!BACKEND_URL) {
      throw new Error("BACKEND_URL environment variable is required (e.g., https://copilot-06s5.onrender.com)");
    }
    
    const CSRF_ORIGINS = `${FRONTEND_URL},${FRONTEND_VERCEL},${BACKEND_URL}`;
    
    // Generate a secure session secret
    const SESSION_SECRET = randomBytes(32).toString('hex');
    
    console.log("📋 Configuration to be applied:");
    console.log(`   csrf_allowed_origins: ${CSRF_ORIGINS}`);
    console.log(`   base_url: ${FRONTEND_URL}`);
    console.log(`   session_secret: set`);
    console.log();

    // 1. Update or insert csrf_allowed_origins
    const existingCsrf = await db.query.appSecrets.findFirst({
      where: eq(schema.appSecrets.key, "csrf_allowed_origins")
    });

    if (existingCsrf) {
      await db.update(schema.appSecrets)
        .set({ value: CSRF_ORIGINS })
        .where(eq(schema.appSecrets.key, "csrf_allowed_origins"));
      console.log("✅ Updated csrf_allowed_origins");
    } else {
      await db.insert(schema.appSecrets).values({
        key: "csrf_allowed_origins",
        value: CSRF_ORIGINS,
        label: "CSRF Allowed Origins",
        description: "Comma-separated list of allowed CSRF origins"
      });
      console.log("✅ Created csrf_allowed_origins");
    }

    // 2. Update or insert base_url
    const existingBase = await db.query.appSecrets.findFirst({
      where: eq(schema.appSecrets.key, "base_url")
    });

    if (existingBase) {
      await db.update(schema.appSecrets)
        .set({ value: FRONTEND_URL })
        .where(eq(schema.appSecrets.key, "base_url"));
      console.log("✅ Updated base_url");
    } else {
      await db.insert(schema.appSecrets).values({
        key: "base_url",
        value: FRONTEND_URL,
        label: "Base URL",
        description: "Public base URL (for OAuth callbacks, emails, etc.)"
      });
      console.log("✅ Created base_url");
    }

    // 3. Update or insert session_secret
    const existingSession = await db.query.appSecrets.findFirst({
      where: eq(schema.appSecrets.key, "session_secret")
    });

    if (existingSession) {
      // Preserve existing session secret - do not update
      console.log("✅ Session secret already exists (preserved)");
    } else {
      await db.insert(schema.appSecrets).values({
        key: "session_secret",
        value: SESSION_SECRET,
        label: "Session Secret",
        description: "Secret key for encrypting session cookies"
      });
      console.log("✅ Created session_secret");
    }

    console.log("\n✅ ALL PRODUCTION SECRETS CONFIGURED!");
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Add these environment variables to Render.com:");
    console.log("   DATABASE_URL=(your PostgreSQL connection string)");
    console.log(`   CSRF_ALLOWED_ORIGINS=${CSRF_ORIGINS}`);
    console.log("   SUPABASE_URL=(from Supabase dashboard)");
    console.log("   SUPABASE_SERVICE_ROLE_KEY=(from Supabase dashboard)");
    console.log("\nNote: SESSION_SECRET is generated and stored in app_secrets database table.");
    console.log("      It is NOT required as an environment variable.");
    console.log("\n2. Go to: Render Dashboard → Your Service → Environment");
    console.log("3. Click 'Add Environment Variable' and paste each one");
    console.log("4. Click 'Save Changes' - Render will auto-redeploy");
    console.log("\n5. Verify deployment at: https://copilot-06s5.onrender.com/api/health");
    console.log("6. Test login at: https://www.askdetectives.com/login");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixProductionSecrets();
