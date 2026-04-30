import { Suspense } from "react";
import type { Metadata } from "next";
import ShareView from "./share-view";

// /share?id=<shareId>
//
// Public, no-auth-required view for a shared reading. The share doc lives
// at sharedReadings/{shareId} (public-readable, server-write-only) and
// is created by the createShareLink callable. Browser fetches it client-
// side using the Firebase Web SDK.
//
// We can't pre-render per-share OG tags under `output: 'export'` (no
// server runtime). The metadata below is generic — every share URL gets
// the same preview card. That's acceptable for v1; per-share OG can come
// later via a small Cloud Function endpoint.

export const metadata: Metadata = {
  title: "A reading from StoryInColor",
  description:
    "Someone shared their AI photo reading from StoryInColor. Get your own at storyincolor.com.",
  openGraph: {
    title: "A reading from StoryInColor",
    description:
      "Someone shared their AI photo reading from StoryInColor. Get your own at storyincolor.com.",
    url: "https://storyincolor.com/share",
    siteName: "StoryInColor",
    images: [
      {
        url: "https://storyincolor.com/images/og-default.webp",
        width: 1200,
        height: 630,
        alt: "StoryInColor",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "A reading from StoryInColor",
    description:
      "Someone shared their AI photo reading from StoryInColor. Get your own at storyincolor.com.",
  },
  robots: { index: false, follow: false },
};

function ShareFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ShareFallback />}>
      <ShareView />
    </Suspense>
  );
}
