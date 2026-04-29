// Ambient declarations for the third-party tracker globals we use across
// /components/tracking/*. Importing this from the components keeps each one
// from re-declaring the same `interface Window { fbq, gtag, clarity }` block.
//
// Keep these signatures lax — the trackers themselves take any shape of
// payload and we don't gain much from over-specifying it here.

declare global {
  interface Window {
    /** Microsoft Clarity client API. See:
     *  https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api */
    clarity?: ((...args: unknown[]) => unknown) & {
      q?: unknown[];
    };
    /** Meta (Facebook) Pixel queue API. */
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: unknown;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: Window["fbq"];
    /** GA4 gtag.js queue API. dataLayer is the underlying array. */
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// This file intentionally has no exports — it is loaded for its declare global
// side-effect only. Adding `export {}` here makes TypeScript treat the file as
// a module so the global augmentation merges instead of replacing.
export {};
