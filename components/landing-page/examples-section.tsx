"use client";
import { ToolGrid } from "@/components/tools/tool-grid";

export default function ExamplesSection() {
  return (
    <section id="examples" className="border-b border-gray-200 bg-[#fbf8f6] py-24 md:py-32">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
            <span className="h-px w-8 bg-gray-300" aria-hidden="true" />
            The tools
          </div>
          <h2 className="text-4xl font-bold tracking-[-0.02em] text-gray-900 md:text-5xl">
            Pick your read.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Each tool takes one photo and returns an editorial-quality result. No subscriptions, no learning curve.
          </p>
        </div>
        <ToolGrid showCategoryChips />
      </div>
    </section>
  );
}
