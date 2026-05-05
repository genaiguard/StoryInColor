// Helper functions shared across the quiz Cloud Functions.

import * as admin from "firebase-admin";
import * as crypto from "crypto";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RATE_LIMIT_PER_IP_PER_DAY = 5;

/** Stable hash of an IP address for rate limiting + abuse tracing. */
export function hashIp(ip: string | undefined): string {
  const salt = process.env.IP_HASH_SALT || "storyincolor-default-salt-2026";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${ip || "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

/** TTL Timestamp for new pendingReadings docs. */
export function makeExpiresAt(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(Date.now() + PENDING_TTL_MS);
}

/**
 * Per-IP rate limiter for the unauth quiz generate path.
 * Returns true if allowed, false if rate-limited.
 *
 * Implementation: count `pendingReadings` docs created in the last 24h
 * matching this IP hash. Cheap; bounded by RATE_LIMIT + 1 query.
 */
export async function checkAndIncrementIpRateLimit(
  db: admin.firestore.Firestore,
  ipHash: string,
): Promise<{ allowed: boolean; recentCount: number }> {
  const cutoff = admin.firestore.Timestamp.fromMillis(
    Date.now() - 24 * 60 * 60 * 1000,
  );
  const snap = await db
    .collection("pendingReadings")
    .where("ipHash", "==", ipHash)
    .where("createdAt", ">=", cutoff)
    .limit(RATE_LIMIT_PER_IP_PER_DAY + 1)
    .get();
  const recentCount = snap.size;
  return {
    allowed: recentCount < RATE_LIMIT_PER_IP_PER_DAY,
    recentCount,
  };
}

/** Validate token format (UUID-like, lowercase hex + dashes). */
export function isValidToken(token: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    token,
  );
}

/**
 * Cheap email validation. Not RFC-perfect; just rejects obvious junk
 * before calling Stripe / writing to Firestore.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  if (email.length < 5 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
