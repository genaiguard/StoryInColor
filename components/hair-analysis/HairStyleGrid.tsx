"use client";

import { Lock } from "lucide-react";
import type { HairStyleCell } from "@/lib/hair-analysis/types";

interface HairStyleGridProps {
  /** All 8 style labels — always rendered, never blurred. */
  styleLabels: string[];
  /** Cells with URLs — only cells present here are revealed. */
  cells: HairStyleCell[];
  /** If true, all cells are fully revealed (paid state). */
  revealAll?: boolean;
  /** Index of the single free preview cell (default 0). */
  previewIndex?: number;
}

export function HairStyleGrid({
  styleLabels,
  cells,
  revealAll = false,
  previewIndex = 0,
}: HairStyleGridProps) {
  const urlMap = Object.fromEntries(cells.map((c, i) => [i, c.url]));

  return (
    <div className="grid grid-cols-2 gap-2">
      {styleLabels.map((label, i) => {
        const url = urlMap[i];
        const isRevealed = revealAll || i === previewIndex;

        return (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="relative overflow-hidden rounded-xl bg-white/[0.04] aspect-[4/3]">
              {url ? (
                <img
                  src={url}
                  alt={label}
                  className={`h-full w-full object-cover transition-all duration-500 ${
                    isRevealed ? "" : "scale-[1.08] blur-[10px]"
                  }`}
                  draggable={false}
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-white/[0.06]" />
              )}

              {!isRevealed && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-sm">
                    <Lock className="h-3.5 w-3.5 text-white/70" />
                  </div>
                </div>
              )}
            </div>

            {/* Label always visible — this is the hook */}
            <p className="text-center text-[11px] uppercase tracking-[0.14em] text-white/65">
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
