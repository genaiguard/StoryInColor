import type { Metadata } from "next";
import Link from "next/link";

// /tools moved to /readings. Static-export-safe redirect: meta-refresh in
// the served HTML so crawlers, no-JS visitors, and link previewers all
// honor it; canonical points at the new home so /tools drops out of the
// index naturally.
export const metadata: Metadata = {
  title: "Moved — StoryInColor",
  description: "The /tools page has moved to /readings.",
  alternates: { canonical: "https://storyincolor.com/readings" },
  robots: { index: false, follow: true },
  other: { refresh: "0; url=/readings" },
};

export default function ToolsRedirect() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace("/readings")`,
        }}
      />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-600">Redirecting…</p>
          <p className="mt-3 text-sm">
            <Link href="/readings" className="text-orange-600 underline hover:text-orange-700">
              Click here if you're not redirected automatically.
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
