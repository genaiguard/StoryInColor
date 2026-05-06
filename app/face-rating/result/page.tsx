import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import FaceRatingResultView from "./result-view";

export const metadata: Metadata = {
  title: "Your face rating — StoryInColor",
  robots: { index: false, follow: false },
};

export default function FaceRatingResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      }
    >
      <FaceRatingResultView />
    </Suspense>
  );
}
