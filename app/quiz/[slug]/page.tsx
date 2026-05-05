import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QUIZ_REGISTRY, QUIZ_SLUGS } from "@/lib/quiz/registry";
import { getToolBySlug } from "@/lib/tools/registry";
import QuizFlow from "@/components/quiz/QuizFlow";

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  return QUIZ_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const tool = getToolBySlug(params.slug);
  if (!tool) return { title: "StoryInColor" };
  return {
    title: `${tool.name} — Reading | StoryInColor`,
    description: tool.heroCopy,
    robots: {
      // Quiz funnel routes are paid-traffic surfaces, not SEO. Keep them
      // out of the index. Per QUIZ-PIVOT-SPEC.md §11.3.
      index: false,
      follow: false,
    },
  };
}

export default function QuizPage({ params }: { params: Params }) {
  const config = QUIZ_REGISTRY[params.slug];
  if (!config) notFound();
  return <QuizFlow config={config} />;
}
