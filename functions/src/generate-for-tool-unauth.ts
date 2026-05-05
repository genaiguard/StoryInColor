// Unauthenticated generation path for the quiz funnel.
// Per QUIZ-PIVOT-SPEC.md §3.3.1, §8.1.
//
// Differences from generateForTool:
//   - No auth required (callable as `https.onCall` but accepts unauth)
//   - No credit deduction
//   - Output stored under `pending/{token}/` with TTL via expiresAt
//   - Both full output AND blurred preview written
//   - IP rate-limited (5/IP/24h) instead of credit gating
//   - Gated by STORYINCOLOR_QUIZ_FUNNEL_ENABLED env var (kill switch)
//
// IMPORTANT: This is purely additive. Existing generateForTool unchanged.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import sharp from "sharp";
import fetch from "node-fetch";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";
import { getServerToolConfig } from "./tool-prompts";
import {
  hashIp,
  makeExpiresAt,
  checkAndIncrementIpRateLimit,
  isValidToken,
} from "./quiz-helpers";
import { isQuizFunnelEnabled } from "./quiz-types";
import type { QuizAnswers, PendingReadingDoc } from "./quiz-types";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

// Self-init guard: ES module imports hoist ahead of admin.initializeApp()
// in index.ts. Without this, module-level admin.* calls below throw at
// load time. Idempotent — checks before init.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/** Slugs the quiz funnel supports (must match lib/quiz/registry.ts). */
const QUIZ_SLUGS = new Set<string>([
  "palm-reading",
  "face-reading",
  "beauty-report",
  "aura-reading",
  "iridology",
  "handwriting",
  "style-audit",
  "hairstyle-analysis",
  "color-analysis",
  "skincare-glow",
]);

interface GenerateUnauthRequest {
  toolId?: string;
  inputStoragePath?: string; // pending/{token}/input.{ext}
  token?: string; // client-supplied UUID matching the storage path
  quizAnswers?: QuizAnswers;
  blurStrength?: number;
  attribution?: PendingReadingDoc["attribution"];
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

export const generateForToolUnauth = onCall(
  {
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 300,
    memory: "4GiB",
    invoker: "public",
  },
  async (request) => {
    if (!isQuizFunnelEnabled()) {
      throw new HttpsError(
        "unavailable",
        "Quiz funnel is currently disabled. Try again later.",
      );
    }

    const data = (request.data ?? {}) as GenerateUnauthRequest;
    const {
      toolId,
      inputStoragePath,
      token,
      quizAnswers = {},
      blurStrength = 35,
      attribution,
      fbEventId,
    } = data;

    if (typeof toolId !== "string" || !QUIZ_SLUGS.has(toolId)) {
      throw new HttpsError("invalid-argument", `Unsupported toolId: ${toolId}`);
    }
    if (typeof inputStoragePath !== "string") {
      throw new HttpsError("invalid-argument", "Missing inputStoragePath.");
    }
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid or missing token (must be UUID v4).");
    }
    // SECURITY: input must be under pending/{token}/ — never read other paths.
    if (!inputStoragePath.startsWith(`pending/${token}/`)) {
      throw new HttpsError(
        "permission-denied",
        "inputStoragePath must be under pending/{token}/",
      );
    }
    const config = getServerToolConfig(toolId);
    if (!config) {
      throw new HttpsError("invalid-argument", `Unknown toolId: ${toolId}`);
    }

    // Rate limit per IP. The rawRequest may not be available depending on
    // invoker context; we degrade to "unknown" and rate limit accordingly.
    const ip = (request.rawRequest as { ip?: string } | undefined)?.ip;
    const ipHash = hashIp(ip);
    const rateCheck = await checkAndIncrementIpRateLimit(db, ipHash);
    if (!rateCheck.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit exceeded (${rateCheck.recentCount} readings in 24h). Try again tomorrow.`,
      );
    }

    // Idempotency: if a pendingReading with this token already exists in
    // a non-failed state, return it (client retry / double-fire).
    const pendingRef = db.collection("pendingReadings").doc(token);
    const existing = await pendingRef.get();
    if (existing.exists) {
      const existingData = existing.data() as PendingReadingDoc | undefined;
      if (existingData?.status === "ready" || existingData?.status === "claimed") {
        return {
          success: true,
          token,
          status: existingData.status,
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
      // failed/expired — fall through and rebuild
    }

    // Initial pending doc + processing flag.
    // Firestore rejects undefined values in document writes, so we
    // construct the object with only the fields that are actually set.
    const pendingDoc: Record<string, unknown> = {
      token,
      toolId,
      status: "processing",
      ipHash,
      quizAnswers: cleanStringRecord(quizAnswers),
      inputStoragePath,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: makeExpiresAt(),
    };
    if (attribution && Object.keys(attribution).length > 0) {
      // Strip undefined values inside the attribution object too.
      const cleanedAttribution = cleanStringRecord(attribution);
      if (Object.keys(cleanedAttribution).length > 0) {
        pendingDoc.attribution = cleanedAttribution;
      }
    }
    if (typeof fbEventId === "string" && fbEventId.length > 0) {
      pendingDoc.fbEventId = fbEventId;
    }
    await pendingRef.set(pendingDoc);

    try {
      // 1) Download input from Storage
      const [origBuffer] = await bucket.file(inputStoragePath).download();
      let pipeline = sharp(origBuffer);

      if (config.preprocessing === "exif-rotate") pipeline = pipeline.rotate();
      if (config.preprocessing === "contrast")
        pipeline = pipeline.normalise().linear(1.2, -10);

      const detail = config.preprocessing === "detail";
      const targetDim = detail ? 1536 : 1024;
      pipeline = pipeline.resize({
        width: targetDim,
        height: targetDim,
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      });

      let inputBuffer: Buffer;
      let inputContentType = "image/jpeg";
      let inputFilename = "image.jpg";
      if (detail) {
        inputBuffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        inputContentType = "image/png";
        inputFilename = "image.png";
      } else {
        inputBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
      }

      // 2) Call OpenAI (same shape as generateForTool)
      const modelForRequest = config.model || IMAGE_MODEL;
      const isGptImage2 = modelForRequest.startsWith("gpt-image-2");

      let resp: Response;
      if (config.endpoint === "edits") {
        const formData = new FormData();
        formData.append("model", modelForRequest);
        formData.append("prompt", config.prompt);
        formData.append("n", "1");
        formData.append("size", config.imageSize);
        formData.append("quality", config.quality);
        formData.append("output_format", "png");
        formData.append("moderation", "low");
        if (!isGptImage2) {
          formData.append("input_fidelity", config.inputFidelity);
        }
        formData.append("image", inputBuffer, {
          filename: inputFilename,
          contentType: inputContentType,
        });
        resp = (await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
          },
          body: formData,
        })) as unknown as Response;
      } else {
        resp = (await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
          },
          body: JSON.stringify({
            model: modelForRequest,
            prompt: config.prompt,
            n: 1,
            size: config.imageSize,
            quality: config.quality,
            output_format: "png",
            moderation: "low",
          }),
        })) as unknown as Response;
      }

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`OpenAI ${resp.status}: ${txt}`);
      }
      const respJson = (await resp.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const b64 = respJson?.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI returned no b64_json");

      const fullBuf = Buffer.from(b64, "base64");

      // 3) Generate blurred preview
      const blurredBuf = await sharp(fullBuf)
        .blur(Math.max(20, Math.min(50, blurStrength)))
        .resize(800, 1200, { fit: "inside" })
        .jpeg({ quality: 60 })
        .toBuffer();

      // 4) Save full + blurred to Storage
      const outputPath = `pending/${token}/output.png`;
      const fullToken = uuidv4();
      await bucket.file(outputPath).save(fullBuf, {
        contentType: "image/png",
        metadata: {
          metadata: { firebaseStorageDownloadTokens: fullToken },
        },
      });
      const outputDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(outputPath)}?alt=media&token=${fullToken}`;

      const blurredPath = `pending/${token}/blurred.jpg`;
      const blurredToken = uuidv4();
      await bucket.file(blurredPath).save(blurredBuf, {
        contentType: "image/jpeg",
        metadata: {
          metadata: { firebaseStorageDownloadTokens: blurredToken },
        },
      });
      const blurredDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blurredPath)}?alt=media&token=${blurredToken}`;

      // 5) Flip pending doc to ready
      await pendingRef.update({
        status: "ready",
        outputStoragePath: outputPath,
        outputDownloadUrl,
        blurredStoragePath: blurredPath,
        blurredOutputDownloadUrl: blurredDownloadUrl,
      });

      return {
        success: true,
        token,
        status: "ready" as const,
        blurredOutputDownloadUrl: blurredDownloadUrl,
        // outputDownloadUrl is intentionally NOT returned to unauth caller.
        // The blurred preview is the only thing the client should see
        // pre-payment. Full URL is fetched server-side at claim time.
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[QuizGen] token=${token} toolId=${toolId} failed:`, reason);
      try {
        await pendingRef.update({
          status: "failed",
          errorMessage: reason.slice(0, 500),
        });
      } catch (updateErr) {
        console.error("[QuizGen] Failed to mark pending as failed:", updateErr);
      }
      throw new HttpsError("internal", `Generation failed: ${reason}`);
    }
  },
);
