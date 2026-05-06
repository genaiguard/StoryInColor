import type { Metadata } from "next";
import { QUIZ_SLUGS } from "@/lib/quiz/registry";
import LegacyQuizRedirect from "@/components/face-rating/LegacyQuizRedirect";

type Params = { slug: string };

export function generateStaticParams() {
  return QUIZ_SLUGS.map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Face Rating | StoryInColor",
  robots: { index: false, follow: false },
};

export default function LegacyResultPage(_: { params: Params }) {
  return <LegacyQuizRedirect />;
}
