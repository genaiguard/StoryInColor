import type { Metadata } from "next";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";
import { ToolGrid } from "@/components/tools/tool-grid";
import { TOOLS } from "@/lib/tools/registry";
import { TOOL_COUNT_WORD } from "@/lib/tools/copy";

const SHORT_DESCRIPTION = `${TOOL_COUNT_WORD} AI photo tools. One upload. A magazine-quality result in seconds.`;

export const metadata: Metadata = {
  title: "All AI Photo Tools | StoryInColor",
  description: `${TOOL_COUNT_WORD} AI photo tools in one place. Upload one photo and get a magazine-quality result — coloring book, palmistry, style audits, plant care, and more.`,
  alternates: { canonical: "https://storyincolor.com/tools" },
  openGraph: {
    title: "All AI Photo Tools | StoryInColor",
    description: SHORT_DESCRIPTION,
    type: "website",
    url: "https://storyincolor.com/tools",
  },
  twitter: {
    card: "summary_large_image",
    title: "All AI Photo Tools | StoryInColor",
    description: SHORT_DESCRIPTION,
  },
};

function CatalogJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "StoryInColor AI photo tools",
    description: `${TOOL_COUNT_WORD} AI photo tools that turn one upload into a finished, share-ready result.`,
    numberOfItems: TOOLS.length,
    itemListElement: TOOLS.map((tool, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://storyincolor.com/tools/${tool.slug}`,
      name: tool.name,
      description: tool.tagline,
      image: `https://storyincolor.com${tool.coverImage}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

export default function ToolsCatalogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CatalogJsonLd />
      <Header />
      <main className="flex-1">
        <section className="container mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
              {TOOL_COUNT_WORD} AI photo tools. One upload. Pick yours.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              From a print-ready coloring page to a magazine-quality palm reading,
              every tool starts with a single photo and finishes in roughly 20 to
              40 seconds.
            </p>
          </div>

          <div className="mt-10">
            <ToolGrid showCategoryChips />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
