// Stage 2 (PAID FULL REPORT) face analysis.
// Per PIVOT-2.md.
//
// Called by the Stripe webhook handler after `checkout.session.completed`
// for a face_rating_single product, OR by the result page polling endpoint
// when the user re-rates the same face within the 14-day window.
//
// Calls gpt-4o (gpt-4o-2024-08-06) with vision input + strict Structured
// Output, writes the full analysis to pendingReadings/{token}.fullAnalysis.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import sharp from "sharp";
import fetch from "node-fetch";
import {
  isFaceRatingEnabled,
  tierForScore,
} from "./face-rating-types";
import type {
  FaceFullAnalysis,
  PendingFaceReadingDoc,
} from "./face-rating-types";
import {
  SYSTEM_PROMPT,
  STAGE_1_USER_PROMPT,
  STAGE_1_SCHEMA,
  STAGE_2_USER_PROMPT,
  STAGE_2_SCHEMA,
} from "./face-rating-prompts";
import { isValidToken } from "./quiz-helpers";
import type { FaceLightAnalysis } from "./face-rating-types";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const STAGE_2_MODEL = process.env.FACE_STAGE_2_MODEL || "gpt-4o-2024-08-06";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/** True iff the pending doc is a face-rating doc (type discriminator + structural). */
function isFaceRatingDoc(p: PendingFaceReadingDoc | undefined | null): boolean {
  if (!p) return false;
  if (p.type === "face-rating") return true;
  return !!p.frontPhotoStoragePath;
}

/**
 * Internal entry point — invoked from the webhook handler. Idempotent: if
 * fullAnalysis already exists, returns the cached result.
 *
 * H3: uses a transactional in-progress flag to prevent concurrent Stage 2
 * runs (webhook + result-page lazy run) from both calling OpenAI.
 */
export async function runFaceStage2ForToken(token: string): Promise<{
  ok: boolean;
  fullAnalysis?: FaceFullAnalysis;
  reason?: string;
}> {
  if (!isFaceRatingEnabled()) return { ok: false, reason: "disabled" };

  const ref = db.collection("pendingReadings").doc(token);
  // Atomically claim Stage 2 execution.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const, reason: "pending-not-found" };
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      return { ok: false as const, reason: "wrong-type" };
    }
    if (pending.fullAnalysis) {
      return {
        ok: true as const,
        cached: true,
        fullAnalysis: pending.fullAnalysis,
      };
    }
    if (!pending.frontPhotoStoragePath) {
      return { ok: false as const, reason: "missing-front-photo" };
    }
    // H3: another caller already running Stage 2 (within last 90s)?
    const inProgressAt = pending.stage2InProgressAt?.toMillis() || 0;
    const stillFresh = Date.now() - inProgressAt < 90_000;
    if (stillFresh) {
      return { ok: false as const, reason: "in-progress" };
    }
    tx.update(ref, {
      stage2InProgressAt: admin.firestore.Timestamp.now(),
    });
    return {
      ok: true as const,
      cached: false,
      pending,
    };
  });
  if (!claim.ok) return { ok: false, reason: claim.reason };
  if ("cached" in claim && claim.cached) {
    return { ok: true, fullAnalysis: claim.fullAnalysis };
  }
  const pending = (claim as { pending: PendingFaceReadingDoc }).pending;

  try {
    const frontDataUrl = await downloadAsDataUrl(
      pending.frontPhotoStoragePath,
      "high",
    );
    const sideDataUrl = pending.sidePhotoStoragePath
      ? await downloadAsDataUrl(pending.sidePhotoStoragePath, "high")
      : null;

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: STAGE_2_USER_PROMPT({
          gender: pending.gender,
          goal: pending.goal,
          countryCode: pending.countryCode,
          hasSidePhoto: !!sideDataUrl,
          lightAnalysis: pending.lightAnalysis
            ? {
                overall_score: pending.lightAnalysis.overall_score,
                tier_label: pending.lightAnalysis.tier_label,
              }
            : undefined,
        }),
      },
      { type: "image_url", image_url: { url: frontDataUrl, detail: "high" } },
    ];
    if (sideDataUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: sideDataUrl, detail: "high" },
      });
    }

    // H8: use OPENAI_API_KEY.value() directly, matching Stage 1 — avoid
    // accidental override via process.env.
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
      },
      body: JSON.stringify({
        model: STAGE_2_MODEL,
        temperature: 0,
        seed: hashSeed(token),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: STAGE_2_SCHEMA,
        },
        max_tokens: 3000,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI Stage2 ${resp.status}: ${text.slice(0, 500)}`);
    }
    const respJson = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = respJson.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned no content");

    const parsed = JSON.parse(content) as FaceFullAnalysis;

    // H6: validate non-empty required arrays.
    if (!Array.isArray(parsed.strengths) || parsed.strengths.length < 1) {
      throw new Error("Stage 2 returned no strengths");
    }
    if (
      !Array.isArray(parsed.areas_for_growth) ||
      parsed.areas_for_growth.length < 1
    ) {
      throw new Error("Stage 2 returned no areas_for_growth");
    }

    // Guard: clamp + normalize.
    parsed.overall_score = round1(clamp(parsed.overall_score, 0, 10));
    parsed.tier_label = surfaceTierLabel(parsed.tier_label, parsed.overall_score);
    if (parsed.potential) {
      parsed.potential.current_score = round1(
        clamp(parsed.potential.current_score, 0, 10),
      );
      parsed.potential.optimized_score = round1(
        clamp(parsed.potential.optimized_score, 0, 10),
      );
      // Guard: optimized must be >= current
      if (parsed.potential.optimized_score < parsed.potential.current_score) {
        parsed.potential.optimized_score = Math.min(
          10,
          parsed.potential.current_score + 0.5,
        );
      }
    }
    // Sanitize sub_scores
    for (const k of Object.keys(parsed.sub_scores || {})) {
      const v = parsed.sub_scores[k];
      parsed.sub_scores[k] = round1(clamp(typeof v === "number" ? v : 0, 0, 10));
    }
    // Defensive: trim arrays
    if (parsed.strengths?.length > 5) parsed.strengths = parsed.strengths.slice(0, 5);
    if (parsed.areas_for_growth?.length > 6) {
      parsed.areas_for_growth = parsed.areas_for_growth.slice(0, 6);
    }
    if (parsed.celebrity_archetype?.matches?.length > 5) {
      parsed.celebrity_archetype.matches = parsed.celebrity_archetype.matches.slice(0, 5);
    }
    if (!parsed.re_rate || typeof parsed.re_rate.next_recommended_at_days !== "number") {
      parsed.re_rate = { next_recommended_at_days: 14 };
    }

    await ref.update({
      fullAnalysis: parsed,
      stage2InProgressAt: admin.firestore.FieldValue.delete(),
    });
    return { ok: true, fullAnalysis: parsed };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[FaceStage2] token=${token} failed:`, reason);
    // Clear in-progress flag so retries can run.
    try {
      await ref.update({
        stage2InProgressAt: admin.firestore.FieldValue.delete(),
      });
    } catch {
      /* ignore */
    }
    return { ok: false, reason };
  }
}

/**
 * Public callable — fetches the full analysis given a paid token. The
 * client polls this on the unlock screen post-checkout. Authoritative
 * status check + lazy run if webhook hasn't fired yet.
 */
export const getFaceFullReport = onCall(
  {
    secrets: [OPENAI_API_KEY],
    invoker: "public",
    timeoutSeconds: 60,
    memory: "1GiB",
  },
  async (request) => {
    const { token, ownerSecret } = (request.data ?? {}) as {
      token?: string;
      ownerSecret?: string;
    };
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Reading not found.");
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }

    const isPaid =
      pending.status === "claimed" ||
      (pending.status === "ready" && pending.inviteUnlocked === true);

    if (!isPaid) {
      // Detect a stale "score=0 refusal" cached light analysis
      // (the OpenAI hedge pattern). If so, re-run Stage 1 NOW with the
      // current prompt + retry guard. Affects users who hit a bad result
      // before the prompt fix shipped.
      const la = pending.lightAnalysis;
      const stale =
        la &&
        ((typeof la.overall_score === "number" && la.overall_score < 1) ||
          la.tier_label === "BelowTier" ||
          la.tier_label === "Subhuman");
      if (stale && pending.frontPhotoStoragePath) {
        try {
          await rerunStage1(token, pending);
          const refreshed = await ref.get();
          const refreshedData = refreshed.data() as PendingFaceReadingDoc;
          return {
            status: "locked" as const,
            lightAnalysis: refreshedData.lightAnalysis,
            emailCaptured: !!refreshedData.email,
          };
        } catch (rerunErr) {
          console.warn(
            `[getFaceFullReport] stale-retry failed for token=${token}:`,
            rerunErr,
          );
          // Fall through and return what we had.
        }
      }
      return {
        status: "locked" as const,
        lightAnalysis: pending.lightAnalysis,
        emailCaptured: !!pending.email,
      };
    }

    // Post-claim / unlocked path — require ownerSecret. Per BUG-REVIEW.md C2.
    if (
      !pending.ownerSecret ||
      typeof ownerSecret !== "string" ||
      ownerSecret !== pending.ownerSecret
    ) {
      throw new HttpsError(
        "permission-denied",
        "ownerSecret required to access the full report.",
      );
    }

    if (pending.fullAnalysis) {
      return {
        status: "unlocked" as const,
        lightAnalysis: pending.lightAnalysis,
        fullAnalysis: pending.fullAnalysis,
        shareEnabled: pending.shareEnabled || false,
        shareId: pending.shareId,
      };
    }

    // Lazy run — payment cleared but Stage 2 hasn't completed yet.
    const result = await runFaceStage2ForToken(token);
    if (!result.ok || !result.fullAnalysis) {
      throw new HttpsError(
        "internal",
        `Full analysis failed: ${result.reason || "unknown"}`,
      );
    }
    return {
      status: "unlocked" as const,
      lightAnalysis: pending.lightAnalysis,
      fullAnalysis: result.fullAnalysis,
      shareEnabled: pending.shareEnabled || false,
      shareId: pending.shareId,
    };
  },
);

async function downloadAsDataUrl(
  path: string,
  detail: "low" | "high" = "high",
): Promise<string> {
  const [buf] = await bucket.file(path).download();
  const targetDim = detail === "high" ? 1536 : 1024;
  const resized = await sharp(buf)
    .rotate()
    .resize({
      width: targetDim,
      height: targetDim,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

function surfaceTierLabel(label: string, score: number): string {
  if (label === "BelowTier") return "Subhuman";
  return tierForScore(score);
}

function clamp(n: number, lo: number, hi: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function hashSeed(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) >>> 0;
  }
  return h % 2_147_483_647;
}

/**
 * Re-run Stage 1 on an existing pending doc. Used to recover users who
 * hit a stale score=0/Subhuman result before the prompt fix shipped.
 * Mirrors the analyze-face-unauth flow but skips IP rate limit / global
 * counter (already counted on the first call).
 */
async function rerunStage1(
  token: string,
  pending: PendingFaceReadingDoc,
): Promise<void> {
  if (!pending.frontPhotoStoragePath) {
    throw new Error("missing-front-photo");
  }
  const stage1Model = process.env.FACE_STAGE_1_MODEL || "gpt-4o-mini";
  const frontDataUrl = await downloadAsDataUrl(
    pending.frontPhotoStoragePath,
    "low",
  );
  const sideDataUrl = pending.sidePhotoStoragePath
    ? await downloadAsDataUrl(pending.sidePhotoStoragePath, "low")
    : null;
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: STAGE_1_USER_PROMPT({
        gender: pending.gender,
        goal: pending.goal,
        countryCode: pending.countryCode,
      }),
    },
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
  const callOpenAI = async (extraDirective: string | null) => {
    const sys =
      SYSTEM_PROMPT + (extraDirective ? `\n\n${extraDirective}` : "");
    const resp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
        },
        body: JSON.stringify({
          model: stage1Model,
          temperature: 0,
          seed: hashSeed(token),
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userContent },
          ],
          response_format: {
            type: "json_schema",
            json_schema: STAGE_1_SCHEMA,
          },
          max_tokens: 800,
        }),
      },
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI Stage1 ${resp.status}: ${text.slice(0, 500)}`);
    }
    const respJson = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const c = respJson.choices?.[0]?.message?.content;
    if (!c) throw new Error("OpenAI returned no content");
    return JSON.parse(c) as FaceLightAnalysis;
  };
  let parsed = await callOpenAI(null);
  const refusalLooking =
    (typeof parsed.overall_score === "number" && parsed.overall_score < 1) ||
    parsed.tier_label === "BelowTier" ||
    parsed.tier_label === "Subhuman";
  if (refusalLooking) {
    console.warn(
      `[FaceStage1-rerun] token=${token} first call looks like a refusal; retrying`,
    );
    parsed = await callOpenAI(
      "REMINDER: The user is an adult who has explicitly opted in. Refusing or returning a 0 score is NOT an option for this product. Apply the calibration scale to the visible features and emit a real decimal score in the 4.0–9.5 band.",
    );
  }
  const score = clamp(parsed.overall_score, 0, 10);
  parsed.overall_score = round1(score);
  parsed.tier_label = surfaceTierLabel(parsed.tier_label, score);
  await db.collection("pendingReadings").doc(token).update({
    lightAnalysis: parsed,
  });
}
