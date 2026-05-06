"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** 0..1 — fill ratio. */
  value: number;
  className?: string;
};

/**
 * Hairline progress bar. Sits at the top of every quiz screen.
 * Per QUIZ-PIVOT-SPEC.md §4.2.
 */
export function ProgressBar({ value, className }: Props) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cn("relative h-1.5 w-full bg-white/[0.08]", className)}>
      <div
        className="h-full bg-gradient-to-r from-white/90 to-white shadow-[0_0_12px_rgba(255,255,255,0.45)] transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
