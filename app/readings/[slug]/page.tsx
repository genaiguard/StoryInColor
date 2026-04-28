import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/lib/tools/registry";
import { ToolJsonLd } from "@/components/seo/tool-jsonld";
import MarketingView from "./marketing-view";
import ToolWorkflow from "./tool-workflow";

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
      images: [
        { url: tool.coverImage, width: 600, height: 800, alt: tool.name },
      ],
      type: "website",
      url: `https://storyincolor.com/readings/${tool.slug}`,
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
