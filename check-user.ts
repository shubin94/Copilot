#!/usr/bin/env node
import { db } from "./db/index.ts";
import { users } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function check() {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, "68f0c88c-4090-4ad1-82c7-a57ff1ea5499"))
    .limit(1)
    .then(r => r[0]);

  console.log("User found:");
  console.log("ID:", user?.id);
  console.log("Name:", user?.name);
  console.log("Email:", user?.email);
}

check();
