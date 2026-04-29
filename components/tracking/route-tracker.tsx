"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/config";

/**
 * Fires pageview events on every Next.js route change so all three trackers
 * (Meta Pixel, GA4, Microsoft Clarity) stay in sync with SPA navigation.
 *
 * Why: the Pixel snippet in components/tracking/facebook-pixel.tsx fires
 * `PageView` exactly once on first paint, gtag.js was configured with
 * `send_page_view: false`, and Clarity ties session events to the URL it
 * sees on script load. Without this component, navigating from "/" to
 * "/readings/face-reading" client-side would not produce a fresh pageview
 * in any tracker — they'd all think the user only ever viewed "/".
 *
 * We skip the very first route change after mount because:
 *   - Pixel already auto-fired PageView in its init script.
 *   - GA4 + Clarity do not auto-fire (Pixel does), so we still tell those
 *     two about the initial page on the first effect run.
 * The `firstRunRef` flag distinguishes initial mount from subsequent navs.
 */
export default function RouteTracker() {
  const pathname = usePathname();
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    // Build the absolute URL once; gtag wants a `page_location` and Pixel
    // benefits from a `referrer` it can include in match-quality scoring.
    const pageLocation = window.location.href;
    const pageTitle =
      typeof document !== "undefined" ? document.title : undefined;

    // GA4: tell gtag to record a pageview against the new path. We always
    // send this (including on first run) because gtag was init'd with
    // send_page_view: false and otherwise wouldn't see the landing page.
    if (typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
      window.gtag("event", "page_view", {
        page_location: pageLocation,
        page_path: pathname,
        page_title: pageTitle,
        send_to: GA_MEASUREMENT_ID,
      });
    }

    // Clarity: per Microsoft docs, identify should be called on every page
    // for optimal tracking. We can't pass the Firebase UID here (auth-bridge
    // does that once we know who's signed in), but we CAN tag the page id so
    // session recordings are scoped to a route. The page-id is the pathname.
    // We don't pass a custom-user-id here — auth-bridge handles that with
    // the real UID, which Clarity's identify deduplicates across calls.
    //
    // We DO call clarity("set", "page", pathname) which gives the Clarity
    // dashboard a filterable tag for the current route — useful for "show
    // me sessions that visited /readings/face-reading".
    if (typeof window.clarity === "function") {
      try {
        window.clarity("set", "page", pathname);
      } catch {
        /* clarity may not be ready yet on the very first run */
      }
    }

    // Meta Pixel: skip the first run because the init script already fires
    // PageView. Subsequent route changes need a manual track.
    if (!firstRunRef.current && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }

    firstRunRef.current = false;
  }, [pathname]);

  return null;
}
