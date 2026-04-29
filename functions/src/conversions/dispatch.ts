// Unified server-side conversion fanout.
//
// Public entry point: `dispatchServerConversion(event, user)`.
// Internally fires Meta CAPI + GA4 Measurement Protocol in parallel, swallows
// per-tracker failures, and returns a result blob suitable for logging.
//
// Behavior:
//   - When STORYINCOLOR_ENABLE_SERVER_CONVERSIONS !== "true", every call is
//     a no-op. This is the master kill switch — ship the code dark, then
//     enable in production after smoke-testing with test_event_code.
//   - Each tracker is independently gated on its own credential set:
//       Meta CAPI fires only when META_CAPI_TOKEN is non-empty.
//       GA4 MP fires only when GA4_MP_API_SECRET is non-empty.
//   - When META_TEST_EVENT_CODE is set, Meta sees events as test events
//     (visible in the Test Events tab, no ad-attribution effect). Same
//     idea on GA4 via GA4_MP_DEBUG=true (uses /debug/mp/collect).
//
// Env vars (read via process.env at call time, not at module load — so
// firebase functions:secrets:set takes effect on the next invocation
// without a redeploy):
//   STORYINCOLOR_ENABLE_SERVER_CONVERSIONS  master switch ("true" / unset)
//   META_CAPI_TOKEN                          required for CAPI to fire
//   META_PIXEL_ID                            required for CAPI to fire
//   META_TEST_EVENT_CODE                     optional — Meta test events
//   GA4_MP_API_SECRET                        required for GA4 MP to fire
//   GA4_MEASUREMENT_ID                       required for GA4 MP to fire
//   GA4_MP_DEBUG                             optional — use /debug endpoint

import { sendMetaCapiEvent } from "./meta-capi";
import { sendGa4MpEvent } from "./ga4-mp";
import type { ServerEventPayload, ServerUserData } from "./types";

interface DispatchResult {
  enabled: boolean;
  meta: { attempted: boolean; ok?: boolean; status?: number; error?: string };
  ga4: { attempted: boolean; ok?: boolean; status?: number; error?: string };
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.toLowerCase() === "true";
}

function envValue(name: string): string {
  return process.env[name] ?? "";
}

/** Fire one event to every configured server-side conversion endpoint.
 *  Always resolves — never throws — so the caller can log the result
 *  without wrapping in another try/catch. */
export async function dispatchServerConversion(
  event: ServerEventPayload,
  user: ServerUserData,
): Promise<DispatchResult> {
  const result: DispatchResult = {
    enabled: false,
    meta: { attempted: false },
    ga4: { attempted: false },
  };

  if (!envFlag("STORYINCOLOR_ENABLE_SERVER_CONVERSIONS")) {
    // Kill switch — explicit no-op. The function still runs, just doesn't
    // talk to any external API.
    return result;
  }
  result.enabled = true;

  const metaToken = envValue("META_CAPI_TOKEN");
  const pixelId = envValue("META_PIXEL_ID");
  const ga4Secret = envValue("GA4_MP_API_SECRET");
  const ga4MeasurementId = envValue("GA4_MEASUREMENT_ID");

  const tasks: Array<Promise<unknown>> = [];

  if (metaToken && pixelId) {
    result.meta.attempted = true;
    const testEventCode = envValue("META_TEST_EVENT_CODE") || undefined;
    tasks.push(
      sendMetaCapiEvent(event, user, {
        pixelId,
        accessToken: metaToken,
        testEventCode,
      })
        .then((r) => {
          result.meta.ok = r.ok;
          result.meta.status = r.status;
          if (!r.ok) {
            result.meta.error = JSON.stringify(r.body).slice(0, 500);
          }
        })
        .catch((e: unknown) => {
          result.meta.error = e instanceof Error ? e.message : String(e);
        }),
    );
  }

  if (ga4Secret && ga4MeasurementId) {
    result.ga4.attempted = true;
    const debug = envFlag("GA4_MP_DEBUG");
    tasks.push(
      sendGa4MpEvent(event, user, {
        apiSecret: ga4Secret,
        measurementId: ga4MeasurementId,
        debug,
      })
        .then((r) => {
          result.ga4.ok = r.ok;
          result.ga4.status = r.status;
          if (!r.ok) {
            result.ga4.error = JSON.stringify(r.body).slice(0, 500);
          }
        })
        .catch((e: unknown) => {
          result.ga4.error = e instanceof Error ? e.message : String(e);
        }),
    );
  }

  // Settle in parallel — whichever finishes first doesn't block the other.
  await Promise.all(tasks);
  return result;
}
