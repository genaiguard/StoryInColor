// GA4 Measurement Protocol forwarder. POSTs to
// https://www.google-analytics.com/mp/collect with measurement_id +
// api_secret as query params. The body is JSON with client_id (from the
// browser _ga cookie) and an events array.
//
// Reference: https://developers.google.com/analytics/devguides/collection/protocol/ga4
//
// Why we need this AT ALL when Phase-2 already wires gtag.js client-side:
//   The browser is a hostile environment — ad-blockers, ITP, browser
//   crashes, mobile-network drops. Server-side MP records the conversion
//   from a Cloud Function we control, then GA4 dedupes on event_id with
//   the client emit (when present). Net effect: GA4 sees the conversion
//   even when the browser fails to deliver it.

import fetch from "node-fetch";
import type { ServerEventName, ServerEventPayload, ServerUserData } from "./types";

/** GA4 standard event-name map. Same mapping used in the browser
 *  events.ts toGtagEventName helper — keep them in sync. */
function ga4EventName(name: ServerEventName): string {
  switch (name) {
    case "Purchase":
      return "purchase";
    case "CompleteRegistration":
      return "sign_up";
    case "InitiateCheckout":
      return "begin_checkout";
    case "ViewContent":
      return "view_item";
    case "ReadingStarted":
      return "reading_started";
    case "ReadingCompleted":
      return "reading_completed";
    case "ReadingFailed":
      return "reading_failed";
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

interface GA4MpOptions {
  measurementId: string;
  apiSecret: string;
  /** When true, hits go to /debug/mp/collect which validates the payload
   *  and returns a verbose result without recording the event. */
  debug?: boolean;
}

interface GA4MpResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function sendGa4MpEvent(
  event: ServerEventPayload,
  user: ServerUserData,
  opts: GA4MpOptions,
): Promise<GA4MpResult> {
  // GA4 requires a client_id. We prefer the actual browser client_id (read
  // from _ga cookie at signup time, persisted on users/{uid}.attribution),
  // and fall back to the UID — the latter still records the event but
  // attributes it to a synthetic client which won't merge with the real
  // browser session. Better than dropping the event entirely.
  const clientId = user.gaClientId ?? user.uid ?? "server";

  const params: Record<string, unknown> = {
    event_id: event.eventId,
    ...(event.customData ?? {}),
    // GA4 session_id / engagement_time_msec are recommended for hits to
    // count toward sessions. We send a fixed 1ms engagement so the event
    // isn't filtered as a non-engaged hit.
    engagement_time_msec: 1,
  };

  const body: Record<string, unknown> = {
    client_id: clientId,
    events: [
      {
        name: ga4EventName(event.name),
        params,
      },
    ],
  };
  if (user.uid) {
    (body as Record<string, unknown>).user_id = user.uid;
  }
  if (event.eventTimeSeconds) {
    (body as Record<string, unknown>).timestamp_micros =
      event.eventTimeSeconds * 1_000_000;
  }

  // Bound the request at 5s — same rationale as in meta-capi.ts. GA4's
  // /mp/collect endpoint typically responds in <100ms; the timeout exists
  // to protect against partial outages.
  const path = opts.debug ? "/debug/mp/collect" : "/mp/collect";
  const url = `https://www.google-analytics.com${path}?measurement_id=${encodeURIComponent(opts.measurementId)}&api_secret=${encodeURIComponent(opts.apiSecret)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal as unknown as AbortSignal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const aborted = e instanceof Error && (e.name === "AbortError" || /aborted/i.test(e.message));
    return {
      ok: false,
      status: aborted ? 408 : 0,
      body: { error: aborted ? "timeout" : (e instanceof Error ? e.message : String(e)) },
    };
  }
  clearTimeout(timeoutId);
  // GA4 production endpoint returns 204 with no body on success; debug
  // endpoint returns JSON with a validationMessages array.
  let parsed: unknown = null;
  try {
    parsed = opts.debug ? await resp.json() : null;
  } catch {
    parsed = null;
  }
  return { ok: resp.ok, status: resp.status, body: parsed };
}
