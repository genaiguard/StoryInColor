import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { dispatchServerConversion } from "./conversions/dispatch";
import type { ServerUserData } from "./conversions/types";

const db = admin.firestore();

// CAPI / GA4 MP secrets must be bound on every function that calls
// dispatchServerConversion so process.env exposes them. Same pattern as
// stripeWebhook + generateForTool.
const META_CAPI_TOKEN = defineSecret("META_CAPI_TOKEN");
const GA4_MP_API_SECRET = defineSecret("GA4_MP_API_SECRET");

// One credit == one reading. No signup grant — every editorial reading is
// paid. The coloring page is the only free tool (creditCost: 0 in
// tool-prompts.ts) and doesn't count against this balance.
const FREE_CREDITS_PER_USER = 0;

interface EnsureUserCreditsInput {
    /**
     * Optional event_id from the client-side trackCompleteRegistration emit.
     * Threaded through so the server-side CAPI mirror dedupes with the
     * Pixel emit within Meta's 48h dedup window. If absent we mint our own
     * server id ("srv-reg-<uid>") — Meta won't dedupe, but it'll still
     * record the event with reduced match quality.
     */
    eventId?: string;
    /** "email" | "google" — passed through to the CAPI custom_data. */
    method?: string;
}

/**
 * Server-side, idempotent initialiser for the userCredits doc.
 *
 * Why: firestore.rules is locked so users CANNOT write their own
 * userCredits/{uid}/{*} — otherwise a malicious user could grant themselves
 * unlimited balance from the browser console. The doc is now written only
 * via admin SDK (bypasses rules). On a fresh sign-up the client calls this
 * callable; existing users with a doc already in place no-op.
 *
 * Idempotent on userId — if the doc exists, we return it as-is. The Stripe
 * webhook is the only other path that writes this doc.
 *
 * On first creation we also fire a server-side CAPI CompleteRegistration
 * mirror so Meta has both Pixel + CAPI signal for ad-set optimization.
 * The campaign's ad set optimizes on COMPLETE_REGISTRATION — the CAPI
 * mirror recovers ~10–20% of events lost to iOS 14.5+ tracking blocks
 * and ad blockers, and improves Meta's match quality.
 */
export const ensureUserCredits = onCall<EnsureUserCreditsInput>(
    { secrets: [META_CAPI_TOKEN, GA4_MP_API_SECRET] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const userId = request.auth.uid;
        const ref = db.collection("userCredits").doc(userId);
        const snap = await ref.get();
        if (snap.exists) {
            return { created: false };
        }

        const now = admin.firestore.Timestamp.now();
        // Only seed a "welcome" purchaseHistory entry when the signup grant is
        // greater than zero. With the current 0-grant pricing, the doc starts
        // empty — purchaseHistory only fills as the user actually buys packs.
        await ref.set({
            balance: FREE_CREDITS_PER_USER,
            used: 0,
            purchaseHistory:
                FREE_CREDITS_PER_USER > 0
                    ? [
                          {
                              packageId: "initial",
                              creditAmount: FREE_CREDITS_PER_USER,
                              pricePaid: 0,
                              purchaseDate: now,
                              isInitialCredits: true,
                          },
                      ]
                    : [],
            // usageHistory array intentionally omitted — usage events live in the
            // userCredits/{uid}/usageEvents subcollection (see credit-ledger.ts).
            lastUpdated: now,
        });

        // Fire CAPI CompleteRegistration. Wrapped in its own try/catch so a
        // tracker failure never blocks the userCredits doc creation — losing
        // a CAPI event is recoverable (Pixel still fires client-side); a
        // failed bootstrap leaves the user unable to use the product.
        try {
            const eventId =
                (typeof request.data?.eventId === "string" && request.data.eventId.length > 0)
                    ? request.data.eventId
                    : `srv-reg-${userId}`;
            const method = request.data?.method;

            // Attribution cookies (fbp, fbc, gaClientId) live on users/{uid}.
            // persistUserProfileAndAttribution writes them at signup BEFORE
            // ensureUserCredits is called by the dashboard, so they should be
            // present. If absent we proceed with reduced match quality.
            let userData: ServerUserData = {
                email: request.auth.token.email || undefined,
                uid: userId,
                ip: request.rawRequest?.ip || undefined,
                userAgent: request.rawRequest?.headers?.["user-agent"] as string | undefined,
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
            } catch (attrErr) {
                console.warn(
                    "[Conversions] Could not load user attribution for CompleteRegistration:",
                    attrErr,
                );
            }

            const dispatched = await dispatchServerConversion(
                {
                    name: "CompleteRegistration",
                    eventId,
                    customData: {
                        content_name: "User Registration",
                        ...(method ? { method } : {}),
                    },
                },
                userData,
            );
            console.log(
                "[Conversions] CompleteRegistration dispatch result:",
                JSON.stringify(dispatched),
            );
        } catch (convErr) {
            console.error(
                "[Conversions] CompleteRegistration mirror failed (non-fatal):",
                convErr,
            );
        }

        return { created: true };
    },
);
