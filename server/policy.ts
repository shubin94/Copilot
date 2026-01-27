import { db } from "../db/index.ts";
import { appPolicies } from "../shared/schema.ts";
import { eq } from "drizzle-orm";
import { config } from "./config.ts";

export async function getPolicy<T = any>(key: string): Promise<T | undefined> {
  const [row] = await db.select().from(appPolicies).where(eq(appPolicies.key, key)).limit(1);
  return (row as any)?.value as T | undefined;
}

export async function requirePolicy<T = any>(key: string): Promise<T> {
  const v = await getPolicy<T>(key);
  if (v === undefined || v === null) {
    if (config.env.isProd) throw new Error(`Missing required policy: ${key}`);
  }
  return v as T;
}
