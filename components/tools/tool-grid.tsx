"use client";
import { useState } from "react";
import { ORDERED_TOOLS } from "@/lib/tools/registry";
import type { Tool, ToolCategory } from "@/lib/tools/types";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { ToolCard } from "./tool-card";

export interface ToolGridProps {
  tools?: Tool[];
  showCategoryChips?: boolean;
  /** Whether each tile shows its per-generation credit cost. OFF on
   *  public/marketing surfaces (don't lead with price); ON on dashboard. */
  showCost?: boolean;
  /**
   * Show a prominent "FREE" banner on free tools (just the coloring page
   * for now), but ONLY when the visitor is signed in. Used on /readings
   * to invite signed-in users into the free entry without leaking that
   * call-out onto the landing or other pre-login surfaces.
   */
  showFreeBannerForSignedIn?: boolean;
}

const CATEGORIES: Array<{ id: ToolCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "creative", label: "Creative" },
  { id: "mystical", label: "Mystical" },
  { id: "analysis", label: "Analysis" },
];

export function ToolGrid({
  tools = ORDERED_TOOLS,
  showCategoryChips = false,
  showCost = false,
  showFreeBannerForSignedIn = false,
}: ToolGridProps) {
  const [active, setActive] = useState<ToolCategory | "all">("all");
  const filtered = active === "all" ? tools : tools.filter((t) => t.category === active);
  const { user } = useFirebase();
  const showFreeBanner = showFreeBannerForSignedIn && !!user;

  return (
    <div>
      {showCategoryChips && (
        <div className="mb-8 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = active === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  on
                    ? "bg-white text-black"
                    : "liquid-glass text-gray-200"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {filtered.map((t) => (
          <ToolCard
            key={t.id}
            tool={t}
            showCost={showCost}
            showFreeBanner={showFreeBanner}
          />
        ))}
      </div>
    </div>
  );
}
