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
    <div
      className={cn("h-px w-full bg-white/10", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-white transition-[width] duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
