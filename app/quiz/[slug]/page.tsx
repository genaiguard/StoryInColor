import type { Metadata } from "next";
import { QUIZ_SLUGS } from "@/lib/quiz/registry";
import LegacyQuizRedirect from "@/components/face-rating/LegacyQuizRedirect";

type Params = { slug: string };

// Per PIVOT-2.md §8 #1: replace the legacy /quiz funnel with /face-rating.
// We retain generateStaticParams so existing /quiz/<slug>/ URLs still
// resolve to a page (rather than 404), but render a redirect that bounces
// the user to /face-rating with their UTM/ref params preserved.

export function generateStaticParams(): Array<Params> {
  return QUIZ_SLUGS.map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Face Rating | StoryInColor",
  robots: { index: false, follow: false },
};

export default function QuizPage(_: { params: Params }) {
  return <LegacyQuizRedirect />;
}
