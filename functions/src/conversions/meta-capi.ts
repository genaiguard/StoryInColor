// Meta Conversions API forwarder. Posts a single event to
// https://graph.facebook.com/v21.0/{pixel_id}/events with hashed user_data
// and the dedup event_id matching what the browser Pixel fired.
//
// Reference: https://developers.facebook.com/docs/marketing-api/conversions-api
//
// Failure policy: every call is wrapped in try/catch by the caller, but
// internally we log + return a structured result rather than throwing — the
// stripe webhook and generateForTool must never fail because Meta is down.

import fetch from "node-fetch";
import { hashEmail, hashUid } from "./hash";
import type { ServerEventName, ServerEventPayload, ServerUserData } from "./types";

const GRAPH_API_VERSION = "v21.0";

/** Map our standard event names to Meta's. The first four are Meta
 *  standard names; the last three are reading-lifecycle custom events. */
function metaEventName(name: ServerEventName): string {
  switch (name) {
    case "Purchase":
    case "CompleteRegistration":
    case "InitiateCheckout":
    case "ViewContent":
      return name;
    case "ReadingStarted":
      return "reading_started";
    case "ReadingCompleted":
      return "reading_completed";
    case "ReadingFailed":
      return "reading_failed";
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

interface MetaCapiOptions {
  pixelId: string;
  accessToken: string;
  /** When set, events flow into Meta's "Test events" tab in Events Manager
   *  rather than counting toward production conversions. Use during
   *  rollout. */
  testEventCode?: string;
}

interface MetaCapiResult {
  ok: boolean;
  status: number;
  /** Meta's `events_received` echo on success, or the parsed error body on
   *  failure. */
  body: unknown;
}

/** Send one event to Meta CAPI. */
export async function sendMetaCapiEvent(
  event: ServerEventPayload,
  user: ServerUserData,
  opts: MetaCapiOptions,
): Promise<MetaCapiResult> {
  const eventTime = event.eventTimeSeconds ?? Math.floor(Date.now() / 1000);

  // Meta's user_data schema. Empty string fields are dropped — Meta
  // rejects payloads with empty values.
  const userData: Record<string, unknown> = {};
  if (user.email) userData.em = [hashEmail(user.email)];
  if (user.uid) userData.external_id = [hashUid(user.uid)];
  if (user.ip) userData.client_ip_address = user.ip;
  if (user.userAgent) userData.client_user_agent = user.userAgent;
  if (user.fbp) userData.fbp = user.fbp;
  if (user.fbc) userData.fbc = user.fbc;

  const data: Record<string, unknown> = {
    event_name: metaEventName(event.name),
    event_time: eventTime,
    event_id: event.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (event.eventSourceUrl) {
    data.event_source_url = event.eventSourceUrl;
  }
  if (event.customData && Object.keys(event.customData).length > 0) {
    data.custom_data = event.customData;
  }

  const body: Record<string, unknown> = {
    data: [data],
    access_token: opts.accessToken,
  };
  if (opts.testEventCode) {
    body.test_event_code = opts.testEventCode;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${opts.pixelId}/events`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    parsed = await resp.text();
  }
  return { ok: resp.ok, status: resp.status, body: parsed };
}
