"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Redirects legacy /quiz/* visitors to /face-rating, preserving any
 * UTM / ref / fbclid query params so attribution is not lost.
 * Per PIVOT-2.md §8 #1.
 */
export default function LegacyQuizRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    // Drop any legacy-only params if present, keep marketing ones.
    const target = `/face-rating${params.toString() ? `?${params.toString()}` : ""}`;
    window.location.replace(target);
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Loader2 className="h-7 w-7 animate-spin text-white" />
    </div>
  );
}
