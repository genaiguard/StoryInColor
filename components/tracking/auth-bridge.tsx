"use client";

import { useEffect } from "react";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { FB_PIXEL_ID, GA_MEASUREMENT_ID } from "@/lib/analytics/config";

/** SHA-256 hex helper. Used to hash the Firebase UID before sending it to
 *  Meta as `external_id`. Per Meta's advanced-matching docs, non-PII unique
 *  IDs may be sent unhashed, but hashing is recommended. We accept the
 *  failure mode of an older browser (no SubtleCrypto) by falling back to
 *  the raw UID — Firebase UIDs are random opaque strings, not PII. */
async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return text;
  try {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return text;
  }
}

/**
 * Bridges Firebase Auth identity into the three tracker SDKs whenever the
 * signed-in user changes. Mounted once in app/layout.tsx INSIDE
 * FirebaseProvider so useFirebase() works.
 *
 * What it does on every auth state change to a non-null user:
 *   - Clarity: clarity("identify", uid, undefined, undefined, friendly)
 *     plus clarity("set", "uid", uid). Clarity hashes server-side.
 *   - GA4: gtag("config", measurement_id, { user_id: uid }) — joins this
 *     session's events to the user_id reporting view.
 *   - Pixel: re-init with { external_id: sha256(uid) } so advanced-match
 *     improves attribution on subsequent events. Pixel dedupes by id.
 *
 * No Firestore write here — that's Phase-1 territory (handled by signup
 * paths in app/login/page.tsx). This component is a pure analytics bridge.
 */
export default function AuthBridge() {
  const { user } = useFirebase();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || typeof window === "undefined") return;

    // Clarity — friendly name is the human-readable label shown in the
    // Clarity dashboard alongside the hashed user-id.
    const friendly =
      user?.displayName ||
      (user?.email ? String(user.email).split("@")[0] : undefined);
    if (typeof window.clarity === "function") {
      try {
        if (friendly) {
          window.clarity("identify", uid, undefined, undefined, friendly);
        } else {
          window.clarity("identify", uid);
        }
        window.clarity("set", "uid", uid);
        if (user?.email) {
          window.clarity("set", "email_domain", String(user.email).split("@")[1] || "(none)");
        }
      } catch (e) {
        // Clarity may not be loaded yet on the first auth state change;
        // the call queues internally so a later flush still works.
        console.warn("Clarity identify queued (not yet loaded):", e);
      }
    }

    // GA4 — joins this user's events to the User-ID reporting view.
    // We only send when GA_MEASUREMENT_ID is configured, otherwise gtag
    // is a no-op stub.
    if (typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
      window.gtag("config", GA_MEASUREMENT_ID, {
        user_id: uid,
      });
      window.gtag("set", "user_properties", {
        signup_provider: user?.providerData?.[0]?.providerId ?? "unknown",
      });
    }

    // Pixel — hash UID, then re-init for advanced matching. The hash promise
    // resolves microtask-soon; we don't await because this entire bridge is
    // non-blocking.
    if (typeof window.fbq === "function") {
      sha256Hex(uid)
        .then((hashed) => {
          if (typeof window.fbq === "function") {
            window.fbq("init", FB_PIXEL_ID, { external_id: hashed });
          }
        })
        .catch(() => {
          /* swallow — analytics must never break the app */
        });
    }
  }, [uid, user?.displayName, user?.email]);

  return null;
}
