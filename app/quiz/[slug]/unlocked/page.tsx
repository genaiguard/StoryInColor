import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { QUIZ_REGISTRY, QUIZ_SLUGS } from "@/lib/quiz/registry";
import UnlockedView from "./unlocked-view";

type Params = { slug: string };

export function generateStaticParams() {
  return QUIZ_SLUGS.map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Your reading — StoryInColor",
  robots: { index: false, follow: false },
};

export default function UnlockedPage({ params }: { params: Params }) {
  if (!QUIZ_REGISTRY[params.slug]) notFound();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      }
    >
      <UnlockedView slug={params.slug} />
    </Suspense>
  );
}
