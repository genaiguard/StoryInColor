import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { QUIZ_REGISTRY, QUIZ_SLUGS } from "@/lib/quiz/registry";
import { pickFallbackHeadline } from "@/lib/quiz/types";
import ResultView from "./result-view";

type Params = { slug: string };

export function generateStaticParams() {
  return QUIZ_SLUGS.map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Your reading is ready — StoryInColor",
  robots: { index: false, follow: false },
};

export default function ResultPage({ params }: { params: Params }) {
  const config = QUIZ_REGISTRY[params.slug];
  if (!config) notFound();
  const fallbackHeadline = pickFallbackHeadline(config.toolId);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      }
    >
      <ResultView slug={params.slug} headlineFallback={fallbackHeadline} />
    </Suspense>
  );
}
