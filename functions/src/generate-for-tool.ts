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
    const {
      toolId,
      photoStoragePath,
      jobId: clientJobId,
    } = (request.data ?? {}) as {
      toolId?: unknown;
      photoStoragePath?: unknown;
      jobId?: unknown;
    };
    if (typeof toolId !== "string" || typeof photoStoragePath !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Missing toolId or photoStoragePath.",
      );
    }
    // Validate optional client-supplied jobId — must be a UUID. Accepting
    // this lets the client navigate to /result?jobId=… BEFORE the long
    // OpenAI call returns, so the user sees the polling result page
    // immediately instead of staring at the upload card for 30s.
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (clientJobId !== undefined && (typeof clientJobId !== "string" || !uuidRe.test(clientJobId))) {
      throw new HttpsError("invalid-argument", "Invalid jobId — must be a UUID.");
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

    const jobId = (clientJobId as string | undefined) ?? uuidv4();
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
    // trigger a refund attempt. The transaction is idempotent on jobId: if
    // a job doc already exists for this jobId (client retry / double-fire),
    // we no-op rather than double-deduct.
    let alreadyStarted = false;
    await db.runTransaction(async (tx) => {
      const existingJob = await tx.get(jobRef);
      if (existingJob.exists) {
        alreadyStarted = true;
        return;
      }
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

    // Idempotency: if the job already existed when we entered, skip the
    // generation work entirely. The original call (or a sibling retry) is
    // already producing or has produced the output.
    if (alreadyStarted) {
      return { success: true, jobId, alreadyStarted: true };
    }

    // 2) Run generation; on ANY failure, refund and mark failed.
    try {
      // Per-tool input preprocessing — `detail` tools get a 1536px high-quality
      // input, `contrast` boosts ink/paper for handwriting, `exif-rotate` fixes
      // sideways meal photos. Output_format/moderation params follow Agent C's
      // gpt-image-1 research recommendations.
      let inputBuffer: Buffer | null = null;
      let inputContentType = "image/jpeg";
      let inputFilename = "image.jpg";

      if (config.endpoint === "edits") {
        // SECURITY guard already enforced photoStoragePath.startsWith(`users/${userId}/`).
        const [origBuffer] = await bucket.file(photoStoragePath).download();
        let pipeline = sharp(origBuffer);

        if (config.preprocessing === "exif-rotate") {
          pipeline = pipeline.rotate(); // honors EXIF orientation
        }
        if (config.preprocessing === "contrast") {
          pipeline = pipeline.normalise().linear(1.2, -10);
        }

        const detail = config.preprocessing === "detail";
        const targetDim = detail ? 1536 : 1024;
        pipeline = pipeline.resize({
          width: targetDim,
          height: targetDim,
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        });

        if (detail) {
          inputBuffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
          inputContentType = "image/png";
          inputFilename = "image.png";
        } else {
          inputBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
        }
      }

      const formData = new FormData();
      formData.append("model", "gpt-image-1");
      formData.append("prompt", config.prompt);
      formData.append("n", "1");
      formData.append("size", config.imageSize);
      formData.append("quality", config.quality);
      formData.append("output_format", "png");
      formData.append("moderation", "low");

      if (config.endpoint === "edits") {
        if (!inputBuffer) {
          throw new Error("Internal: input buffer missing for edits endpoint");
        }
        formData.append("input_fidelity", config.inputFidelity);
        formData.append("image", inputBuffer, {
          filename: inputFilename,
          contentType: inputContentType,
        });
      }

      const apiUrl =
        config.endpoint === "generations"
          ? "https://api.openai.com/v1/images/generations"
          : "https://api.openai.com/v1/images/edits";

      const resp = await fetch(apiUrl, {
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
