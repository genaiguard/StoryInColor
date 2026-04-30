// Browser-only first-touch / last-touch attribution capture.
//
// Storage strategy:
//   - localStorage holds firstTouch and lastTouch as JSON. Survives page
//     navigations and most reloads.
//   - A first-party cookie ("sic_attr_first") mirrors firstTouch with a long
//     Max-Age. localStorage in Safari ITP expires after 7 days of inactivity;
//     the cookie buys us up to a year of resilience.
//   - On signup, lib/attribution/persist.ts reads both stores, prefers
//     localStorage, falls back to the cookie, and writes the result to
//     Firestore — that's the durable record.
//
// First-touch eligibility (decision #2):
//   Only landings on "/", "/readings", or any "/readings/<slug>" qualify as a
//   first-touch. A user whose first hit is /privacy or /terms is recorded only
//   in lastTouch (so we still see what closed them) but firstTouch waits for a
//   meaningful landing. This avoids attributing real signups to legal-page
//   organic traffic, which is almost always false signal.

import type { AttributionTouch, UserAttribution } from "./types";

const FIRST_KEY = "sic_attr_first";
const LAST_KEY = "sic_attr_last";
const ANON_KEY = "sic_anon_id";
const FIRST_COOKIE = "sic_attr_first";
const ANON_COOKIE = "sic_anon_id";
// 365-day cookie. Browsers may shorten this for cross-site script-set cookies,
// but ours are first-party (set by document.cookie on storyincolor.com), so
// the long Max-Age is honored on Chrome/Firefox/Edge. Safari ITP still caps
// document.cookie writes from script at 7 days — we accept the loss there.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const QUALIFYING_LANDING_DENYLIST = ["/dashboard", "/admin", "/login", "/credits", "/privacy", "/terms", "/contact"];

/** True if the given pathname counts as a "meaningful" first-touch landing.
 *  - Allow "/" exactly.
 *  - Allow "/readings" and "/readings/<slug>".
 *  - Deny everything else (dashboard, admin, login, credits, legal, contact). */
export function isQualifyingFirstTouchLanding(pathname: string): boolean {
  // Exact-match denylist always wins (covers /login etc. before the prefix
  // check below).
  if (QUALIFYING_LANDING_DENYLIST.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (pathname === "/") return true;
  if (pathname === "/readings") return true;
  if (pathname.startsWith("/readings/") && !pathname.startsWith("/readings/_")) return true;
  return false;
}

/** Read a cookie by name. Returns null if not set. SSR-safe. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    if (part.startsWith(target)) {
      try {
        return decodeURIComponent(part.slice(target.length));
      } catch {
        return part.slice(target.length);
      }
    }
  }
  return null;
}

/** Write a first-party cookie scoped to the current origin. SameSite=Lax is
 *  the right default for attribution: blocks third-party CSRF while still
 *  arriving on top-level navigations from external sites. */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Pull a single URL search param. Returns null when missing or empty. */
function getParam(params: URLSearchParams, key: string): string | null {
  const v = params.get(key);
  return v && v.length > 0 ? v : null;
}

/** Best-effort hostname extraction from document.referrer. Returns null when
 *  the referrer is empty (direct nav), same-origin, or unparseable. */
function referrerHostname(): string | null {
  if (typeof document === "undefined") return null;
  const ref = document.referrer;
  if (!ref) return null;
  try {
    const url = new URL(ref);
    if (url.hostname === window.location.hostname) return null;
    return url.hostname;
  } catch {
    return null;
  }
}

/** Infer a (source, medium) pair from referrer when the URL has no UTMs. The
 *  rules are deliberately narrow — better to mark "unknown" honestly than to
 *  guess and pollute downstream funnel reports. */
function inferSourceMedium(referrer: string | null): { source: string | null; medium: string | null } {
  if (!referrer) return { source: "direct", medium: "(none)" };
  const r = referrer.toLowerCase();
  if (r.includes("google.")) return { source: "google", medium: "organic" };
  if (r.includes("bing.com")) return { source: "bing", medium: "organic" };
  if (r.includes("duckduckgo")) return { source: "duckduckgo", medium: "organic" };
  if (r.includes("facebook.") || r.includes("fb.com")) return { source: "facebook", medium: "referral" };
  if (r.includes("instagram.")) return { source: "instagram", medium: "referral" };
  if (r.includes("t.co") || r.includes("twitter.") || r.includes("x.com")) return { source: "twitter", medium: "referral" };
  if (r.includes("tiktok.")) return { source: "tiktok", medium: "referral" };
  if (r.includes("linkedin.")) return { source: "linkedin", medium: "referral" };
  if (r.includes("reddit.")) return { source: "reddit", medium: "referral" };
  if (r.includes("pinterest.")) return { source: "pinterest", medium: "referral" };
  return { source: referrer, medium: "referral" };
}

/** Build a touch snapshot from the current URL + document.referrer. */
function readTouchFromBrowser(pathname: string): AttributionTouch {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const utmSource = getParam(params, "utm_source");
  const utmMedium = getParam(params, "utm_medium");
  const referrer = referrerHostname();
  const inferred = inferSourceMedium(referrer);

  // Click-id-implied source/medium when no UTM is present:
  //   gclid → google/cpc, fbclid → facebook/cpc, msclkid → bing/cpc.
  // These override the referrer-based inference so paid traffic doesn't
  // get mis-tagged as organic when the ad-network referrer is stripped.
  const gclid = getParam(params, "gclid");
  const fbclid = getParam(params, "fbclid");
  const msclkid = getParam(params, "msclkid");
  let clickIdSource: string | null = null;
  let clickIdMedium: string | null = null;
  if (gclid) {
    clickIdSource = "google";
    clickIdMedium = "cpc";
  } else if (fbclid) {
    clickIdSource = "facebook";
    clickIdMedium = "cpc";
  } else if (msclkid) {
    clickIdSource = "bing";
    clickIdMedium = "cpc";
  }

  return {
    source: utmSource ?? clickIdSource ?? inferred.source,
    medium: utmMedium ?? clickIdMedium ?? inferred.medium,
    campaign: getParam(params, "utm_campaign"),
    term: getParam(params, "utm_term"),
    content: getParam(params, "utm_content"),
    referrer,
    landingPath: pathname,
    gclid,
    fbclid,
    msclkid,
    capturedAt: new Date().toISOString(),
  };
}

/** Generate an anon ID once per browser. Uses crypto.randomUUID when
 *  available; falls back to a Math.random-based ID for ancient browsers. */
function ensureAnonId(): string {
  if (typeof window === "undefined") return "";
  const fromLocal = (() => {
    try {
      return window.localStorage.getItem(ANON_KEY);
    } catch {
      return null;
    }
  })();
  if (fromLocal) return fromLocal;
  const fromCookie = readCookie(ANON_COOKIE);
  if (fromCookie) {
    try {
      window.localStorage.setItem(ANON_KEY, fromCookie);
    } catch {
      /* localStorage may be unavailable in private mode */
    }
    return fromCookie;
  }
  let id: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    id = crypto.randomUUID();
  } else {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  try {
    window.localStorage.setItem(ANON_KEY, id);
  } catch {
    /* swallow */
  }
  writeCookie(ANON_COOKIE, id, COOKIE_MAX_AGE_SECONDS);
  return id;
}

function safeReadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage quota / private mode — best effort */
  }
}

/** Capture handler — call from a client component on every route change.
 *  Idempotent: only writes firstTouch on the first qualifying landing.
 *  Always overwrites lastTouch on a qualifying landing. Non-qualifying
 *  pathnames (e.g. /privacy) are no-ops so legal-page first hits don't
 *  poison attribution. */
export function captureTouch(pathname: string): void {
  if (typeof window === "undefined") return;
  ensureAnonId(); // always run so anon id exists by the time signup happens
  if (!isQualifyingFirstTouchLanding(pathname)) return;
  const touch = readTouchFromBrowser(pathname);
  // First-touch: only write if not already present in localStorage OR cookie.
  // Cookie is the more durable source; if it survived a localStorage clear,
  // we honor it.
  const existingFirstLocal = safeReadJson<AttributionTouch>(FIRST_KEY);
  const existingFirstCookie = (() => {
    const raw = readCookie(FIRST_COOKIE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AttributionTouch;
    } catch {
      return null;
    }
  })();
  if (!existingFirstLocal && !existingFirstCookie) {
    safeWriteJson(FIRST_KEY, touch);
    writeCookie(FIRST_COOKIE, JSON.stringify(touch), COOKIE_MAX_AGE_SECONDS);
  } else if (!existingFirstLocal && existingFirstCookie) {
    // localStorage was cleared but cookie survived — restore.
    safeWriteJson(FIRST_KEY, existingFirstCookie);
  }
  // Last-touch: always overwrite on a qualifying landing.
  safeWriteJson(LAST_KEY, touch);
}

/** Read all stored attribution data — used by the signup flow to assemble
 *  the Firestore payload. Returns nullish fields when no data is available
 *  (e.g. a returning visitor who only has a cookie, or one with neither). */
export function readStoredAttribution(): UserAttribution {
  const first = safeReadJson<AttributionTouch>(FIRST_KEY);
  const cookieFirst = (() => {
    const raw = readCookie(FIRST_COOKIE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AttributionTouch;
    } catch {
      return null;
    }
  })();
  const last = safeReadJson<AttributionTouch>(LAST_KEY);
  const anonId = (() => {
    try {
      return window.localStorage.getItem(ANON_KEY);
    } catch {
      return null;
    }
  })() ?? readCookie(ANON_COOKIE);

  // Read the GA4 client_id out of the _ga cookie. Format is "GA1.1.<cid>.<ts>"
  // — we slice the random + timestamp into "<cid>.<ts>" because that's the
  // canonical client_id GA's Measurement Protocol expects.
  const ga = readCookie("_ga");
  const gaClientId = ga ? ga.split(".").slice(2).join(".") || null : null;

  // Meta cookies — _fbp is set by Pixel on first PageView. _fbc is built from
  // an fbclid landing (Pixel handles this). We just persist whatever's there.
  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");

  return {
    firstTouch: first ?? cookieFirst ?? null,
    lastTouch: last ?? null,
    anonId,
    gaClientId,
    fbp,
    fbc,
    clarityCustomId: null, // populated by lib/attribution/persist.ts at write time
  };
}
