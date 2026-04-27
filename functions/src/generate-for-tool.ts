import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import sharp from "sharp";
import fetch from "node-fetch";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";
import { getServerToolConfig } from "./tool-prompts";
import { refundCreditsTx } from "./credit-ledger";

// Cloud Functions deduplicates secret bindings by name, so re-declaring here is
// safe even though `index.ts` already defines the same secret.
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// `admin.initializeApp()` is invoked in `index.ts`, so we just grab handles.
const db = admin.firestore();
const bucket = admin.storage().bucket();

export const generateForTool = onCall(
  {
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 300,
    memory: "4GiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const userId = request.auth.uid;
    const { toolId, photoStoragePath } = (request.data ?? {}) as {
      toolId?: unknown;
      photoStoragePath?: unknown;
    };
    if (typeof toolId !== "string" || typeof photoStoragePath !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Missing toolId or photoStoragePath.",
      );
    }
    // SECURITY: ensure the storage path belongs to the caller's user folder.
    // Without this check, a malicious user could submit a path pointing at
    // another user's storage and the server would happily download it.
    if (!photoStoragePath.startsWith(`users/${userId}/`)) {
      throw new HttpsError(
        "permission-denied",
        "photoStoragePath must be under your user folder.",
      );
    }
    const config = getServerToolConfig(toolId);
    if (!config) {
      throw new HttpsError("invalid-argument", `Unknown toolId: ${toolId}`);
    }

    const jobId = uuidv4();
    const generationId = uuidv4();
    const jobRef = db
      .collection("users")
      .doc(userId)
      .collection("jobs")
      .doc(jobId);
    const genRef = db
      .collection("users")
      .doc(userId)
      .collection("generations")
      .doc(generationId);

    // 1) Pre-create job + deduct credits in one transactional motion.
    // This runs OUTSIDE the try/catch below — a deduction failure (e.g.,
    // insufficient credits) propagates straight to the caller and must NOT
    // trigger a refund attempt.
    await db.runTransaction(async (tx) => {
      const credRef = db.collection("userCredits").doc(userId);
      const credSnap = await tx.get(credRef);
      if (!credSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "User credits not initialized.",
        );
      }
      const balance = (credSnap.data()?.balance ?? 0) as number;
      if (balance < config.creditCost) {
        throw new HttpsError("failed-precondition", "INSUFFICIENT_CREDITS");
      }
      tx.update(credRef, {
        balance: admin.firestore.FieldValue.increment(-config.creditCost),
        used: admin.firestore.FieldValue.increment(config.creditCost),
        usageHistory: admin.firestore.FieldValue.arrayUnion({
          type: "deduct",
          toolId,
          jobId,
          cost: config.creditCost,
          date: admin.firestore.Timestamp.now(),
        }),
        lastUpdated: admin.firestore.Timestamp.now(),
      });
      tx.set(jobRef, {
        jobId,
        userId,
        toolId,
        status: "processing",
        photoStoragePath,
        creditCost: config.creditCost,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // 2) Run generation; on ANY failure, refund and mark failed.
    try {
      // Download original + resize (mirror processImageWithOpenAI settings)
      const [origBuffer] = await bucket.file(photoStoragePath).download();
      const resized = await sharp(origBuffer)
        .resize({
          width: 1024,
          height: 1024,
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .jpeg({ quality: 65 })
        .toBuffer();

      // OpenAI gpt-image-1 /v1/images/edits — same wire pattern as
      // processImageWithOpenAI. DO NOT CHANGE the formData shape.
      const formData = new FormData();
      formData.append("model", "gpt-image-1");
      formData.append("prompt", config.prompt);
      formData.append("n", "1");
      formData.append("size", config.imageSize);
      formData.append("quality", "auto");
      formData.append("image", resized, {
        filename: "image.jpg",
        contentType: "image/jpeg",
      });

      const resp = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
        },
        body: formData,
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`OpenAI ${resp.status}: ${txt}`);
      }
      const respJson = (await resp.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const b64 = respJson?.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("OpenAI returned no b64_json");
      }
      const outBuf = Buffer.from(b64, "base64");

      const outPath = `users/${userId}/generations/${generationId}.png`;
      // Use a Firebase Storage download token instead of a 7-day signed URL —
      // these URLs do not expire as long as the token metadata stays attached.
      const downloadToken = uuidv4();
      await bucket.file(outPath).save(outBuf, {
        contentType: "image/png",
        metadata: {
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(outPath)}?alt=media&token=${downloadToken}`;

      // Write generation doc + flip job to complete
      await genRef.set({
        generationId,
        jobId,
        userId,
        toolId,
        outputStoragePath: outPath,
        outputDownloadUrl: downloadUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await jobRef.update({
        status: "complete",
        outputStoragePath: outPath,
        outputDownloadUrl: downloadUrl,
        generationId,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        success: true,
        jobId,
        generationId,
        outputDownloadUrl: downloadUrl,
      };
    } catch (err: any) {
      // Refund + mark failed. refundCreditsTx is idempotent on jobId, so a
      // retry won't double-refund.
      try {
        await refundCreditsTx({
          userId,
          cost: config.creditCost,
          jobId,
          toolId,
          reason: String(err?.message ?? "unknown"),
        });
        await jobRef.update({
          status: "failed",
          error: String(err?.message ?? "unknown"),
          refunded: true,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (refundErr) {
        console.error("Refund failed for job", jobId, refundErr);
      }
      throw new HttpsError(
        "internal",
        `Generation failed: ${err?.message ?? "unknown"}`,
      );
    }
  },
);
