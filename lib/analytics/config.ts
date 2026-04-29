// Central analytics config — IDs and feature flags used by every
// /components/tracking/* component. Importing from here (rather than
// duplicating string literals in each file) means one place to flip pixel /
// GA / Clarity on-or-off when we onboard a new property or rotate an ID.
//
// The legacy lib/facebook-pixel-config.ts is kept untouched so existing
// importers (FacebookPixel, login/page.tsx) don't break — both files agree
// on the same Pixel ID.

/** Microsoft Clarity project id (the value in window.clarity bootstrap). */
export const CLARITY_PROJECT_ID = "qxtkvqson7";

/** Meta (Facebook) Pixel id. Same value as FACEBOOK_PIXEL_CONFIG.PIXEL_ID. */
export const FB_PIXEL_ID = "660006810196406";

/** GA4 measurement id, e.g. "G-XXXXXXXXXX". Wired via the Firebase
 *  measurementId env var since that's already plumbed through GitHub Actions.
 *  An empty value means GA4 is disabled and the loader script must not
 *  execute (gtag.tsx checks for this). */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "";

/** Master switch. Mirrors the legacy FB pixel logic — production always on,
 *  dev only on when explicitly opted in. We respect the same flag for GA4
 *  and Clarity so a single env knob controls all client-side tracking when
 *  testing locally. Clarity is currently loaded unconditionally in
 *  layout.tsx; this flag does not retroactively turn it off there. */
export const ANALYTICS_ENABLED =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_ENABLE_FB_PIXEL === "true";
