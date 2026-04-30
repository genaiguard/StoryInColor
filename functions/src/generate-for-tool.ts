import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import sharp from "sharp";
import fetch from "node-fetch";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";
import { getServerToolConfig } from "./tool-prompts";
import { refundCreditsTx } from "./credit-ledger";
import { dispatchServerConversion } from "./conversions/dispatch";
import type { ServerUserData } from "./conversions/types";

// Cloud Functions deduplicates secret bindings by name, so re-declaring here is
// safe even though `index.ts` already defines the same secret.
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
// Phase 4 — bound so the env exposes the values to dispatchServerConversion.
// Setting the values is a separate `firebase functions:secrets:set` step.
const META_CAPI_TOKEN = defineSecret("META_CAPI_TOKEN");
const GA4_MP_API_SECRET = defineSecret("GA4_MP_API_SECRET");

/** Helper: build ServerUserData from the caller's auth token + the
 *  attribution block on /users/{uid}. Used by both reading_started and
 *  reading_completed dispatches in this file. */
async function loadUserDataForConversions(
  userId: string,
  email: string | undefined,
  request: { rawRequest?: { ip?: string; get?: (h: string) => string | undefined } },
): Promise<ServerUserData> {
  let userData: ServerUserData = {
    uid: userId,
    email,
    ip: request.rawRequest?.ip,
    userAgent: request.rawRequest?.get?.("user-agent"),
  };
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    const attribution = userDoc.data()?.attribution as
      | { fbp?: string; fbc?: string; gaClientId?: string }
      | undefined;
    if (attribution) {
      userData = {
        ...userData,
        fbp: attribution.fbp || undefined,
        fbc: attribution.fbc || undefined,
        gaClientId: attribution.gaClientId || undefined,
      };
    }
  } catch {
    /* attribution doc missing for legacy users — server still fires with
       UID + email + ip + UA, just lower match quality */
  }
  return userData;
}

// Default to gpt-image-2 to match scripts/generate-sample.mjs — the script
// renders the marketing samples shown on every /readings/<slug> page, so prod
// MUST use the same model or signed-in users get a different aesthetic than
// the catalog promised. Override via `OPENAI_IMAGE_MODEL` Cloud Functions env
// var (no redeploy of code needed; just `firebase functions:config:set` or a
// .env entry) if we ever need to pin a specific dated snapshot.
//
// Per-tool overrides live on `ServerToolConfig.model` in tool-prompts.ts —
// coloring-book pins gpt-image-1 because its line-art conversion is sharper
// there. Resolution order is: tool override → env var → "gpt-image-2".
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

// `admin.initializeApp()` is invoked in `index.ts`, so we just grab handles.
const db = admin.firestore();
const bucket = admin.storage().bucket();

export const generateForTool = onCall(
  {
    secrets: [OPENAI_API_KEY, META_CAPI_TOKEN, GA4_MP_API_SECRET],
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

    // 0) Rate-limit: cap concurrent in-flight generations per user. A user
    // with credits could otherwise fire many parallel calls and burn through
    // OpenAI quota faster than they spend credits (each call costs $0.06–$0.25).
    // Three concurrent jobs is the cap — generous enough for a power user
    // running a few tools at once, low enough to absorb accidental loops.
    const MAX_CONCURRENT_JOBS = 3;
    const concurrent = await db
      .collection("users")
      .doc(userId)
      .collection("jobs")
      .where("status", "==", "processing")
      .limit(MAX_CONCURRENT_JOBS + 1)
      .get();
    if (concurrent.size >= MAX_CONCURRENT_JOBS) {
      throw new HttpsError(
        "resource-exhausted",
        `Too many in-flight generations (${MAX_CONCURRENT_JOBS}). Please wait for one to finish.`,
      );
    }

    // 0b) Daily cap on free tools (e.g. the coloring page). The coloring
    // page has creditCost: 0 so the credit-balance check below doesn't
    // gate it. Without this, an authenticated user could submit hundreds
    // of free generations per day at ~$0.06 each. Counted from the
    // userCredits/{uid}/usageEvents subcollection.
    //
    // Filtered server-side via a compound index on (cost, date) — see
    // firestore.indexes.json. This avoids a full scan of today's events
    // for users who run lots of paid jobs. We also `.limit(FREE_DAILY_CAP + 1)`
    // because we only need to know whether the count has hit the cap;
    // pulling more docs is wasted reads.
    const FREE_DAILY_CAP = 3;
    if (config.creditCost === 0) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const eventsToday = await db
        .collection("userCredits")
        .doc(userId)
        .collection("usageEvents")
        .where("cost", "==", 0)
        .where("date", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
        .limit(FREE_DAILY_CAP + 1)
        .get();
      // type==='deduct' filter stays in JS — refunds are also written here
      // and we shouldn't count them against the cap. Refund records have
      // type='refund' (or no type field on legacy docs), and refunds are
      // rare for free tools, so the JS-side filter is essentially a no-op
      // but keeps the invariant explicit.
      const freeToday = eventsToday.docs.filter(
        (d) => (d.data().type ?? "deduct") === "deduct",
      ).length;
      if (freeToday >= FREE_DAILY_CAP) {
        throw new HttpsError(
          "resource-exhausted",
          `DAILY_FREE_LIMIT_REACHED — ${FREE_DAILY_CAP} free per day.`,
        );
      }
    }

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
        lastUpdated: admin.firestore.Timestamp.now(),
      });
      // Append the deduct event to the unbounded subcollection (was an
      // arrayUnion on userCredits.usageHistory which capped at 1MB).
      const usageEventRef = credRef
        .collection("usageEvents")
        .doc(`deduct-${jobId}`);
      tx.set(usageEventRef, {
        type: "deduct",
        toolId,
        jobId,
        cost: config.creditCost,
        date: admin.firestore.Timestamp.now(),
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

    // Phase 4 conversion: ReadingStarted. Fires AFTER the credit transaction
    // commits so we never report a started event for a refused dispatch.
    // Kicked off in PARALLEL with the OpenAI call below — the OpenAI work
    // takes ~30s so the dispatch (bounded at 5s by the fetch timeout in
    // conversions/meta-capi.ts + ga4-mp.ts) completes free of charge against
    // the user-perceived latency. We hold a handle and await it before
    // returning so the Cloud Functions runtime doesn't CPU-freeze the
    // background work after our return value resolves.
    //
    // Note on dedup: ReadingStarted has no client-side counterpart by
    // design; the deterministic event_id `srv-readstart-${jobId}` exists
    // only to make repeat dispatches (e.g. from a Stripe-style webhook
    // retry, which doesn't apply here but mirrors the pattern) idempotent.
    const conversionUserData = await loadUserDataForConversions(
      userId,
      request.auth?.token?.email ?? undefined,
      request,
    );
    const readingStartedDispatch = dispatchServerConversion(
      {
        name: "ReadingStarted",
        eventId: `srv-readstart-${jobId}`,
        customData: {
          content_type: "reading",
          content_ids: [toolId],
          content_category: "reading_dispatch",
          tool_id: toolId,
          credit_cost: config.creditCost,
          job_id: jobId,
        },
      },
      conversionUserData,
    ).then((res) => {
      // Always log a one-line summary so verifying CAPI/MP from Cloud Logs
      // doesn't depend on tooling — ok=true / ok=false at a glance.
      console.log("[Conversions] ReadingStarted result:", JSON.stringify(res));
      return res;
    }).catch((convErr) => {
      console.warn("[Conversions] ReadingStarted dispatch failed (non-fatal):", convErr);
      return null;
    });

    // 2) Run generation; on ANY failure, refund and mark failed.
    try {
      // Per-tool input preprocessing — `detail` tools get a 1536px high-quality
      // input, `contrast` boosts ink/paper for handwriting, `exif-rotate` fixes
      // sideways meal photos. Output_format/moderation params follow our
      // gpt-image research recommendations and apply to both gpt-image-1 and
      // gpt-image-2.
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

      // /v1/images/edits expects multipart/form-data (image attachment).
      // /v1/images/generations expects application/json. Mixing them up
      // returns OpenAI 400 unsupported_content_type — that was the bug
      // the script + this handler had until 2026-04-29; aura-reading
      // (the only generations-endpoint tool today) was unable to render
      // for any signed-in user.
      //
      // input_fidelity is a gpt-image-1 parameter and is rejected/ignored on
      // gpt-image-2 (the new model handles fidelity differently). Mirror
      // scripts/generate-sample.mjs and only send it on gpt-image-1.
      // Per-tool model override (config.model) wins over the env default.
      const modelForRequest = config.model || IMAGE_MODEL;
      const isGptImage2 = modelForRequest.startsWith("gpt-image-2");
      console.log(`[Generation] tool=${toolId} model=${modelForRequest} endpoint=${config.endpoint} jobId=${jobId}`);
      let resp: Response;
      if (config.endpoint === "edits") {
        if (!inputBuffer) {
          throw new Error("Internal: input buffer missing for edits endpoint");
        }
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
        // generations — JSON body, no image attachment
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

      // Phase 4 conversion: ReadingCompleted (the activation event). Fires
      // after the job + generation docs have committed so a downstream
      // crash doesn't double-count. Bounded at 5s by the per-fetch timeouts
      // in meta-capi.ts + ga4-mp.ts. Non-fatal — we've already collected
      // payment and produced the output, so a tracker miss is just lost
      // visibility, not a user-facing failure.
      try {
        const completedRes = await dispatchServerConversion(
          {
            name: "ReadingCompleted",
            eventId: `srv-readdone-${jobId}`,
            customData: {
              content_type: "reading",
              content_ids: [toolId],
              content_category: "reading_completion",
              tool_id: toolId,
              credit_cost: config.creditCost,
              job_id: jobId,
              generation_id: generationId,
            },
          },
          conversionUserData,
        );
        console.log("[Conversions] ReadingCompleted result:", JSON.stringify(completedRes));
      } catch (convErr) {
        console.warn("[Conversions] ReadingCompleted dispatch failed (non-fatal):", convErr);
      }

      // Drain the ReadingStarted dispatch we kicked off in parallel BEFORE
      // returning. If it's still in-flight, the runtime would CPU-freeze
      // the promise after our return value resolves. Bounded by the same
      // 5s fetch timeout in the helpers.
      await readingStartedDispatch;

      return {
        success: true,
        jobId,
        generationId,
        outputDownloadUrl: downloadUrl,
      };
    } catch (err: any) {
      const reason = String(err?.message ?? "unknown");
      // Order matters: flip the job to `failed` FIRST so the result page
      // unblocks even if the refund write throws. The job doc holds
      // `refunded: false` until the refund succeeds; the result page
      // surfaces the failure reason regardless. Each step has its own
      // try/catch so neither can block the other.
      try {
        await jobRef.update({
          status: "failed",
          error: reason,
          refunded: false,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (jobUpdateErr) {
        console.error(
          "CRITICAL: failed to mark job as failed — result page will spin",
          { jobId, reason, jobUpdateErr },
        );
      }
      try {
        await refundCreditsTx({
          userId,
          cost: config.creditCost,
          jobId,
          toolId,
          reason,
        });
        // refund succeeded — flag it on the job for audit visibility
        await jobRef
          .update({ refunded: true })
          .catch((e) =>
            console.error("Failed to flag job.refunded=true", { jobId, e }),
          );
      } catch (refundErr) {
        console.error("CRITICAL: refund failed for job", { jobId, refundErr });
      }

      // Phase 4 conversion: ReadingFailed. Funnel-completion telemetry —
      // without this, the per-source admin breakdown shows ReadingStarted
      // events with no terminal counterpart (looks like in-flight forever).
      // Custom event in Meta CAPI; standard custom event in GA4 MP.
      try {
        const failedRes = await dispatchServerConversion(
          {
            name: "ReadingFailed",
            eventId: `srv-readfail-${jobId}`,
            customData: {
              content_type: "reading",
              content_ids: [toolId],
              content_category: "reading_failure",
              tool_id: toolId,
              credit_cost: config.creditCost,
              job_id: jobId,
              failure_reason: reason.slice(0, 200),
            },
          },
          conversionUserData,
        );
        console.log("[Conversions] ReadingFailed result:", JSON.stringify(failedRes));
      } catch (convErr) {
        console.warn("[Conversions] ReadingFailed dispatch failed (non-fatal):", convErr);
      }

      // Drain the parallel ReadingStarted dispatch even on failure path —
      // same lifetime concern as the success path.
      await readingStartedDispatch;

      throw new HttpsError("internal", `Generation failed: ${reason}`);
    }
  },
);
