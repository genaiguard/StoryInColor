"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  /** Total visible time in ms (fade in + hold + fade out). */
  durationMs?: number;
  onDone: () => void;
};

/**
 * Mid-quiz affirmation card. Fades in, holds 1.5s, fades out, then
 * fires onDone(). Per QUIZ-PIVOT-SPEC.md §4.6 §7.1.
 */
export function Affirmation({ message, durationMs = 2000, onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 300);
    const t2 = setTimeout(() => setPhase("out"), durationMs - 300);
    const t3 = setTimeout(() => onDone(), durationMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [durationMs, onDone]);

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-6"
      aria-live="polite"
    >
      <p
        className={`max-w-xl text-center font-light italic text-2xl md:text-3xl text-white/90 transition-opacity duration-300 ${
          phase === "hold" ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
