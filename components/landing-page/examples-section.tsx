"use client";
import { ToolGrid } from "@/components/tools/tool-grid";
import { TOOL_COUNT_WORD } from "@/lib/tools/copy";

export default function ExamplesSection() {
  return (
    <section id="examples" className="py-12 md:py-16 lg:py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            {TOOL_COUNT_WORD} tools, one upload
          </h2>
          <p className="mt-4 text-gray-600 md:text-lg">
            Pick what you want. Coloring book is 1 credit. Premium tools are 10 credits each.
          </p>
        </div>
        <ToolGrid showCategoryChips />
      </div>
    </section>
  );
}
