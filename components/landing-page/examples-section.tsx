"use client";

import { ToolGrid } from "@/components/tools/tool-grid";
import { CinematicSection } from "@/components/cinematic/cinematic-section";

/**
 * Landing-page "reading room" section. Mirrors the standalone /readings
 * page in eyebrow + chips + grid; differs only in the heading (h2 here vs
 * h1 there) and the framing copy. The tool list and ordering live in
 * lib/tools/registry.ts → ORDERED_TOOLS — change it there to update both
 * surfaces at once.
 */
export default function ExamplesSection() {
  return (
    <CinematicSection
      id="examples"
      eyebrow="The reading room"
      title={
        <>
          Readings and{" "}
          <span className="italic font-light text-gray-400">keepsakes.</span>
        </>
      }
      description="Most are editorial readings. One is a simple coloring-page keepsake. Bring whatever you have a photo of."
    >
      <ToolGrid showCategoryChips />
    </CinematicSection>
  );
}
