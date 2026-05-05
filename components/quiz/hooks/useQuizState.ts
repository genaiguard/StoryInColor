"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizConfig } from "@/lib/quiz/types";

const STORAGE_KEY_PREFIX = "sic_quiz_state_v1_";

export type QuizScreen =
  | "intro"
  | "hook"
  | "identityA"
  | "identityB"
  | "identityC"
  | "aspiration"
  | "specific"
  | "upload"
  | "loader"
  | "reveal";

export const SCREEN_SEQUENCE: QuizScreen[] = [
  "intro",
  "hook",
  "identityA",
  "identityB",
  "identityC",
  "aspiration",
  "specific",
  "upload",
  "loader",
  "reveal",
];

export interface QuizState {
  slug: string;
  screen: QuizScreen;
  answers: Record<string, string>; // questionId -> optionId
  startedAt: string; // ISO
  pendingReadingToken?: string;
  inputStoragePath?: string;
  blurredOutputUrl?: string;
}

function storageKey(slug: string) {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

export function loadQuizState(slug: string): QuizState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizState;
    if (!parsed || parsed.slug !== slug) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearQuizState(slug: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(slug));
  } catch {
    /* private mode */
  }
}

export function useQuizState(config: QuizConfig) {
  const [state, setState] = useState<QuizState>(() => {
    const existing =
      typeof window !== "undefined" ? loadQuizState(config.slug) : null;
    if (existing) return existing;
    return {
      slug: config.slug,
      screen: "intro",
      answers: {},
      startedAt: new Date().toISOString(),
    };
  });

  // Persist to localStorage on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey(config.slug), JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state, config.slug]);

  const recordAnswer = useCallback((questionId: string, optionId: string) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: optionId },
    }));
  }, []);

  const goTo = useCallback((screen: QuizScreen) => {
    setState((s) => ({ ...s, screen }));
  }, []);

  const advance = useCallback(() => {
    setState((s) => {
      const idx = SCREEN_SEQUENCE.indexOf(s.screen);
      const next = SCREEN_SEQUENCE[Math.min(idx + 1, SCREEN_SEQUENCE.length - 1)];
      return { ...s, screen: next };
    });
  }, []);

  const back = useCallback(() => {
    setState((s) => {
      const idx = SCREEN_SEQUENCE.indexOf(s.screen);
      const prev = SCREEN_SEQUENCE[Math.max(idx - 1, 0)];
      return { ...s, screen: prev };
    });
  }, []);

  const setPendingReadingToken = useCallback((token: string) => {
    setState((s) => ({ ...s, pendingReadingToken: token }));
  }, []);

  const setInputStoragePath = useCallback((path: string) => {
    setState((s) => ({ ...s, inputStoragePath: path }));
  }, []);

  const setBlurredOutputUrl = useCallback((url: string) => {
    setState((s) => ({ ...s, blurredOutputUrl: url }));
  }, []);

  return {
    state,
    recordAnswer,
    goTo,
    advance,
    back,
    setPendingReadingToken,
    setInputStoragePath,
    setBlurredOutputUrl,
  };
}

/** Compute the progress value (0..1) for the current screen. */
export function progressForScreen(screen: QuizScreen): number {
  // Pre-quiz screens advance the progress; loader+reveal hold at near-full.
  const pos = SCREEN_SEQUENCE.indexOf(screen);
  if (pos < 0) return 0;
  const total = SCREEN_SEQUENCE.length - 1; // exclude reveal from divisor
  return Math.min(1, pos / total);
}
