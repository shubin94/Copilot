import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { users, detectives, detectiveApplications } from "../shared/schema.ts";
import { eq, and, ilike } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const url = process.env.DATABASE_URL!;
  if (!url) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const pendingApps = await db.select({
      id: detectiveApplications.id,
      email: detectiveApplications.email,
      status: detectiveApplications.status,
    }).from(detectiveApplications).where(eq(detectiveApplications.status, "pending"));
    let removed = 0;
    for (const app of pendingApps) {
      const email = (String((app as any).email || "")).toLowerCase().trim();
      if (!email) continue;
      const [user] = await db.select().from(users).where(ilike(users.email, email)).limit(1);
      if (!user) continue;
      const [det] = await db.select().from(detectives).where(eq(detectives.userId, user.id)).limit(1);
      if (!det) continue;
      const shouldRemove = det.createdBy === "admin" && det.isClaimable === true && det.isClaimed === false;
      if (!shouldRemove) continue;
      await db.delete(detectives).where(eq(detectives.id, det.id));
      removed++;
    }
    console.log(`Removed ${removed} duplicate detectives linked to pending applications`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
