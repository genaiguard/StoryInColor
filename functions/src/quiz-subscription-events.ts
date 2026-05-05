// Subscription lifecycle event handlers for quiz funnel subscribers.
// Per QUIZ-PIVOT-SPEC.md §17.6 §8.7.
//
// Called from stripeWebhook for these event types:
//   - invoice.paid          → reset monthly allowance, mark currentPeriodStart/End
//   - customer.subscription.updated → status sync (active / past_due / canceled)
//   - customer.subscription.deleted → status = canceled, allowance retained until period end

import * as admin from "firebase-admin";
import type { Stripe } from "stripe/cjs/stripe.core.js";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function handleSubscriptionLifecycleEvent(
  event: Stripe.Event,
): Promise<void> {
  const stripeEventId = event.id;
  const markerRef = db.collection("processedStripeEvents").doc(stripeEventId);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) {
    console.log(`[QuizSub] Event ${stripeEventId} already processed`);
    return;
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    await updateSubscriptionStatus(subscription, event.type);
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    // `subscription` field exists at runtime on subscription invoices but
    // was renamed/restructured in newer Stripe API typings; access via cast.
    if ((invoice as unknown as { subscription?: string | { id: string } }).subscription) {
      await resetMonthlyAllowance(invoice);
    }
  }

  // Idempotency marker
  const expireAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + 90 * 24 * 60 * 60 * 1000,
  );
  await markerRef.set({
    stripeEventId,
    type: "subscription_lifecycle",
    eventType: event.type,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt,
  });
}

async function updateSubscriptionStatus(
  subscription: Stripe.Subscription,
  eventType: string,
): Promise<void> {
  // Find the userCredits doc by stripeSubscriptionId
  const credSnap = await db
    .collection("userCredits")
    .where("subscription.stripeSubscriptionId", "==", subscription.id)
    .limit(1)
    .get();
  if (credSnap.empty) {
    console.log(
      `[QuizSub] No userCredits doc for stripeSubscriptionId=${subscription.id}`,
    );
    return;
  }
  const doc = credSnap.docs[0];
  const status = mapStripeStatusToInternal(subscription.status, eventType);
  const update: Record<string, unknown> = {
    "subscription.status": status,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (eventType === "customer.subscription.deleted") {
    update["subscription.canceledAt"] = admin.firestore.FieldValue.serverTimestamp();
  }
  // current_period_end exists on the runtime object but isn't in the
  // current SDK type for the 2026-04-22.dahlia API; access via cast.
  const cpe = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (cpe) {
    update["subscription.currentPeriodEnd"] = admin.firestore.Timestamp.fromMillis(
      cpe * 1000,
    );
  }
  await doc.ref.update(update);

  // Mirror to userProfiles
  const uid = doc.id;
  await db
    .collection("userProfiles")
    .doc(uid)
    .update({
      subscriptionStatus: status,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch((e) =>
      console.warn("[QuizSub] userProfiles status mirror failed (non-fatal):", e),
    );
}

async function resetMonthlyAllowance(invoice: Stripe.Invoice): Promise<void> {
  const sub = (invoice as unknown as {
    subscription?: string | { id: string };
  }).subscription;
  const stripeSubId = typeof sub === "string" ? sub : sub?.id;
  if (!stripeSubId) return;
  const credSnap = await db
    .collection("userCredits")
    .where("subscription.stripeSubscriptionId", "==", stripeSubId)
    .limit(1)
    .get();
  if (credSnap.empty) {
    console.log(`[QuizSub] No userCredits for stripeSubId=${stripeSubId} on invoice.paid`);
    return;
  }
  const doc = credSnap.docs[0];
  const currentPeriodStart = invoice.period_start
    ? admin.firestore.Timestamp.fromMillis(invoice.period_start * 1000)
    : admin.firestore.FieldValue.serverTimestamp();
  const currentPeriodEnd = invoice.period_end
    ? admin.firestore.Timestamp.fromMillis(invoice.period_end * 1000)
    : null;
  const update: Record<string, unknown> = {
    "subscription.monthlyAllowanceUsed": 0,
    "subscription.currentPeriodStart": currentPeriodStart,
    "subscription.status": "active",
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (currentPeriodEnd) {
    update["subscription.currentPeriodEnd"] = currentPeriodEnd;
  }
  await doc.ref.update(update);
}

function mapStripeStatusToInternal(
  stripeStatus: Stripe.Subscription.Status,
  eventType: string,
): string {
  if (eventType === "customer.subscription.deleted") return "canceled";
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    default:
      return "active";
  }
}
