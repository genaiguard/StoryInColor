"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HAIR_SCREEN_SEQUENCE,
  type HairAnalysisScreen,
  type HairGoal,
  type HairAvoid,
  type HairSocialMotivation,
  type HairSelfDirection,
  type HairBlocker,
  type HairFeeling,
  type HairImpact,
} from "@/lib/hair-analysis/types";

const STORAGE_KEY = "sic_hair_analysis_state_v1";
const SECRETS_KEY = "sic_hair_analysis_secrets_v1";

export interface HairAnalysisState {
  screen: HairAnalysisScreen;
  goal?: HairGoal;
  avoid?: HairAvoid;
  social?: HairSocialMotivation;
  selfDirection?: HairSelfDirection;
  blocker?: HairBlocker;
  feeling?: HairFeeling;
  impact?: HairImpact;
  photoStoragePath?: string;
  pendingToken?: string;
  ownerSecret?: string;
  startedAt: string;
}

export function loadHairAnalysisState(): HairAnalysisState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HairAnalysisState;
  } catch {
    return null;
  }
}

export function clearHairAnalysisState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode */ }
}

export function rememberHairOwnerSecret(token: string, ownerSecret: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[token] = ownerSecret;
    const keys = Object.keys(map);
    if (keys.length > 20) delete map[keys[0]];
    localStorage.setItem(SECRETS_KEY, JSON.stringify(map));
  } catch { /* private mode */ }
}

export function recallHairOwnerSecret(token: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as Record<string, string>)[token];
  } catch {
    return undefined;
  }
}

export function useHairAnalysisState() {
  const [state, setState] = useState<HairAnalysisState>(() => {
    const existing = typeof window !== "undefined" ? loadHairAnalysisState() : null;
    if (existing) return existing;
    return { screen: "intro", startedAt: new Date().toISOString() };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* private mode */ }
  }, [state]);

  const goTo = useCallback((screen: HairAnalysisScreen) => {
    setState((s) => ({ ...s, screen }));
  }, []);

  const advance = useCallback(() => {
    setState((s) => {
      const idx = HAIR_SCREEN_SEQUENCE.indexOf(s.screen);
      const next = HAIR_SCREEN_SEQUENCE[Math.min(idx + 1, HAIR_SCREEN_SEQUENCE.length - 1)];
      return { ...s, screen: next };
    });
  }, []);

  const back = useCallback(() => {
    setState((s) => {
      const idx = HAIR_SCREEN_SEQUENCE.indexOf(s.screen);
      const prev = HAIR_SCREEN_SEQUENCE[Math.max(idx - 1, 0)];
      return { ...s, screen: prev };
    });
  }, []);

  return { state, setState, goTo, advance, back };
}
