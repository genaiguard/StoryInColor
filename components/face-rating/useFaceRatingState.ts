"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FACE_RATING_SCREEN_SEQUENCE,
  type FaceRatingScreen,
  type Gender,
  type GoalChip,
  type FaceLightAnalysis,
} from "@/lib/face-rating/types";

const STORAGE_KEY = "sic_face_rating_state_v1";
const SECRETS_KEY = "sic_face_rating_secrets_v1"; // map<token, ownerSecret>

export interface FaceRatingState {
  screen: FaceRatingScreen;
  gender?: Gender;
  goal?: GoalChip;
  countryCode?: string;
  pendingReadingToken?: string;
  frontPhotoStoragePath?: string;
  sidePhotoStoragePath?: string;
  inviteCodeRedeemed?: string; // friend's code we redeemed coming in
  startedAt: string;
  lightAnalysis?: FaceLightAnalysis;
  /** Owner secret returned by analyzeFaceUnauth — required on sensitive
   *  callables (delete photo, share toggle, invite create, getFaceFullReport
   *  for paid/unlocked tokens). Per BUG-REVIEW.md C1+C2. */
  ownerSecret?: string;
}

export function loadFaceRatingState(): FaceRatingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FaceRatingState;
  } catch {
    return null;
  }
}

export function clearFaceRatingState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** Persist token→ownerSecret across clearFaceRatingState() calls so the
 *  result page survives a state wipe. M4 follow-up. */
export function rememberOwnerSecret(token: string, ownerSecret: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[token] = ownerSecret;
    // Cap at 20 entries — drop oldest.
    const keys = Object.keys(map);
    if (keys.length > 20) {
      delete map[keys[0]];
    }
    localStorage.setItem(SECRETS_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function recallOwnerSecret(token: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (!raw) return undefined;
    const map: Record<string, string> = JSON.parse(raw);
    return map[token];
  } catch {
    return undefined;
  }
}

export function useFaceRatingState() {
  const [state, setState] = useState<FaceRatingState>(() => {
    const existing =
      typeof window !== "undefined" ? loadFaceRatingState() : null;
    if (existing) return existing;
    return {
      screen: "intro",
      startedAt: new Date().toISOString(),
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state]);

  const goTo = useCallback((screen: FaceRatingScreen) => {
    setState((s) => ({ ...s, screen }));
  }, []);

  const advance = useCallback(() => {
    setState((s) => {
      const idx = FACE_RATING_SCREEN_SEQUENCE.indexOf(s.screen);
      const next =
        FACE_RATING_SCREEN_SEQUENCE[
          Math.min(idx + 1, FACE_RATING_SCREEN_SEQUENCE.length - 1)
        ];
      return { ...s, screen: next };
    });
  }, []);

  const back = useCallback(() => {
    setState((s) => {
      const idx = FACE_RATING_SCREEN_SEQUENCE.indexOf(s.screen);
      const prev =
        FACE_RATING_SCREEN_SEQUENCE[Math.max(idx - 1, 0)];
      return { ...s, screen: prev };
    });
  }, []);

  return {
    state,
    setState,
    goTo,
    advance,
    back,
  };
}
