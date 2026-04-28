"use client";
import { useState } from "react";
import { TOOLS } from "@/lib/tools/registry";
import type { Tool, ToolCategory } from "@/lib/tools/types";
import { ToolCard } from "./tool-card";

export interface ToolGridProps {
  tools?: Tool[];
  showCategoryChips?: boolean;
  /** Whether each tile shows its per-generation credit cost. OFF on
   *  public/marketing surfaces (don't lead with price); ON on dashboard. */
  showCost?: boolean;
}

const CATEGORIES: Array<{ id: ToolCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "creative", label: "Creative" },
  { id: "mystical", label: "Mystical" },
  { id: "analysis", label: "Analysis" },
];

export function ToolGrid({ tools = TOOLS, showCategoryChips = false, showCost = false }: ToolGridProps) {
  const [active, setActive] = useState<ToolCategory | "all">("all");
  const filtered = active === "all" ? tools : tools.filter((t) => t.category === active);

  return (
    <div>
      {showCategoryChips && (
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((c) => {
            const on = active === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  on
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {filtered.map((t) => (
          <ToolCard key={t.id} tool={t} showCost={showCost} />
        ))}
      </div>
    </div>
  );
}
