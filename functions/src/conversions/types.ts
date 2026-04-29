// Shared types for server-side conversion forwarding (Meta CAPI + GA4 MP).
// Used by stripeWebhook (Purchase) and generateForTool (reading_completed +
// reading_failed). Mirrors the cross-tracker plumbing introduced for the
// browser in lib/analytics/events.ts.

/** Standard event names. Same identifiers used in the browser Pixel emits
 *  in lib/analytics/events.ts so the dedup-by-event_id pattern works. */
export type ServerEventName =
  | "Purchase"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "ViewContent"
  // Custom events for the reading lifecycle. These are NOT standard Meta
  // events — they appear as custom events in the CAPI dashboard. We track
  // them to feed the activation funnel (a buyer who never generated a
  // reading is the most-leaky cohort).
  | "ReadingStarted"
  | "ReadingCompleted"
  | "ReadingFailed";

/** Best-effort identity payload used to match the server event back to the
 *  browser session. The more of these we provide the better Meta's match
 *  quality scores. Each field is optional — missing fields just mean lower
 *  match quality, not a failed event. */
export interface ServerUserData {
  /** Lower-cased + trimmed email. Hashed on the way to Meta. */
  email?: string;
  /** Firebase UID — sent to Meta as `external_id` (sha256). Sent to GA4 as
   *  `user_id` (raw). */
  uid?: string;
  /** Client IP. Pulled from req.ip in onRequest handlers; not available
   *  from callable handlers. */
  ip?: string;
  /** User agent string from the original request. */
  userAgent?: string;
  /** Meta browser id cookie value (_fbp). Pulled from users/{uid}.attribution. */
  fbp?: string;
  /** Meta click id cookie value (_fbc). Pulled from users/{uid}.attribution. */
  fbc?: string;
  /** GA4 client_id from the _ga cookie. Pulled from users/{uid}.attribution. */
  gaClientId?: string;
}

/** Per-event payload — mirrors the params we send from the browser so server
 *  and client emits look identical to Meta and GA4. */
export interface ServerEventPayload {
  name: ServerEventName;
  /** Shared dedup id. For Purchase this comes from session.metadata.fbEventId
   *  set in createCreditCheckout. For ReadingCompleted etc. we generate a
   *  fresh UUID. */
  eventId: string;
  /** Optional URL the conversion was associated with. Improves match
   *  quality on Meta when present. */
  eventSourceUrl?: string;
  /** Pixel-style custom params (currency, value, content_ids, ...). */
  customData?: Record<string, unknown>;
  /** UNIX timestamp seconds. Defaults to now() if omitted. */
  eventTimeSeconds?: number;
}
