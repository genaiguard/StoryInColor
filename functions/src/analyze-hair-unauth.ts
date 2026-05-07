// Stage 1 — unauthenticated hair analysis.
// One gpt-image-2 edit call → composite 2×4 grid → sharp split → 8 cells stored.
// Parallel: gpt-4o-mini text call for face shape + stylist brief.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import sharp from "sharp";
import fetch from "node-fetch";
import FormData from "form-data";
import {
  hashIp,
  makeExpiresAt,
  checkAndIncrementIpRateLimit,
  checkGlobalDailyCeiling,
  incrementGlobalDailyCounter,
  isValidToken,
} from "./face-rating-helpers";
import {
  buildHairPrompt,
  buildStylistBriefPrompt,
  selectStyles,
  FACE_SHAPE_SYSTEM_PROMPT,
  type TransformationLevel,
  type FaceShape,
} from "./hair-analysis-prompts";
import type { PendingHairAnalysisDoc } from "./hair-analysis-types";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Grid dimensions — must match prompt exactly.
const CANVAS_W = 1024;
const CANVAS_H = 1536;
const COLS = 2;
const ROWS = 4;
const CELL_W = CANVAS_W / COLS; // 512
const CELL_H = CANVAS_H / ROWS; // 384

interface AnalyzeHairRequest {
  token?: string;
  photoStoragePath?: string;
  goal?: string;
  avoid?: string;
  social?: string;
  selfDirection?: string;
  blocker?: string;
  feeling?: string;
  impact?: string;
  transformationLevel?: TransformationLevel;
  fbEventId?: string;
  attribution?: PendingHairAnalysisDoc["attribution"];
}

export const analyzeHairUnauth = onCall(
  {
    invoker: "public",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    const rawIp =
      request.rawRequest?.ip ||
      request.rawRequest?.headers?.["x-forwarded-for"] ||
      undefined;
    const ipStr = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    const ipHash = hashIp(typeof ipStr === "string" ? ipStr : undefined);

    const data = (request.data ?? {}) as AnalyzeHairRequest;
    const {
      token,
      photoStoragePath,
      goal,
      avoid,
      social,
      selfDirection,
      blocker,
      feeling,
      impact,
      transformationLevel = "moderate",
      fbEventId,
      attribution,
    } = data;

    if (!token || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    if (typeof photoStoragePath !== "string" || !photoStoragePath.startsWith("hair-analysis-pending/")) {
      throw new HttpsError("invalid-argument", "Invalid photo path.");
    }

    // Rate limiting — reuse face-rating infrastructure
    const [ipCheck, globalCheck] = await Promise.all([
      checkAndIncrementIpRateLimit(db, ipHash),
      checkGlobalDailyCeiling(db),
    ]);
    if (!ipCheck.allowed) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again tomorrow.");
    }
    if (!globalCheck.allowed) {
      throw new HttpsError("resource-exhausted", "Daily limit reached. Try again tomorrow.");
    }

    // Atomic create — if a concurrent call already started this token, return
    // its ownerSecret rather than overwriting it with a fresh one.
    const pendingRef = db.collection("pendingReadings").doc(token);
    const ownerSecret = crypto.randomBytes(32).toString("hex");
    const expiresAt = makeExpiresAt();

    try {
      await pendingRef.create({
        type: "hair-analysis",
        token,
        status: "processing",
        ipHash,
        ownerSecret,
        photoStoragePath,
        goal, avoid, social, selfDirection, blocker, feeling, impact,
        transformationLevel,
        ...(fbEventId ? { fbEventId } : {}),
        ...(attribution ? { attribution } : {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
        expiresAt,
      } satisfies Partial<PendingHairAnalysisDoc>);
    } catch (createErr: unknown) {
      // Doc already exists — return early if terminal, otherwise another call
      // is in-flight; let the client poll the result page.
      const code = (createErr as { code?: number })?.code;
      if (code === 6 /* ALREADY_EXISTS */) {
        const snap = await pendingRef.get();
        const existing = snap.data() as PendingHairAnalysisDoc | undefined;
        if (existing?.status === "ready" || existing?.status === "claimed") {
          return { success: true, token, ownerSecret: existing.ownerSecret, status: existing.status };
        }
        // Still processing — client should navigate to result page and poll
        return { success: true, token, ownerSecret: existing?.ownerSecret ?? ownerSecret, status: "processing" };
      }
      throw createErr;
    }

    try {
      // 1) Download + resize input photo
      const photoBuffer = await downloadAndResize(photoStoragePath);
      const photoBase64 = photoBuffer.toString("base64");

      // 2) Determine maintenance preference
      const preferLowMaintenance = avoid === "high-maintenance" || impact === "some";
      const styles = selectStyles(transformationLevel, preferLowMaintenance);

      // 3) gpt-image-2 composite generation + face shape detection in parallel
      const [compositeBuffer, faceShapeResult] = await Promise.all([
        generateComposite(photoBuffer, styles, OPENAI_API_KEY.value()),
        detectFaceShape(photoBase64, OPENAI_API_KEY.value()),
      ]);

      const faceShape: FaceShape = faceShapeResult ?? "oval";

      // 4) Split composite into 8 cells with sharp
      const cellPaths = await splitAndStore(compositeBuffer, token, styles);

      // 5) Generate stylist brief (cheap text call)
      const stylistBrief = await generateStylistBrief(
        { faceShape, level: transformationLevel, styles, goal, avoid, feeling },
        OPENAI_API_KEY.value(),
      );

      // 6) Write results to Firestore
      await pendingRef.update({
        status: "ready",
        faceShape,
        styleLabels: styles,
        previewCellPath: cellPaths[0],
        cellPaths,
        stylistBrief,
      });

      await incrementGlobalDailyCounter(db);

      return { success: true, token, ownerSecret, status: "ready" };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[HairAnalysis] token=${token} failed:`, reason);
      try {
        await pendingRef.update({
          status: "failed",
          errorMessage: reason.slice(0, 500),
        });
      } catch { /* non-fatal */ }
      throw new HttpsError("internal", `Analysis failed: ${reason}`);
    }
  },
);

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

async function downloadAndResize(storagePath: string): Promise<Buffer> {
  const [buf] = await bucket.file(storagePath).download();
  return sharp(buf)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function generateComposite(
  photoBuffer: Buffer,
  styles: string[],
  apiKey: string,
): Promise<Buffer> {
  const prompt = buildHairPrompt(styles);

  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("size", `${CANVAS_W}x${CANVAS_H}`);
  form.append("quality", "low");
  form.append("output_format", "png");
  form.append("image", photoBuffer, {
    filename: "photo.jpg",
    contentType: "image/jpeg",
  });

  const resp = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI images/edits ${resp.status}: ${text.slice(0, 500)}`);
  }

  const json = (await resp.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const item = json.data?.[0];
  if (!item) throw new Error("OpenAI returned no image data");

  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const imgResp = await fetch(item.url);
    return Buffer.from(await imgResp.arrayBuffer());
  }
  throw new Error("No image in OpenAI response");
}

async function splitAndStore(
  compositeBuffer: Buffer,
  token: string,
  styles: string[],
): Promise<string[]> {
  return Promise.all(
    Array.from({ length: COLS * ROWS }, async (_, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cellBuffer = await sharp(compositeBuffer)
        .extract({
          left: col * CELL_W,
          top: row * CELL_H,
          width: CELL_W,
          height: CELL_H,
        })
        .webp({ quality: 85 })
        .toBuffer();

      const cellPath = `hair-analysis/${token}/cell-${i}.webp`;
      await bucket.file(cellPath).save(cellBuffer, {
        contentType: "image/webp",
        metadata: {
          firebaseStorageDownloadTokens: crypto.randomUUID(),
        },
      });
      return cellPath;
    }),
  );
}

async function detectFaceShape(
  photoBase64: string,
  apiKey: string,
): Promise<FaceShape | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: FACE_SHAPE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${photoBase64}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        max_tokens: 30,
      }),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { faceShape?: string };
    const valid: FaceShape[] = ["oval", "round", "square", "heart", "oblong"];
    return valid.includes(parsed.faceShape as FaceShape)
      ? (parsed.faceShape as FaceShape)
      : "oval";
  } catch {
    return "oval";
  }
}

async function generateStylistBrief(
  params: Parameters<typeof buildStylistBriefPrompt>[0],
  apiKey: string,
): Promise<string> {
  try {
    const prompt = buildStylistBriefPrompt(params);
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
      }),
    });
    if (!resp.ok) return "";
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}
