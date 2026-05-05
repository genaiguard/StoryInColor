// Funnel event API. Every CLIENT-SIDE funnel event in the app should go
// through one of the helpers below — each one fires to all three trackers
// (Meta Pixel, GA4, Microsoft Clarity) with a shared `event_id`.
//
// What the shared event_id does (and doesn't):
//   - For events that ALSO have a server-side mirror in
//     functions/src/conversions/* (Purchase, CompleteRegistration when
//     wired), Pixel + CAPI dedupe on event_name + event_id within Meta's
//     48h window. Same plumbing applies to GA4 client + Measurement
//     Protocol via the event_id custom param.
//   - For client-only events (ViewContent, Lead, InitiateCheckout —
//     unless paired with a checkout webhook), event_id is just a unique
//     correlation id; nothing dedupes against it server-side.
//   - For server-only events (ReadingStarted / ReadingCompleted /
//     ReadingFailed in functions/src/generate-for-tool.ts), no client
//     emit exists at all — those events use deterministic ids like
//     `srv-readstart-${jobId}` purely for retry idempotency.
//
// Why a single API instead of calling each tracker manually:
//   - Adds the `event_id` plumbing once, in one place.
//   - Makes adding/removing a tracker a one-file change.
//   - Forces consistent event_name + parameters across all trackers, which
//     is required for Meta deduplication to work at all when a server
//     mirror is present.

"use client";

import { GA_MEASUREMENT_ID } from "./config";

/** Generate a UUID for use as event_id. Prefer crypto.randomUUID; fall back
 *  to a Math.random-based id on older browsers. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Standard Meta Pixel event names. We use these literal strings so Meta's
 *  built-in event matching works (custom names get less ML lift). The
 *  Phase-4 server-side CAPI mirror will use the same names. */
export type StandardEventName =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "InitiateCheckout"
  | "CompleteRegistration"
  | "Purchase"
  | "AddToCart";

interface FireOptions {
  /** Pre-generated event id — pass when the caller already issued one (e.g.
   *  from a shared id passed through Stripe metadata). Otherwise omit and a
   *  fresh UUID is generated and returned. */
  eventId?: string;
  /** Pixel-style params (value, currency, content_ids, etc.). */
  params?: Record<string, unknown>;
  /** Whether to mirror this event to Clarity. Defaults to true. Some events
   *  are noisy and we suppress them on Clarity (e.g. PageView, which is
   *  already implicit in session recording). */
  toClarity?: boolean;
  /** Set to true for non-standard event names (e.g. UploadedPhoto, ClickedBuyNow)
   *  — uses fbq("trackCustom", ...) on the Pixel side so Meta records them
   *  as custom events instead of warning about an unknown standard event. */
  custom?: boolean;
}

/** Internal: fan out to all three trackers. Each call is wrapped so a
 *  failure in one tracker doesn't break the others. */
function fire(eventName: string, options: FireOptions = {}): string {
  if (typeof window === "undefined") return options.eventId ?? "";
  const eventId = options.eventId ?? newEventId();
  const params = options.params ?? {};
  const toClarity = options.toClarity ?? true;
  const custom = options.custom ?? false;

  // Meta Pixel — `eventID` (capital ID) is the deduplication key the CAPI
  // mirror must echo. Order: track, then params, then options object.
  // Use trackCustom for non-standard event names so Meta doesn't log a
  // "unknown standard event" warning and records the event correctly.
  if (typeof window.fbq === "function") {
    try {
      window.fbq(
        custom ? "trackCustom" : "track",
        eventName,
        params,
        { eventID: eventId },
      );
    } catch (e) {
      console.warn(`Pixel fire failed (${eventName}):`, e);
    }
  }

  // GA4 — gtag uses snake_case event names. We lowercase + snake-case the
  // event name so e.g. "ViewContent" → "view_content" (GA's convention).
  // Custom params (event_id, value, currency, etc.) ride along on the same
  // payload.
  if (typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
    try {
      window.gtag("event", toGtagEventName(eventName), {
        event_id: eventId,
        ...mapParamsForGa(params),
        send_to: GA_MEASUREMENT_ID,
      });
    } catch (e) {
      console.warn(`GA4 fire failed (${eventName}):`, e);
    }
  }

  // Clarity — opaque event name + a custom-tag bag for filtering.
  if (toClarity && typeof window.clarity === "function") {
    try {
      window.clarity("event", eventName);
      // Mirror the most useful params as filterable tags. `value` becomes
      // a numeric tag if present; `content_name` becomes a string tag.
      if (typeof params.value === "number") {
        window.clarity("set", `${eventName}_value`, String(params.value));
      }
      if (typeof params.content_name === "string") {
        window.clarity("set", `${eventName}_content`, params.content_name);
      }
    } catch (e) {
      console.warn(`Clarity fire failed (${eventName}):`, e);
    }
  }

  return eventId;
}

/** Turn a Pixel-style PascalCase event name into the GA4 snake_case
 *  convention. The mapping favors GA's standard event names where one
 *  exists, falling back to a snake_case transformation. */
function toGtagEventName(name: string): string {
  switch (name) {
    case "Purchase":
      return "purchase"; // GA4 standard
    case "InitiateCheckout":
      return "begin_checkout"; // GA4 standard
    case "ViewContent":
      return "view_item"; // GA4 standard
    case "AddToCart":
      return "add_to_cart"; // GA4 standard
    case "CompleteRegistration":
      return "sign_up"; // GA4 standard
    case "Lead":
      return "generate_lead"; // GA4 standard
    case "PageView":
      return "page_view";
    default:
      return name
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .replace(/^_/, "");
  }
}

/** Translate Pixel-flavoured param names to GA4 conventions. We DO NOT drop
 *  the original keys — GA4 accepts arbitrary custom params, so passing both
 *  costs nothing and keeps the cross-tracker payload identical. */
function mapParamsForGa(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...params };
  // Pixel uses `value` + `currency` already which match GA4. Just normalise
  // a couple of edge cases.
  if (params.content_ids && !out.items) {
    out.items = (params.content_ids as unknown[]).map((id) => ({ item_id: id }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public funnel helpers — one per Tier-1/Tier-2 event in the analysis.
// ---------------------------------------------------------------------------

/** Tier-2: visitor saw a reading detail page. Fires on every mount of
 *  /readings/[slug] (including SPA navs). Returns event_id for caller use. */
export function trackViewReading(opts: {
  toolId: string;
  toolName: string;
  eventId?: string;
}): string {
  return fire("ViewContent", {
    eventId: opts.eventId,
    params: {
      content_type: "reading",
      content_ids: [opts.toolId],
      content_name: opts.toolName,
      content_category: "reading_detail",
    },
  });
}

/** Tier-2: visitor saw a finished reading on the result page. Fires once
 *  per /readings/<slug>/result mount when the job is complete. */
export function trackViewReadingResult(opts: {
  toolId: string;
  toolName: string;
  jobId: string;
}): string {
  return fire("ViewContent", {
    params: {
      content_type: "reading_result",
      content_ids: [opts.toolId],
      content_name: opts.toolName,
      content_category: "reading_result",
      job_id: opts.jobId,
    },
  });
}

/** Tier-2: pricing CTA clicked on the landing page. Pre-auth — represents
 *  intent, not a real checkout open. Mapped to `Lead` because the user has
 *  not yet started a payment flow. Replaces the misnamed InitiateCheckout
 *  that fired here previously. */
export function trackPricingCtaClick(opts: {
  contentName: string;
}): string {
  return fire("Lead", {
    params: {
      content_name: opts.contentName,
      content_category: "pricing",
    },
  });
}

/** Tier-1: user completed signup. Returns event_id; the caller may pass it
 *  to the welcome-email Cloud Function so that function (or the Phase-4
 *  CAPI mirror) can dedupe with this client emit. */
export function trackCompleteRegistration(opts: {
  method: "email" | "google";
  eventId?: string;
}): string {
  return fire("CompleteRegistration", {
    eventId: opts.eventId,
    params: {
      content_name: "User Registration",
      method: opts.method,
    },
  });
}

/** Tier-1: user dispatched the Stripe redirect. Fires AFTER
 *  redirectToCheckout resolves (or rejects, but only on the success path).
 *  The returned event_id is what the caller must thread through Stripe
 *  metadata so the Phase-4 webhook can echo it back via CAPI. */
export function trackInitiateCheckout(opts: {
  packageId: string;
  valueCents: number;
  numItems: number;
  eventId?: string;
}): string {
  return fire("InitiateCheckout", {
    eventId: opts.eventId,
    params: {
      content_ids: [opts.packageId],
      content_name: `Credit pack: ${opts.packageId}`,
      content_category: "credits",
      currency: "USD",
      value: opts.valueCents / 100,
      num_items: opts.numItems,
    },
  });
}

// ---------------------------------------------------------------------------
// Funnel-gap instrumentation (custom events). These don't have a Meta
// standard mapping; they exist so Clarity (and Pixel custom-events) can
// answer "where in the funnel does the 49-of-50 dropoff actually happen?"
// ---------------------------------------------------------------------------

/** Custom: signed-in user dropped a photo onto the workflow dropzone. Fires
 *  once per accepted file. Tells us "did they get past upload?" — the step
 *  we currently can't see in Clarity between SignUp and InitiateCheckout. */
export function trackUploadedPhoto(opts: {
  toolId: string;
  toolName: string;
}): string {
  return fire("UploadedPhoto", {
    custom: true,
    params: {
      content_type: "reading",
      content_ids: [opts.toolId],
      content_name: opts.toolName,
    },
  });
}

/** Custom: signed-in user with insufficient credits clicked the
 *  "Read my photo" / "Purchase readings" CTA on the tool workflow and is
 *  being routed to /credits. Fires immediately before the router push. */
export function trackClickedPurchaseFromTool(opts: {
  toolId: string;
  toolName: string;
}): string {
  return fire("ClickedPurchaseFromTool", {
    custom: true,
    params: {
      content_type: "reading",
      content_ids: [opts.toolId],
      content_name: opts.toolName,
    },
  });
}

/** Custom: user clicked "Buy now" on a /credits SKU tile. Fires before the
 *  Stripe session is created. The earlier Lead/InitiateCheckout helpers
 *  fire on landing-page pricing-CTA clicks and on the post-Stripe-session
 *  redirect respectively — this one fills the gap in between. */
export function trackClickedBuyNow(opts: {
  packageId: string;
  valueCents: number;
}): string {
  return fire("ClickedBuyNow", {
    custom: true,
    params: {
      content_ids: [opts.packageId],
      content_name: `Credit pack: ${opts.packageId}`,
      currency: "USD",
      value: opts.valueCents / 100,
    },
  });
}

/** Tier-1: client-side Purchase emit. Fires from the dashboard polling
 *  flow when a today's-purchase is detected post-Stripe-redirect.
 *  IMPORTANT: pass the SAME event_id the InitiateCheckout step used (read
 *  from Stripe metadata via the webhook's response, or threaded through
 *  Firestore). The Phase-4 CAPI mirror will use the same id from
 *  metadata.fbEventId so Meta dedupes. */
export function trackPurchase(opts: {
  packageId: string;
  valueCents: number;
  numItems: number;
  eventId?: string;
}): string {
  return fire("Purchase", {
    eventId: opts.eventId,
    params: {
      content_ids: [opts.packageId],
      content_name: "Credit Purchase",
      content_category: "credits",
      currency: "USD",
      value: opts.valueCents / 100,
      num_items: opts.numItems,
    },
  });
}

// ---------------------------------------------------------------------------
// Quiz-funnel events (per QUIZ-PIVOT-SPEC.md §9.1).
// All custom events; the only one that doubles as a standard event is
// QuizPurchase, which dispatches as Purchase to keep Meta's standard event
// taxonomy intact (server CAPI mirror in functions/src/quiz-webhook-handler.ts
// fires Purchase with the same event_id).
// ---------------------------------------------------------------------------

/** Quiz funnel: user landed on /quiz/<slug> screen 1. */
export function trackQuizStarted(opts: {
  slug: string;
  eventId?: string;
  utm?: Record<string, string | undefined>;
}): string {
  return fire("QuizStarted", {
    custom: true,
    eventId: opts.eventId,
    params: {
      content_type: "reading",
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      ...opts.utm,
    },
  });
}

/** Quiz funnel: each option select. */
export function trackQuizQuestionAnswered(opts: {
  slug: string;
  questionId: string;
  optionId: string;
  screenIndex: number;
}): string {
  return fire("QuizQuestionAnswered", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      question_id: opts.questionId,
      option_id: opts.optionId,
      screen_index: opts.screenIndex,
    },
  });
}

/** Quiz funnel: user submitted upload. */
export function trackQuizPhotoUploaded(opts: {
  slug: string;
  pendingReadingToken: string;
  fileSize: number;
}): string {
  return fire("QuizPhotoUploaded", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      pending_reading_token: opts.pendingReadingToken,
      file_size_bytes: opts.fileSize,
    },
  });
}

/** Quiz funnel: blurred reveal screen rendered. */
export function trackQuizRevealShown(opts: {
  slug: string;
  pendingReadingToken: string;
}): string {
  return fire("QuizRevealShown", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      pending_reading_token: opts.pendingReadingToken,
    },
  });
}

/** Quiz funnel: email submitted at the reveal screen. */
export function trackQuizEmailCaptured(opts: {
  slug: string;
  pendingReadingToken: string;
}): string {
  return fire("QuizEmailCaptured", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      pending_reading_token: opts.pendingReadingToken,
    },
  });
}

/** Quiz funnel: paywall screen rendered. */
export function trackQuizPaywallShown(opts: {
  slug: string;
  pendingReadingToken: string;
}): string {
  return fire("QuizPaywallShown", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      pending_reading_token: opts.pendingReadingToken,
    },
  });
}

/** Quiz funnel: user picked a tier on the paywall. */
export function trackQuizPaywallTierSelected(opts: {
  slug: string;
  pendingReadingToken: string;
  tierId: "single" | "monthly" | "annual" | "trial_dollar";
}): string {
  return fire("QuizPaywallTierSelected", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      pending_reading_token: opts.pendingReadingToken,
      tier_id: opts.tierId,
    },
  });
}

/** Quiz funnel: exit-intent (currently unused in v2.1 — kept for re-enable). */
export function trackQuizExitIntent(opts: {
  slug: string;
  pendingReadingToken: string;
}): string {
  return fire("QuizExitIntent", {
    custom: true,
    params: {
      content_ids: [opts.slug],
      content_category: "quiz_funnel",
      pending_reading_token: opts.pendingReadingToken,
    },
  });
}

/** Quiz funnel: client-side InitiateCheckout when Stripe session opens. */
export function trackQuizInitiateCheckout(opts: {
  slug: string;
  pendingReadingToken: string;
  tierId: string;
  valueCents: number;
  eventId?: string;
}): string {
  return fire("InitiateCheckout", {
    eventId: opts.eventId,
    params: {
      content_ids: [`quiz_${opts.tierId}`],
      content_name: `Quiz tier: ${opts.tierId}`,
      content_category: "quiz_funnel",
      currency: "USD",
      value: opts.valueCents / 100,
      pending_reading_token: opts.pendingReadingToken,
    },
  });
}

/** Quiz funnel: post-payment Purchase emit (dedupes with server CAPI mirror). */
export function trackQuizPurchase(opts: {
  slug: string;
  pendingReadingToken: string;
  tierId: string;
  valueCents: number;
  eventId?: string;
}): string {
  return fire("Purchase", {
    eventId: opts.eventId,
    params: {
      content_ids: [`quiz_${opts.tierId}`],
      content_name: "Quiz Funnel Purchase",
      content_category: opts.tierId,
      currency: "USD",
      value: opts.valueCents / 100,
      num_items: 1,
      pending_reading_token: opts.pendingReadingToken,
    },
  });
}
