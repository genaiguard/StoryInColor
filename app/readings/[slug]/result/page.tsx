import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/lib/tools/registry";
import ResultView from "./result-view";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Result pages are user-private with per-job state; do not index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

function ResultFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  );
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();
  return (
    <Suspense fallback={<ResultFallback />}>
      <ResultView tool={tool} />
    </Suspense>
  );
}
