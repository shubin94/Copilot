/**
 * Encrypt/decrypt app_secrets values at rest. AES-256-GCM.
 * Never log or expose decrypted values.
 */

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;
const PREFIX = "ENC:";

function getEncryptionKey(): Buffer {
  const fromEnv = process.env.APP_SECRETS_ENCRYPTION_KEY;
  if (fromEnv && fromEnv.length >= 32) {
    if (fromEnv.length === 64 && /^[0-9a-fA-F]+$/.test(fromEnv)) {
      return Buffer.from(fromEnv, "hex");
    }
    return crypto.createHash("sha256").update(fromEnv).digest();
  }
  const fallback = process.env.SESSION_SECRET;
  if (fallback && fallback.length >= 8) {
    return crypto.scryptSync(fallback, "app_secrets_salt", KEY_LEN);
  }
  throw new Error("Set APP_SECRETS_ENCRYPTION_KEY (32+ chars) or SESSION_SECRET (8+ chars) in .env for app secrets encryption");
}

/**
 * Encrypt a plaintext value for storage. Returns PREFIX + base64(iv:authTag:ciphertext).
 */
export function encryptSecret(plaintext: string): string {
  if (plaintext === "") return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, enc]).toString("base64url");
}

/**
 * Decrypt a stored value. If not prefixed with PREFIX, return as-is (legacy plaintext).
 */
export function decryptSecret(stored: string): string {
  if (stored === "" || stored == null) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return stored;
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    return "";
  }
}

export function isEncryptionAvailable(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
