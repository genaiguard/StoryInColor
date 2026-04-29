// Browser-side write of profile + attribution to users/{uid}.
//
// Called from the signup completion path in components/tracking/auth-bridge.tsx
// AFTER Firebase Auth has succeeded (so we have a verified UID) but BEFORE
// the redirect to /dashboard.
//
// Why client-side instead of a Cloud Function:
//   - The browser is the only place that has access to localStorage, cookies,
//     URL params, and document.referrer. A Cloud Function would only see
//     headers and the request IP — fine for IP-based geo, useless for UTM.
//   - users/{uid} is owner-writable per firestore.rules:35-38, so this works
//     without a callable round-trip.
//   - We use set({merge:true}) so the legacy `deleted: boolean` flag set by
//     the soft-delete path in dashboard/settings/page.tsx survives.

import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { readStoredAttribution } from "./capture";
import type { UserDocPayload, UserProfile } from "./types";

interface PersistInput {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Firebase Auth providerId — e.g. "password" or "google.com". */
  providerId: string | null;
  /** ISO timestamp from auth.metadata.creationTime. */
  createdAtIso: string;
}

/** Write users/{uid} with a fresh profile + attribution payload. Idempotent
 *  in the sense that calling it again will overwrite profile + attribution
 *  blocks but leave anything else (e.g. `deleted`) alone.
 *
 *  Returns the payload it wrote so callers can echo it into other systems
 *  (e.g. clarity("set", "campaign", ...)) without re-reading localStorage. */
export async function persistUserProfileAndAttribution(input: PersistInput): Promise<UserDocPayload> {
  const profile: UserProfile = {
    email: input.email ?? null,
    displayName: input.displayName ?? null,
    providerId: input.providerId ?? null,
    createdAt: input.createdAtIso,
  };
  const attribution = readStoredAttribution();
  // We tag the Clarity custom-id with the Firebase UID so the hashed value
  // Clarity stores matches what we send via clarity("identify", uid). Mirror
  // it on the Firestore record for convenience.
  attribution.clarityCustomId = input.uid;

  const payload: UserDocPayload = { profile, attribution };

  const db = getFirestore();
  const ref = doc(db, "users", input.uid);
  // serverTimestamp() under a top-level field that Firestore preserves so
  // the admin function can sort by signup time without listing Auth users.
  await setDoc(
    ref,
    {
      ...payload,
      profileLastUpdated: serverTimestamp(),
    },
    { merge: true },
  );

  return payload;
}

/** Write only the attribution block — useful for returning logged-in users
 *  whose lastTouch we want to keep fresh on every session. Skips the profile
 *  block because that's only set on signup (and Auth metadata changes are
 *  rare). */
export async function persistAttributionRefresh(uid: string): Promise<void> {
  const attribution = readStoredAttribution();
  attribution.clarityCustomId = uid;
  const db = getFirestore();
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      attribution,
      attributionLastUpdated: serverTimestamp(),
    },
    { merge: true },
  );
}
