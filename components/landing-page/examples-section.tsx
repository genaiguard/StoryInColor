"use client";
import { ToolGrid } from "@/components/tools/tool-grid";

export default function ExamplesSection() {
  return (
    <section id="examples" className="py-12 md:py-16 lg:py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">What you can create</h2>
          <p className="max-w-3xl mx-auto mt-3 text-gray-600 md:text-lg">One photo in. One beautiful, magazine-quality piece out. Pick a tool below.</p>
        </div>
        <ToolGrid showCategoryChips />
      </div>
    </section>
  );
}
