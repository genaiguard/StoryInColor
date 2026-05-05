// Webhook handler for quiz_purchase Stripe sessions.
// Per QUIZ-PIVOT-SPEC.md §3.3.4 §8.7.
//
// Called from stripeWebhook (functions/src/index.ts) inside the
// `if (session.metadata?.type === 'quiz_purchase')` branch — purely
// additive, the existing credit_purchase branch is unchanged.

import * as admin from "firebase-admin";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { dispatchServerConversion } from "./conversions/dispatch";
import type { ServerUserData } from "./conversions/types";
import type { PendingReadingDoc } from "./quiz-types";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

interface HandleQuizPurchaseInput {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
  // stripe client passed for future expansion (e.g., subscription
  // metadata sync at the moment of payment); unused in v1 handler.
  stripe?: unknown;
}

interface HandleQuizPurchaseResult {
  ok: boolean;
  granted: boolean;
  reason: string;
  uid?: string;
}

/**
 * Materializes the user account, claims the pending reading, and grants
 * either a one-time credit (single tier) or a subscription with monthly
 * allowance (monthly/annual tier). Idempotent on Stripe event id.
 */
export async function handleQuizPurchase(
  input: HandleQuizPurchaseInput,
): Promise<HandleQuizPurchaseResult> {
  const { event, session } = input;
  const token = session.metadata?.pendingReadingToken;
  const tier = session.metadata?.tier as
    | "single"
    | "monthly"
    | "annual"
    | "trial_dollar"
    | undefined;
  const stripeEventId = event.id;

  if (!token || !tier) {
    return { ok: false, granted: false, reason: "missing-metadata" };
  }
  if (session.payment_status !== "paid" && tier !== "monthly") {
    // For monthly with trial, payment_status may be "no_payment_required"
    // when the trial starts; we still want to claim the reading.
    if (
      session.payment_status === "no_payment_required" ||
      session.status === "complete"
    ) {
      // continue
    } else {
      console.log(
        `[QuizWebhook] Session ${session.id} not paid (status=${session.payment_status}); skipping.`,
      );
      return { ok: false, granted: false, reason: "not-paid" };
    }
  }

  const pendingRef = db.collection("pendingReadings").doc(token);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    console.warn(`[QuizWebhook] Pending reading ${token} not found.`);
    return { ok: false, granted: false, reason: "pending-not-found" };
  }
  const pending = pendingSnap.data() as PendingReadingDoc;

  // Idempotency: dedupe on Stripe event id (mirrors credit_purchase logic).
  const markerRef = db.collection("processedStripeEvents").doc(stripeEventId);

  const result = await db.runTransaction(async (tx) => {
    const markerSnap = await tx.get(markerRef);
    if (markerSnap.exists) {
      return {
        ok: true,
        granted: false,
        reason: "already-processed" as const,
        uid: pending.claimedByUid,
      };
    }

    // Find or create Firebase Auth user keyed on email
    const email = pending.email || session.customer_email || session.customer_details?.email;
    if (!email) {
      throw new Error("No email found on pendingReading or session");
    }

    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const newUser = await auth.createUser({
        email,
        emailVerified: false,
      });
      uid = newUser.uid;
    }

    const userRef = db.collection("users").doc(uid);
    const userCreditsRef = db.collection("userCredits").doc(uid);

    // Materialize users/{uid} with attribution from the pending reading
    const userDocSnap = await tx.get(userRef);
    if (!userDocSnap.exists) {
      tx.set(userRef, {
        email,
        attribution: pending.attribution || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sourceFlow: "quiz",
        sourceQuizSlug: pending.toolId,
      });
    } else {
      // Existing user — just stamp the most recent quiz source on the record
      tx.update(userRef, {
        lastQuizSlug: pending.toolId,
        lastQuizClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // userCredits — additive: existing pack-buyer fields preserved if present.
    const userCreditsSnap = await tx.get(userCreditsRef);
    const isSubscription = tier === "monthly" || tier === "annual";
    const allowance = tier === "monthly" ? 3 : tier === "annual" ? 4 : 0;

    if (!userCreditsSnap.exists) {
      tx.set(userCreditsRef, {
        balance: 0,
        used: 0,
        topUpCredits: 0,
        purchaseHistory: [
          {
            packageId: `quiz_${tier}`,
            creditAmount: tier === "single" || tier === "trial_dollar" ? 1 : 0,
            pricePaid: session.amount_total || 0,
            purchaseDate: new Date(),
            stripeEventId,
            stripeSessionId: session.id,
            tier,
          },
        ],
        ...(isSubscription
          ? {
              subscription: {
                status: session.subscription
                  ? "active"
                  : ("trialing" as const),
                plan: tier,
                stripeSubscriptionId: session.subscription || null,
                stripeCustomerId: session.customer || null,
                monthlyAllowance: allowance,
                monthlyAllowanceUsed: 0,
                currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
              },
            }
          : {}),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Existing user — additively grant
      const update: { [k: string]: admin.firestore.FieldValue | Partial<unknown> | unknown } = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        purchaseHistory: admin.firestore.FieldValue.arrayUnion({
          packageId: `quiz_${tier}`,
          creditAmount: tier === "single" || tier === "trial_dollar" ? 1 : 0,
          pricePaid: session.amount_total || 0,
          purchaseDate: new Date(),
          stripeEventId,
          stripeSessionId: session.id,
          tier,
        }),
      };
      if (isSubscription) {
        update.subscription = {
          status: session.subscription ? "active" : "trialing",
          plan: tier,
          stripeSubscriptionId: session.subscription || null,
          stripeCustomerId: session.customer || null,
          monthlyAllowance: allowance,
          monthlyAllowanceUsed: 0,
          currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
        };
      }
      tx.update(userCreditsRef, update as { [x: string]: admin.firestore.FieldValue | Partial<unknown> | undefined });
    }

    // Materialize userProfiles/{uid} (additive — empty/seed profile)
    const profileRef = db.collection("userProfiles").doc(uid);
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists) {
      tx.set(profileRef, {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        primaryReadingCategory: pending.toolId,
        quizAnswers: pending.quizAnswers || {},
        readings: [],
        archetypes: {},
        aspirations: extractAspirations(pending.quizAnswers || {}),
        reflections: {
          enabled: isSubscription,
          cadence: "daily",
          deliveryChannels: ["email"],
          preferredHourLocal: 7,
          timezone: "UTC",
        },
        subscriptionStatus: isSubscription
          ? session.subscription
            ? "active"
            : "trialing"
          : "none",
      });
    }

    // Mark pending claimed (output move happens outside the transaction
    // because Storage isn't in the txn)
    tx.update(pendingRef, {
      claimedByUid: uid,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "claimed",
    });

    // Idempotency marker
    const expireAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    );
    tx.set(markerRef, {
      stripeEventId,
      stripeSessionId: session.id,
      userId: uid,
      type: "quiz_purchase",
      tier,
      pendingReadingToken: token,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt,
    });

    return {
      ok: true,
      granted: true,
      reason: "processed" as const,
      uid,
    };
  });

  if (!result.granted) {
    return result;
  }

  // Outside transaction: move the pending output into the user's permanent
  // storage so the dashboard can display it. If this fails, the reading
  // stays accessible at the pending path until TTL — so it's recoverable.
  try {
    const uid = result.uid!;
    if (pending.outputStoragePath) {
      const generationId = `quiz-${token}`;
      const newPath = `users/${uid}/generations/${generationId}.png`;
      await bucket.file(pending.outputStoragePath).move(newPath);

      // Generate a fresh download token for the moved file
      const { v4: uuidv4 } = await import("uuid");
      const downloadToken = uuidv4();
      await bucket.file(newPath).setMetadata({
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      });
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media&token=${downloadToken}`;

      // Write a generation record into users/{uid}/generations/
      const genRef = db
        .collection("users")
        .doc(uid)
        .collection("generations")
        .doc(generationId);
      await genRef.set({
        generationId,
        userId: uid,
        toolId: pending.toolId,
        outputStoragePath: newPath,
        outputDownloadUrl: downloadUrl,
        sourceFlow: "quiz",
        pendingReadingToken: token,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Append the reading to userProfiles.readings
      await db
        .collection("userProfiles")
        .doc(uid)
        .update({
          readings: admin.firestore.FieldValue.arrayUnion({
            generationId,
            toolId: pending.toolId,
            completedAt: admin.firestore.Timestamp.now(),
          }),
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  } catch (moveErr) {
    console.error(
      `[QuizWebhook] Failed to move pending output for token=${token}:`,
      moveErr,
    );
    // Non-fatal — the dashboard can still pull from the pending path until TTL.
  }

  // Fire Purchase CAPI/MP with the shared fbEventId (dedup with browser Pixel)
  try {
    const eventId =
      (typeof pending.fbEventId === "string" && pending.fbEventId.length > 0)
        ? pending.fbEventId
        : `srv-quiz-purchase-${session.id}`;
    const userData: ServerUserData = {
      uid: result.uid!,
      email: pending.email,
      fbp: pending.attribution?.fbp,
      fbc: pending.attribution?.fbc,
      gaClientId: pending.attribution?.gaClientId,
    };
    await dispatchServerConversion(
      {
        name: "Purchase",
        eventId,
        customData: {
          currency: "USD",
          value: (session.amount_total || 0) / 100,
          content_ids: [`quiz_${tier}`],
          content_name: "Quiz Funnel Purchase",
          content_category: tier,
          num_items: 1,
          transaction_id: session.id,
        },
      },
      userData,
    );
  } catch (convErr) {
    console.warn("[QuizWebhook] Purchase CAPI dispatch failed (non-fatal):", convErr);
  }

  return result;
}

/**
 * Extract cross-cutting aspirations from quiz answers.
 * For now: pulls any answer to a question id ending in "-aspiration".
 */
function extractAspirations(quizAnswers: Record<string, string>): string[] {
  const result: string[] = [];
  for (const [questionId, optionId] of Object.entries(quizAnswers)) {
    if (questionId.endsWith("-aspiration") || questionId === "shared-aspiration") {
      result.push(optionId);
    }
  }
  return result;
}
