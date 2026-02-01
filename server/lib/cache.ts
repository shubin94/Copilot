/**
 * In-memory cache utility (Cache-Aside / Lazy Loading).
 * Keys: strings. Values: JSON-serializable only. TTL required on set.
 */

interface Entry<T = unknown> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function get<T = unknown>(key: string): T | undefined {
  if (typeof key !== "string") return undefined;
  try {
    const entry = store.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  } catch {
    return undefined;
  }
}

export function set<T = unknown>(key: string, value: T, ttlSeconds: number): void {
  if (typeof key !== "string" || ttlSeconds <= 0) return;
  try {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    store.set(key, { value, expiresAt });
  } catch {
    // no-op
  }
}

export function del(key: string): void {
  if (typeof key !== "string") return;
  try {
    store.delete(key);
  } catch {
    // no-op
  }
}

/** Returns all cache keys (for prefix-based invalidation). */
export function keys(): string[] {
  try {
    return Array.from(store.keys());
  } catch {
    return [];
  }
}
