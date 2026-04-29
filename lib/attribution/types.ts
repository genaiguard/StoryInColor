// Shared attribution + profile types. Used by:
//   - lib/attribution/capture.ts            (browser-only first/last-touch capture)
//   - lib/attribution/persist.ts            (browser-side write to Firestore on signup)
//   - functions/src/index.ts                (admin dashboard merge — duplicated by hand,
//                                            see CLAUDE.md "two npm trees" note)
//
// Keep these definitions stable. Adding optional fields is safe; renaming or
// removing is not — the admin function reads docs written by older builds.

/** Single touchpoint snapshot — captured the first time a visitor lands AND
 *  on every subsequent qualifying landing (last-touch is overwritten). */
export interface AttributionTouch {
  /** UTM source (utm_source). Falls back to inferred source from referrer. */
  source: string | null;
  /** UTM medium (utm_medium). Falls back to inferred medium ("organic", "referral", "direct"). */
  medium: string | null;
  /** UTM campaign (utm_campaign). */
  campaign: string | null;
  /** UTM term (utm_term) — paid keyword. */
  term: string | null;
  /** UTM content (utm_content) — ad variant. */
  content: string | null;
  /** Referrer hostname only (e.g. "google.com"). Full referrer is browser-private and we don't need it. */
  referrer: string | null;
  /** Pathname the user landed on (e.g. "/", "/readings/face-reading"). Excludes querystring. */
  landingPath: string;
  /** Google click identifier from URL params (gclid). */
  gclid: string | null;
  /** Meta click identifier (fbclid). Used to construct Meta's `fbc` cookie. */
  fbclid: string | null;
  /** Microsoft Bing/Ads click identifier (msclkid). */
  msclkid: string | null;
  /** ISO timestamp at capture. */
  capturedAt: string;
}

/** Persisted under users/{uid}.attribution. Shape is deliberately flat so
 *  Firestore queries (where("attribution.firstTouch.source", "==", ...)) work
 *  without compound indexes. */
export interface UserAttribution {
  /** Earliest qualifying touch — never overwritten once set. */
  firstTouch: AttributionTouch | null;
  /** Most recent qualifying touch — overwritten on every meaningful landing. */
  lastTouch: AttributionTouch | null;
  /** Pre-auth UUID we issued in localStorage for funnel deduplication. */
  anonId: string | null;
  /** GA4 client_id (browser-anonymous, read from the _ga cookie). Lets us
   *  cross-reference users with GA4 reports externally. */
  gaClientId: string | null;
  /** Meta browser-id cookie value (_fbp). Improves CAPI match quality. */
  fbp: string | null;
  /** Meta click-id cookie value (_fbc). Built from fbclid on first landing. */
  fbc: string | null;
  /** Microsoft Clarity hashes our custom-id client-side; we send the Firebase
   *  UID so the hash equals what Clarity stores, but we don't get the hash
   *  back. We mirror the UID here for future-proofing if Clarity ever adds a
   *  reverse lookup. */
  clarityCustomId: string | null;
}

/** Persisted under users/{uid}.profile. Flat block alongside attribution. */
export interface UserProfile {
  email: string | null;
  displayName: string | null;
  /** Auth provider that completed the signup ("password", "google.com"). */
  providerId: string | null;
  /** ISO timestamp — duplicated from auth.metadata.creationTime so we don't
   *  need to listUsers() on every admin load. */
  createdAt: string;
}

/** Top-level shape we write into users/{uid} on signup completion. We use
 *  `set({merge:true})` so legacy fields like `deleted: boolean` (the soft-delete
 *  flag) are preserved. */
export interface UserDocPayload {
  profile: UserProfile;
  attribution: UserAttribution;
}
