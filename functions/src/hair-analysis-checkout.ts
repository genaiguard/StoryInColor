// Hair analysis checkout + email capture + credit unlock.
// Mirrors face-rating-checkout.ts pattern. Single SKU: $4.99 one-time.
// Lookup key: hair_analysis_single_v1.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import StripeImport from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { isValidEmail, isValidToken } from "./face-rating-helpers";
import type { PendingHairAnalysisDoc } from "./hair-analysis-types";
import { deductCreditsTx } from "./credit-ledger";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");
const SENDER_EMAIL_ADDRESS = defineSecret("SENDER_EMAIL_ADDRESS");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

const HAIR_LOOKUP_KEY = "hair_analysis_single_v1";
const priceCache = new Map<string, string>();

function requireOwnerSecret(doc: PendingHairAnalysisDoc, supplied: unknown): void {
  if (
    !doc.ownerSecret ||
    typeof supplied !== "string" ||
    supplied.length === 0 ||
    supplied !== doc.ownerSecret
  ) {
    throw new HttpsError(
      "permission-denied",
      "Missing or invalid ownerSecret.",
    );
  }
}

function isHairDoc(d: unknown): d is PendingHairAnalysisDoc {
  return !!d && typeof d === "object" && (d as PendingHairAnalysisDoc).type === "hair-analysis";
}

async function getHairDoc(token: string): Promise<{ ref: admin.firestore.DocumentReference; doc: PendingHairAnalysisDoc }> {
  const ref = db.collection("pendingReadings").doc(token);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Reading not found or expired.");
  const doc = snap.data();
  if (!isHairDoc(doc)) throw new HttpsError("failed-precondition", "Not a hair-analysis reading.");
  if (doc.status === "expired") throw new HttpsError("failed-precondition", "This reading has expired.");
  return { ref, doc };
}

async function getStripePrice(stripe: InstanceType<typeof StripeImport>): Promise<string> {
  const cached = priceCache.get(HAIR_LOOKUP_KEY);
  if (cached) return cached;
  const prices = await stripe.prices.list({ lookup_keys: [HAIR_LOOKUP_KEY], limit: 1 });
  const price = prices.data[0];
  if (!price) throw new HttpsError("internal", "Hair analysis price not configured in Stripe.");
  priceCache.set(HAIR_LOOKUP_KEY, price.id);
  return price.id;
}

async function buildTokenUrl(storagePath: string): Promise<string> {
  const [meta] = await bucket.file(storagePath).getMetadata();
  const token = (meta.metadata as Record<string, string> | undefined)?.firebaseStorageDownloadTokens;
  if (!token) throw new Error(`No download token for ${storagePath}`);
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

/* ------------------------------------------------------------------ */
/* captureHairEmail                                                     */
/* ------------------------------------------------------------------ */

export const captureHairEmail = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
    secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SENDER_EMAIL_ADDRESS],
  },
  async (request) => {
    const { token, email, marketingOptIn = false } = (request.data ?? {}) as {
      token?: string;
      email?: string;
      marketingOptIn?: boolean;
    };
    if (!token || !isValidToken(token)) throw new HttpsError("invalid-argument", "Invalid token.");
    if (!email || !isValidEmail(email)) throw new HttpsError("invalid-argument", "Invalid email.");

    const { ref, doc } = await getHairDoc(token);
    if (doc.email) return { success: true }; // already captured

    await ref.update({
      email,
      marketingOptIn,
      emailCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  },
);

/* ------------------------------------------------------------------ */
/* createHairCheckoutSession                                            */
/* ------------------------------------------------------------------ */

export const createHairCheckoutSession = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    const { token, successUrl } = (request.data ?? {}) as {
      token?: string;
      successUrl?: string;
    };
    if (!token || !isValidToken(token)) throw new HttpsError("invalid-argument", "Invalid token.");

    const { ref, doc } = await getHairDoc(token);
    if (doc.status === "claimed") {
      return { success: true, alreadyClaimed: true };
    }

    const stripe = new StripeImport(STRIPE_SECRET_KEY.value(), { apiVersion: "2026-04-22.dahlia" } as Parameters<typeof StripeImport>[1]);
    const priceId = await getStripePrice(stripe);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      ui_mode: "embedded_page",
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: successUrl
        ? `${successUrl}?session_id={CHECKOUT_SESSION_ID}&token=${token}`
        : `https://storyincolor.com/hair-analysis/result?session_id={CHECKOUT_SESSION_ID}&token=${token}`,
      redirect_on_completion: "if_required",
      branding_settings: {
        display_name: "StoryInColor",
        background_color: "#0a0a0a",
        button_color: "#ffffff",
        font_family: "inter",
        border_style: "rounded",
      },
      payment_method_options: {
        card: {
          request_three_d_secure: "automatic",
        },
      },
      metadata: { token, type: "hair_analysis_purchase" },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    await ref.update({ stripeCheckoutSessionId: session.id });

    return { success: true, clientSecret: session.client_secret };
  },
);

/* ------------------------------------------------------------------ */
/* getHairReport — called on result page load                           */
/* ------------------------------------------------------------------ */

export const getHairReport = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    const { token } = (request.data ?? {}) as {
      token?: string;
    };
    if (!token || !isValidToken(token)) throw new HttpsError("invalid-argument", "Invalid token.");

    const { doc } = await getHairDoc(token);

    const isUnlocked = doc.status === "claimed" || doc.paidViaCredit;

    // Build preview cell URL
    let previewCellUrl: string | null = null;
    if (doc.previewCellPath) {
      try {
        previewCellUrl = await buildTokenUrl(doc.previewCellPath);
      } catch { /* non-fatal */ }
    }

    if (!isUnlocked) {
      return {
        status: "locked",
        previewCellUrl,
        styleLabels: doc.styleLabels ?? [],
        faceShape: doc.faceShape ?? "oval",
        emailCaptured: !!doc.email,
      };
    }

    // Build all cell URLs
    const cells: Array<{ label: string; url: string }> = [];
    if (doc.cellPaths && doc.styleLabels) {
      for (let i = 0; i < doc.cellPaths.length; i++) {
        try {
          const url = await buildTokenUrl(doc.cellPaths[i]);
          cells.push({ label: doc.styleLabels[i] ?? `Style ${i + 1}`, url });
        } catch { /* skip broken cell */ }
      }
    }

    return {
      status: "unlocked",
      faceShape: doc.faceShape ?? "oval",
      styleLabels: doc.styleLabels ?? [],
      cells,
      stylistBrief: doc.stylistBrief ?? "",
    };
  },
);

/* ------------------------------------------------------------------ */
/* unlockHairWithCredit — signed-in users skip Stripe                  */
/* ------------------------------------------------------------------ */

export const unlockHairWithCredit = onCall(
  {
    invoker: "public",
    timeoutSeconds: 60,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be signed in.");

    const { token, ownerSecret } = (request.data ?? {}) as {
      token?: string;
      ownerSecret?: string;
    };
    if (!token || !isValidToken(token)) throw new HttpsError("invalid-argument", "Invalid token.");

    const { ref, doc } = await getHairDoc(token);
    requireOwnerSecret(doc, ownerSecret);

    if (doc.status === "claimed") return { success: true };

    // Deduct 1 credit and mark claimed atomically — throws INSUFFICIENT_CREDITS if balance < 1
    await deductCreditsTx({
      userId: uid,
      cost: 1,
      jobId: token,
      toolId: "hair-analysis",
      onTransaction: (tx) => {
        tx.update(ref, {
          status: "claimed",
          paidViaCredit: true,
          claimedByUid: uid,
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        } as FirebaseFirestore.UpdateData<import("./hair-analysis-types").PendingHairAnalysisDoc>);
      },
    });

    return { success: true };
  },
);

/* ------------------------------------------------------------------ */
/* claimHairAccount — set password post-purchase (anonymous flow)      */
/* ------------------------------------------------------------------ */

export const claimHairAccount = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    const { token, ownerSecret, password } = (request.data ?? {}) as {
      token?: string;
      ownerSecret?: string;
      password?: string;
    };
    if (!token || !isValidToken(token)) throw new HttpsError("invalid-argument", "Invalid token.");
    if (typeof password !== "string" || password.length < 8) {
      throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }

    const { ref, doc } = await getHairDoc(token);
    requireOwnerSecret(doc, ownerSecret);

    if (!doc.email) throw new HttpsError("failed-precondition", "No email on file for this reading.");
    if (doc.claimedByUid) return { success: true, email: doc.email };

    const auth = admin.auth();
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(doc.email);
      uid = existing.uid;
      await auth.updateUser(uid, { password });
    } catch {
      const created = await auth.createUser({ email: doc.email, password });
      uid = created.uid;
    }

    await ref.update({
      claimedByUid: uid,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, email: doc.email };
  },
);

/* ------------------------------------------------------------------ */
/* deleteHairPhoto                                                      */
/* ------------------------------------------------------------------ */

export const deleteHairPhoto = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    const { token, ownerSecret } = (request.data ?? {}) as {
      token?: string;
      ownerSecret?: string;
    };
    if (!token || !isValidToken(token)) throw new HttpsError("invalid-argument", "Invalid token.");

    const { ref, doc } = await getHairDoc(token);
    requireOwnerSecret(doc, ownerSecret);

    const pathsToDelete = [
      doc.photoStoragePath,
      doc.previewCellPath,
      ...(doc.cellPaths ?? []),
    ].filter(Boolean) as string[];

    await Promise.allSettled(
      pathsToDelete.map((p) => bucket.file(p).delete().catch(() => {})),
    );

    await ref.update({ photosDeleted: true, photosDeletedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
  },
);
