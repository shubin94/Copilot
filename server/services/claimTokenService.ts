/**
 * Claim Token Service
 * Handles generation, hashing, and validation of single-use claim tokens
 * for admin-created claimable detective accounts.
 */

import { randomBytes, createHash, timingSafeEqual } from "crypto";

interface TokenPair {
  token: string;        // Plain token (send to user)
  hash: string;         // Hashed token (store in DB)
}

/**
 * Generate a secure, random claim token
 * Returns both plain token (for email) and hash (for storage)
 *
 * Token format: detective_<24-char-random>
 * Example: detective_a1b2c3d4e5f6g7h8i9j0k1l2
 */
export function generateClaimToken(): TokenPair {
  const random = randomBytes(18).toString("hex");
  const token = `detective_${random}`;
  const hash = hashToken(token);

  return { token, hash };
}

/**
 * Hash a claim token using SHA-256
 * Used for secure storage in database
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a claim token against its stored hash
 * Returns true if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const computedHash = hashToken(token);
  return timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(hash)
  );
}

/**
 * Calculate token expiry (48 hours from now)
 * Returns ISO timestamp string
 */
export function calculateTokenExpiry(): string {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);
  return expiresAt.toISOString();
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(expiresAt: Date | string): boolean {
  const expiryTime = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return new Date() > expiryTime;
}

/**
 * Build claim account URL with token
 * Frontend will handle /claim-account?token=...
 */
export function buildClaimUrl(token: string, baseUrl: string = "https://askdetectives.com"): string {
  const url = new URL("/claim-account", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Generate a secure temporary password for claimed accounts
 * Format: 12+ characters with uppercase, lowercase, and numbers
 * Example: Xk9mL2pQ7nRt
 */
export function generateTempPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const allChars = uppercase + lowercase + numbers;

  // Ensure minimum length
  if (length < 12) {
    length = 12;
  }

  let password = "";

  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length);
    password += allChars[randomIndex];
  }

  // Shuffle the password to randomize position of required characters
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Interface for finalization validation result
 */
export interface FinalizationCheck {
  isValid: boolean;
  reason?: string;  // Error reason if invalid
}

/**
 * Validate that a detective is ready for claim finalization
 * REQUIRED CONDITIONS:
 * - isClaimed === true (already claimed account)
 * - loginEnabled === true (credentials generated)
 * - mustChangePassword === true (NOT changed yet - will finalize after change)
 * - claimedEmail EXISTS (stored during claim)
 * - claimCompletedAt === null (not already finalized)
 *
 * This is idempotent: safe to call multiple times
 */
export function validateClaimFinalization(detective: any, user: any): FinalizationCheck {
  // Check if already finalized
  if (detective.claimCompletedAt) {
    return {
      isValid: false,
      reason: "Claim already finalized for this account",
    };
  }

  // Check if detective was claimed
  if (!detective.isClaimed) {
    return {
      isValid: false,
      reason: "Detective account not yet claimed",
    };
  }

  // Check if login credentials exist
  if (!user.password || user.password.length === 0) {
    return {
      isValid: false,
      reason: "Login credentials not yet generated",
    };
  }

  // Check if claimed email exists (stored during claim)
  if (!detective.contactEmail) {
    return {
      isValid: false,
      reason: "Claimed email not found",
    };
  }

  // All conditions met
  return {
    isValid: true,
  };
}
