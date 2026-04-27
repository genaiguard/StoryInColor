import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/lib/tools/registry";
import ResultView from "./result-view";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export default function Page({ params }: { params: { slug: string } }) {
  const tool = getToolBySlug(params.slug);
  if (!tool) notFound();
  return <ResultView tool={tool} />;
}
