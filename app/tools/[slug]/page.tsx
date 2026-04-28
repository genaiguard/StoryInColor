import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS, getToolBySlug } from "@/lib/tools/registry";

// Per-slug static redirects from old /tools/<slug> URLs to /readings/<slug>.
// Keeps old backlinks alive and lets Google pass authority to the new path.
export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  const target = `/readings/${slug}`;
  return {
    title: "Moved — StoryInColor",
    description: `Moved to ${target}`,
    alternates: { canonical: `https://storyincolor.com${target}` },
    robots: { index: false, follow: true },
    other: { refresh: `0; url=${target}` },
    openGraph: tool
      ? { title: tool.name, description: tool.tagline, url: `https://storyincolor.com${target}` }
      : undefined,
  };
}

export default async function ToolSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const target = `/readings/${slug}`;
  // Three-way redirect: canonical (for crawlers — already in metadata),
  // inline `<script>` (for JS-enabled humans), and a manual link (for
  // no-JS / older crawlers). Next's metadata.other emits a meta tag with
  // `name="refresh"` which browsers ignore, so we don't rely on that.
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(target)})`,
        }}
      />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-600">Redirecting…</p>
          <p className="mt-3 text-sm">
            <Link
              href={target}
              className="text-orange-600 underline hover:text-orange-700"
            >
              Click here if you're not redirected automatically.
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
