import type { Metadata } from "next";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";
import { ToolGrid } from "@/components/tools/tool-grid";
import { TOOLS } from "@/lib/tools/registry";

const SHORT_DESCRIPTION =
  "Editorial AI photo readings — palm reading, face reading, style audit, plant care, plate analysis, and more. Each one designed to be saved.";

export const metadata: Metadata = {
  title: "The reading room | StoryInColor",
  description:
    "Every reading on StoryInColor, in one place — palm reading, face reading, aura, iridology, handwriting, style audit, plate analysis, plant care, room vibes, skincare, coloring book. Bring whatever you have a photo of.",
  alternates: { canonical: "https://storyincolor.com/tools" },
  openGraph: {
    title: "The reading room | StoryInColor",
    description: SHORT_DESCRIPTION,
    type: "website",
    url: "https://storyincolor.com/tools",
  },
  twitter: {
    card: "summary_large_image",
    title: "The reading room | StoryInColor",
    description: SHORT_DESCRIPTION,
  },
};

function CatalogJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "StoryInColor — the reading room",
    description:
      "Editorial AI photo readings, written like an editor, not an algorithm.",
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
              The reading room.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Every reading we publish, in one place. Bring whatever you have a
              photo of — your palm, your handwriting, your plate, your plant,
              your room — and we'll write you back.
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
