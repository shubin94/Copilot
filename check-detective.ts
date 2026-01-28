#!/usr/bin/env node
import { db } from "./db/index.ts";
import { detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function check() {
  const detective = await db
    .select()
    .from(detectives)
    .where(eq(detectives.id, "23dac06d-afc2-41f3-b941-eb48b0641d45"))
    .limit(1)
    .then(r => r[0]);

  console.log("Detective found:");
  console.log("ID:", detective.id);
  console.log("User ID:", detective.userId);
  console.log("Business Name:", detective.businessName);
}

check();
