import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TOOLS, getToolBySlug } from "@/lib/tools/registry";
import { ToolJsonLd } from "@/components/seo/tool-jsonld";
import MarketingView from "./marketing-view";
import ToolWorkflow from "./tool-workflow";
import FaceRatingFlow from "@/components/face-rating/FaceRatingFlow";

/**
 * Slug → "use the new face-rating funnel instead of the legacy marketing
 * + credit-pack workflow." Per founder direction (May 2026): beauty-report
 * is the first reading converted to the new architecture; its SEO URL
 * stays at /readings/beauty-report but the visitor sees the
 * /face-rating funnel instead. Other slugs continue to render the
 * existing marketing + credit-pack flow until they're each migrated.
 */
const FACE_RATING_SLUGS = new Set<string>(["beauty-report"]);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Reading not found" };
  return {
    title: tool.seo.metaTitle,
    description: tool.seo.metaDescription,
    openGraph: {
      title: tool.seo.metaTitle,
      description: tool.seo.metaDescription,
      // Cover images are 1024×1536 portrait. Twitter/Facebook will scale
      // them as a "summary_large_image" card; the dimensions are declared
      // truthfully so the meta validator doesn't warn.
      images: [
        { url: tool.coverImage, width: 1024, height: 1536, alt: tool.name },
      ],
      type: "website",
      url: `https://storyincolor.com/readings/${tool.slug}`,
      siteName: "StoryInColor",
    },
    twitter: {
      card: "summary_large_image",
      title: tool.seo.metaTitle,
      description: tool.seo.metaDescription,
      images: [tool.coverImage],
    },
    alternates: { canonical: `https://storyincolor.com/readings/${tool.slug}` },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  // Per founder direction: beauty-report is migrated to the new
  // face-rating funnel architecture. The /readings/beauty-report URL
  // is preserved for SEO continuity but the user sees the same
  // unauth $4.99 funnel as /face-rating. JSON-LD still ships so
  // search engines see the legacy marketing structured data.
  if (FACE_RATING_SLUGS.has(slug)) {
    return (
      <>
        <ToolJsonLd tool={tool} />
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-black">
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            </div>
          }
        >
          <FaceRatingFlow />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <ToolJsonLd tool={tool} />
      {/*
        Both surfaces are shipped to the static HTML for SEO. CSS in
        app/globals.css hides the marketing view once the client workflow
        sets data-tool-auth="signed-in", and hides the workflow shell while
        the visitor is signed-out.
      */}
      <MarketingView tool={tool} />
      <ToolWorkflow tool={tool} />
    </>
  );
}
