"use client";

import { cn } from "@/lib/utils";
import type { QuestionOption, QuestionOptionLayout } from "@/lib/quiz/types";

type Props = {
  option: QuestionOption;
  layout: QuestionOptionLayout;
  selected?: boolean;
  onSelect: (optionId: string) => void;
};

/**
 * Selectable quiz option card. Adapts visually to layout type.
 * Per QUIZ-PIVOT-SPEC.md §4.2.
 */
export function OptionCard({ option, layout, selected = false, onSelect }: Props) {
  if (layout === "image-grid") {
    return (
      <button
        type="button"
        onClick={() => onSelect(option.id)}
        className={cn(
          "group relative flex aspect-square w-full items-end overflow-hidden rounded-2xl border transition-all duration-200",
          selected
            ? "border-white bg-white text-black scale-[1.02]"
            : "border-white/10 bg-white/[0.04] text-white hover:border-white/30",
        )}
        aria-pressed={selected}
      >
        {option.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.imageSrc}
            alt={option.label}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
              selected ? "opacity-90" : "opacity-80",
            )}
          />
        ) : null}
        <div
          className={cn(
            "relative z-10 w-full bg-gradient-to-t p-3 text-left text-sm font-medium",
            selected ? "from-white via-white/90 to-transparent" : "from-black/80 via-black/40 to-transparent",
          )}
        >
          {option.label}
        </div>
      </button>
    );
  }

  if (layout === "emoji-grid") {
    return (
      <button
        type="button"
        onClick={() => onSelect(option.id)}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-6 transition-all duration-200",
          selected
            ? "border-white bg-white text-black scale-[1.02]"
            : "border-white/10 bg-white/[0.04] text-white hover:border-white/30",
        )}
        aria-pressed={selected}
      >
        {option.emoji ? <span className="text-3xl">{option.emoji}</span> : null}
        <span className="text-sm font-medium">{option.label}</span>
      </button>
    );
  }

  // pill (default)
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-full border px-5 py-4 text-left transition-all duration-200",
        selected
          ? "border-white bg-white text-black scale-[1.02]"
          : "border-white/10 bg-white/[0.04] text-white hover:border-white/30",
      )}
      aria-pressed={selected}
    >
      {option.emoji ? <span className="text-xl">{option.emoji}</span> : null}
      <span className="text-base font-medium">{option.label}</span>
    </button>
  );
}
