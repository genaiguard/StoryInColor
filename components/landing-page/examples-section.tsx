"use client";
import { ToolGrid } from "@/components/tools/tool-grid";
import { TOOLS } from "@/lib/tools/registry";

const LANDING_TOOLS = [
  ...TOOLS.filter((tool) => tool.id !== "coloring-book"),
  ...TOOLS.filter((tool) => tool.id === "coloring-book"),
];

export default function ExamplesSection() {
  return (
    <section id="examples" className="border-b border-gray-200 bg-white py-24 md:py-32">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-4xl font-bold tracking-[-0.02em] text-gray-900 md:text-5xl">
            Readings and keepsakes.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Most are editorial readings. One is a simple coloring-page keepsake. Bring whatever you have a photo of.
          </p>
        </div>
        <ToolGrid tools={LANDING_TOOLS} showCategoryChips />
      </div>
    </section>
  );
}
