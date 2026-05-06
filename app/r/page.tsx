import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import SharedFaceReadingView from "./shared-view";

export const metadata: Metadata = {
  title: "Shared face rating — StoryInColor",
  // Public pages — open them up to indexing if user wants the rating to spread.
  robots: { index: false, follow: false },
};

export default function SharedReadingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      }
    >
      <SharedFaceReadingView />
    </Suspense>
  );
}
