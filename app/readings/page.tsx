import type { Metadata } from "next";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";
import { ToolGrid } from "@/components/tools/tool-grid";
import { TOOLS } from "@/lib/tools/registry";
import { CinematicSection } from "@/components/cinematic/cinematic-section";

const SHORT_DESCRIPTION =
  "Editorial AI photo readings — palm reading, face reading, beauty report, color analysis, hairstyle analysis, style audit, and more. Each one designed to be saved.";

export const metadata: Metadata = {
  title: "The reading room | StoryInColor",
  description:
    "Every photo experience on StoryInColor, in one place — palm reading, face reading, beauty report, color analysis, hairstyle analysis, aura, iridology, handwriting, style audit, skincare, and coloring pages. Bring whatever you have a photo of.",
  alternates: { canonical: "https://storyincolor.com/readings" },
  openGraph: {
    title: "The reading room | StoryInColor",
    description: SHORT_DESCRIPTION,
    type: "website",
    url: "https://storyincolor.com/readings",
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
      url: `https://storyincolor.com/readings/${tool.slug}`,
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
    <div className="flex min-h-screen flex-col bg-black">
      <CatalogJsonLd />
      <Header />
      <main className="flex-1 pt-24 md:pt-28">
        <CinematicSection
          eyebrow="The reading room"
          headingLevel="h1"
          title={
            <>
              Every reading,{" "}
              <span className="italic font-light text-gray-400">
                in one place.
              </span>
            </>
          }
          description="Bring whatever you have a photo of — your palm, your face, your handwriting, your style, your skin — and we'll write you back."
        >
          <ToolGrid showCategoryChips showFreeBannerForSignedIn />
        </CinematicSection>
      </main>
      <Footer />
    </div>
  );
}
