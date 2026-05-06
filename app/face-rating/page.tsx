import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import FaceRatingFlow from "@/components/face-rating/FaceRatingFlow";

export const metadata: Metadata = {
  title: "Get Your Honest Face Rating — StoryInColor",
  description:
    "Calibrated face analysis with PSL tier, sub-scores, percentile, archetype, strengths, growth areas, and a glow-up plan. Honest. One-time purchase.",
  robots: {
    // Paid traffic surface, not SEO. Per PIVOT-2.md §1.2.
    index: false,
    follow: false,
  },
};

export default function FaceRatingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      }
    >
      <FaceRatingFlow />
    </Suspense>
  );
}
