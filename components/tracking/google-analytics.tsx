"use client";

import Script from "next/script";
import { GA_MEASUREMENT_ID, ANALYTICS_ENABLED } from "@/lib/analytics/config";

/**
 * Loads gtag.js with `send_page_view: false`. Pageviews are emitted by
 * components/tracking/route-tracker.tsx so SPA navigations between Next.js
 * routes are counted — gtag.js's automatic pageview only fires once per
 * hard load, which would undercount our static-export navigations.
 *
 * Renders nothing when GA4 is disabled (no measurement id) or analytics are
 * masterswitch-off (development without the opt-in flag). The gtag stub +
 * dataLayer are still set up though, so calls anywhere in the app are no-op
 * safe.
 */
export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID || !ANALYTICS_ENABLED) {
    return null;
  }
  return (
    <>
      {/* The async loader. afterInteractive lets the gtag stub handle
          earlier calls (we set the stub up below) until the real script
          replaces it. */}
      <Script
        id="ga4-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = function gtag(){window.dataLayer.push(arguments);};
          window.gtag('js', new Date());
          // send_page_view: false — RouteTracker handles every pageview so
          // SPA navigations get counted. Without this, gtag.js fires its
          // own automatic pageview on first config and we'd double-count.
          window.gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
