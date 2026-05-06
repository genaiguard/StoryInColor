// Stage 1 (FREE HOOK) face analysis — unauthenticated.
// Per PIVOT-2.md.
//
// Pulls input photos from Storage at pending/{token}/, calls gpt-4o-mini
// with vision input + strict JSON Structured Output, writes the light
// analysis to pendingReadings/{token}, and returns it. The full Stage 2
// runs only after Stripe checkout succeeds (analyzeFaceFull).

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import sharp from "sharp";
import fetch from "node-fetch";
import {
  hashIp,
  makeExpiresAt,
  checkAndIncrementIpRateLimit,
  checkGlobalDailyCeiling,
  incrementGlobalDailyCounter,
  isValidToken,
} from "./quiz-helpers";
import {
  isFaceRatingEnabled,
  tierForScore,
} from "./face-rating-types";
import type {
  FaceLightAnalysis,
  PendingFaceReadingDoc,
} from "./face-rating-types";
import {
  SYSTEM_PROMPT,
  STAGE_1_USER_PROMPT,
  STAGE_1_SCHEMA,
} from "./face-rating-prompts";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const STAGE_1_MODEL = process.env.FACE_STAGE_1_MODEL || "gpt-4o-mini";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

interface AnalyzeFaceUnauthRequest {
  token?: string;
  frontPhotoStoragePath?: string;
  sidePhotoStoragePath?: string;
  gender?: string;
  goal?: string;
  countryCode?: string;
  inviteCode?: string; // friend's invite code, if redeeming
  attribution?: PendingFaceReadingDoc["attribution"];
  fbEventId?: string;
}

function cleanStringRecord(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.length > 0) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Map "BelowTier" enum value to surface label "Subhuman" per founder direction. */
function surfaceTierLabel(label: string, score: number): string {
  if (label === "BelowTier") return "Subhuman";
  // Re-derive from score if model returned an inconsistent label.
  return tierForScore(score);
}

export const analyzeFaceUnauth = onCall(
  {
    secrets: [OPENAI_API_KEY],
    invoker: "public",
    timeoutSeconds: 60,
    memory: "1GiB",
  },
  async (request) => {
    if (!isFaceRatingEnabled()) {
      throw new HttpsError(
        "unavailable",
        "Face rating is currently disabled. Try again later.",
      );
    }
    const data = (request.data ?? {}) as AnalyzeFaceUnauthRequest;
    const {
      token,
      frontPhotoStoragePath,
      sidePhotoStoragePath,
      gender,
      goal,
      countryCode,
      inviteCode,
      attribution,
      fbEventId,
    } = data;

    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid or missing token (must be UUID v4).",
      );
    }
    if (typeof frontPhotoStoragePath !== "string") {
      throw new HttpsError("invalid-argument", "Missing frontPhotoStoragePath.");
    }
    if (!frontPhotoStoragePath.startsWith(`pending/${token}/`)) {
      throw new HttpsError(
        "permission-denied",
        "frontPhotoStoragePath must be under pending/{token}/",
      );
    }
    if (
      typeof sidePhotoStoragePath === "string" &&
      !sidePhotoStoragePath.startsWith(`pending/${token}/`)
    ) {
      throw new HttpsError(
        "permission-denied",
        "sidePhotoStoragePath must be under pending/{token}/",
      );
    }

    // Per-IP + global rate limits (reused from quiz funnel).
    const ip = (request.rawRequest as { ip?: string } | undefined)?.ip;
    const ipHash = hashIp(ip);
    const rateCheck = await checkAndIncrementIpRateLimit(db, ipHash);
    if (!rateCheck.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit exceeded (${rateCheck.recentCount} in 24h). Try again tomorrow.`,
      );
    }
    const globalCheck = await checkGlobalDailyCeiling(db);
    if (!globalCheck.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "We're at capacity for today. Please try again tomorrow.",
      );
    }

    // Idempotency via Firestore CAS — pendingRef.create() throws if doc
    // exists. Per BUG-REVIEW.md H2.
    const pendingRef = db.collection("pendingReadings").doc(token);
    const ownerSecret = crypto.randomBytes(24).toString("base64url");
    const initialDoc: Record<string, unknown> = {
      type: "face-rating",
      token,
      status: "processing",
      ipHash,
      frontPhotoStoragePath,
      ownerSecret,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: makeExpiresAt(),
    };
    if (typeof sidePhotoStoragePath === "string" && sidePhotoStoragePath.length) {
      initialDoc.sidePhotoStoragePath = sidePhotoStoragePath;
    }
    if (typeof gender === "string" && gender.length) initialDoc.gender = gender;
    if (typeof goal === "string" && goal.length) initialDoc.goal = goal;
    if (typeof countryCode === "string" && countryCode.length) {
      initialDoc.countryCode = countryCode;
    }
    if (typeof inviteCode === "string" && inviteCode.length) {
      initialDoc.referredByInviteCode = inviteCode;
    }
    if (attribution && Object.keys(attribution).length > 0) {
      const cleaned = cleanStringRecord(attribution);
      if (Object.keys(cleaned).length > 0) initialDoc.attribution = cleaned;
    }
    if (typeof fbEventId === "string" && fbEventId.length > 0) {
      initialDoc.fbEventId = fbEventId;
    }
    try {
      await pendingRef.create(initialDoc);
    } catch (createErr) {
      // Doc already exists — return its current state (idempotent retry).
      const existing = await pendingRef.get();
      if (existing.exists) {
        const existingData = existing.data() as
          | PendingFaceReadingDoc
          | undefined;
        if (
          existingData &&
          (existingData.status === "ready" ||
            existingData.status === "claimed")
        ) {
          return {
            success: true,
            token,
            status: existingData.status,
            lightAnalysis: existingData.lightAnalysis,
            // Only return ownerSecret if the caller IS the owner. Without
            // an out-of-band proof on the retry, we conservatively don't
            // re-emit it.
            alreadyExisted: true,
          };
        }
        if (existingData?.status === "processing") {
          return {
            success: true,
            token,
            status: "processing",
            alreadyExisted: true,
          };
        }
      }
      throw new HttpsError("aborted", "Could not create pending doc.");
    }

    try {
      // 1) Download front photo + (optional) side photo, normalize each.
      const frontDataUrl = await downloadAsDataUrl(frontPhotoStoragePath);
      const sideDataUrl =
        typeof sidePhotoStoragePath === "string" && sidePhotoStoragePath.length
          ? await downloadAsDataUrl(sidePhotoStoragePath)
          : null;

      // 2) Stage 1 — gpt-4o-mini vision with strict Structured Output.
      const userContent: Array<Record<string, unknown>> = [
        { type: "text", text: STAGE_1_USER_PROMPT({ gender, goal, countryCode }) },
        {
          type: "image_url",
          image_url: { url: frontDataUrl, detail: "high" },
        },
      ];
      if (sideDataUrl) {
        userContent.push({
          type: "image_url",
          image_url: { url: sideDataUrl, detail: "high" },
        });
      }

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
        },
        body: JSON.stringify({
          model: STAGE_1_MODEL,
          temperature: 0,
          seed: hashSeed(token),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          response_format: {
            type: "json_schema",
            json_schema: STAGE_1_SCHEMA,
          },
          max_tokens: 800,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenAI Stage1 ${resp.status}: ${text.slice(0, 500)}`);
      }
      const respJson = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = respJson.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI returned no content");

      const parsed = JSON.parse(content) as FaceLightAnalysis;

      // Guard: clamp score and re-derive label from score if model drifted.
      const score = clamp(parsed.overall_score, 0, 10);
      parsed.overall_score = round1(score);
      parsed.tier_label = surfaceTierLabel(parsed.tier_label, score);

      // 3) Save to pendingReadings.
      await pendingRef.update({
        status: "ready",
        lightAnalysis: parsed,
      });

      await incrementGlobalDailyCounter(db);

      // H7: if email was somehow captured pre-Stage1 (e.g. inviter flow
      // pre-fills it), fire the reading-ready email now that status
      // flipped to ready. Most users capture email AFTER reveal, in
      // which case captureFaceRatingEmail handles the send. Non-fatal.
      // (Skipped here because we don't bind email-service secrets to this
      // function — the email goes via captureFaceRatingEmail.)

      return {
        success: true,
        token,
        status: "ready" as const,
        lightAnalysis: parsed,
        // Critical: return ownerSecret to the original caller so they can
        // authenticate sensitive ops post-claim. Per BUG-REVIEW.md C1+C2.
        ownerSecret,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[FaceStage1] token=${token} failed:`, reason);
      try {
        await pendingRef.update({
          status: "failed",
          errorMessage: reason.slice(0, 500),
        });
      } catch (updateErr) {
        console.error("[FaceStage1] mark-failed error:", updateErr);
      }
      throw new HttpsError("internal", `Analysis failed: ${reason}`);
    }
  },
);

/** Resize the photo, encode as base64 data URL for OpenAI vision. */
async function downloadAsDataUrl(path: string): Promise<string> {
  const [buf] = await bucket.file(path).download();
  // Resize to 1024 max — Stage 1 doesn't need higher fidelity.
  const resized = await sharp(buf)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

function clamp(n: number, lo: number, hi: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Deterministic 32-bit seed from the token for reproducible scores. */
function hashSeed(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) >>> 0;
  }
  return h % 2_147_483_647;
}
