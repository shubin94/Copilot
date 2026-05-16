import { db } from "./db/index";
import { detectives, services } from "./shared/schema";
import { storage } from "./server/storage";
import { desc, eq } from "drizzle-orm";

async function run() {
  const [d] = await db.select().from(detectives).orderBy(desc(detectives.createdAt)).limit(1);
  if (!d) {
    console.log("NO_DETECTIVE_FOUND");
    return;
  }

  const slug = `tmp-check-${Date.now()}`;
  try {
    const created = await storage.createService({
      detectiveId: d.id,
      category: "Cyber Security",
      slug,
      title: "Tmp Service Check",
      description: "Temporary service insert check description for debugging database constraints.",
      basePrice: "999",
      isOnEnquiry: false,
      isActive: true,
    } as any);

    console.log("SERVICE_INSERT_OK", JSON.stringify({ id: created.id, detectiveId: d.id }));

    await db.delete(services).where(eq(services.id, created.id));
    console.log("SERVICE_INSERT_CLEANED");
  } catch (e: any) {
    console.log("SERVICE_INSERT_FAIL", e?.message || String(e));
  }
}

run().catch((e) => {
  console.error("FATAL", e?.message || e);
  process.exit(1);
});
