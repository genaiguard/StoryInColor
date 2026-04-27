import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/lib/tools/registry";
import ResultView from "./result-view";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

function ResultFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
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
