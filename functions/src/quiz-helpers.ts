// Helper functions shared across the quiz Cloud Functions.

import * as admin from "firebase-admin";
import * as crypto from "crypto";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RATE_LIMIT_PER_IP_PER_DAY = 3;
// Global daily ceiling — hard upper bound on cost across ALL IPs.
// 60 readings/day × $0.25/call ≈ $15/day worst case. Adjust via env.
const GLOBAL_DAILY_CEILING = Number(
  process.env.QUIZ_GLOBAL_DAILY_CEILING || "60",
);

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
 *
 * Failure mode: if the composite index isn't built yet, OR Firestore
 * is transiently unavailable, we DO NOT block legitimate users —
 * we log the error and fail open (allow the request). The downside is a
 * brief window where rate limiting is bypassed; acceptable because (a)
 * the failure is transient (index build minutes) and (b) the IP-rate
 * limit is a soft mitigation, not a security boundary.
 */
export async function checkAndIncrementIpRateLimit(
  db: admin.firestore.Firestore,
  ipHash: string,
): Promise<{ allowed: boolean; recentCount: number }> {
  const cutoff = admin.firestore.Timestamp.fromMillis(
    Date.now() - 24 * 60 * 60 * 1000,
  );
  try {
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
  } catch (err) {
    // Most common reason: composite index still building. Log and fail open.
    console.warn(
      "[QuizRateLimit] degraded — proceeding without IP rate check:",
      err instanceof Error ? err.message : err,
    );
    return { allowed: true, recentCount: 0 };
  }
}

/**
 * Global daily ceiling check — hard upper bound on the number of
 * unauth generations that will run in a 24h window across ALL IPs.
 * This is the production cost-protection lever: at $0.06–$0.25 per
 * OpenAI call, an abuse vector that gets past the per-IP limit can't
 * exceed GLOBAL_DAILY_CEILING × $0.25 ≈ $15 worst case.
 *
 * Counts via a tiny daily counter doc rather than re-scanning
 * pendingReadings (cheaper at scale).
 */
export async function checkGlobalDailyCeiling(
  db: admin.firestore.Firestore,
): Promise<{ allowed: boolean; usedToday: number; ceiling: number }> {
  try {
    const todayKey = (() => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    })();
    const ref = db.collection("quizDailyCounters").doc(todayKey);
    const snap = await ref.get();
    const usedToday = snap.exists ? Number(snap.data()?.count || 0) : 0;
    return {
      allowed: usedToday < GLOBAL_DAILY_CEILING,
      usedToday,
      ceiling: GLOBAL_DAILY_CEILING,
    };
  } catch (err) {
    // Fail closed if the counter read itself errors — better to refuse
    // than to risk uncapped spend on a transient outage.
    console.error("[QuizGlobalCap] read failed; refusing to proceed:", err);
    return { allowed: false, usedToday: -1, ceiling: GLOBAL_DAILY_CEILING };
  }
}

/** Atomic increment of today's counter. Best-effort; non-fatal on error. */
export async function incrementGlobalDailyCounter(
  db: admin.firestore.Firestore,
): Promise<void> {
  try {
    const todayKey = (() => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    })();
    const ref = db.collection("quizDailyCounters").doc(todayKey);
    // 30-day TTL on the counter docs so they auto-clean.
    const expireAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
    await ref.set(
      {
        count: admin.firestore.FieldValue.increment(1),
        date: todayKey,
        expireAt,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("[QuizGlobalCap] increment failed (non-fatal):", err);
  }
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
