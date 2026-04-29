"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureTouch } from "@/lib/attribution/capture";

/**
 * Mounted once in app/layout.tsx — listens for client-side route changes and
 * fires the attribution capture utility on each one. captureTouch reads
 * window.location.search and document.referrer directly, so UTMs that arrive
 * on the initial landing are captured even when only the pathname is
 * available in this component.
 *
 * Why not also depend on useSearchParams: in App Router with static export
 * (Next 15), useSearchParams forces a Suspense bailout for the whole layout
 * subtree. UTMs arrive on first load, not on SPA query-only navs — so
 * usePathname alone is sufficient here.
 *
 * No DOM output — pure side-effect component.
 */
export default function AttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    captureTouch(pathname);
  }, [pathname]);

  return null;
}
