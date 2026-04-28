import type { Metadata } from "next";
import Link from "next/link";

// Server component (no "use client") so the meta-refresh redirect lands in the
// static HTML — crawlers, no-JS users, and link previewers all see it. The
// canonical points at the new home so /create doesn't compete in the index.
export const metadata: Metadata = {
  title: "Coloring Book — StoryInColor",
  description:
    "The /create page has moved. Use /tools/coloring-book to turn any photo into a print-ready coloring page.",
  alternates: { canonical: "https://storyincolor.com/tools/coloring-book" },
  robots: { index: false, follow: true },
  other: {
    refresh: "0; url=/tools/coloring-book",
  },
};

export default function CreateRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="text-sm text-gray-600">
          Redirecting to the coloring book tool…
        </p>
        <p className="mt-3 text-sm">
          <Link
            href="/tools/coloring-book"
            className="text-orange-600 underline hover:text-orange-700"
          >
            Click here if you're not redirected automatically.
          </Link>
        </p>
      </div>
    </div>
  );
}
