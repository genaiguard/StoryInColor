import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import HairAnalysisResultView from "./result-view";

export const metadata: Metadata = {
  title: "Your Hairstyle Report — StoryInColor",
  robots: { index: false, follow: false },
};

export default function HairAnalysisResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      }
    >
      <HairAnalysisResultView />
    </Suspense>
  );
}
