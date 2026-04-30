import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize whatever shape Firestore is currently returning a date as.
 *
 * The same field can come back as a Firestore Timestamp (`{seconds, nanos}`),
 * an SDK Timestamp instance (with `.toMillis()`), a JS Date, an ISO string,
 * or a number — depending on whether you got it from a server snapshot, a
 * cached local-write echo, or a manual `set()` you just performed. Sorting on
 * `.seconds` directly produces NaN comparisons and effectively-random order
 * the moment any of those alternative shapes slips through.
 *
 * Returns 0 for falsy / unrecognized input so the caller can sort safely.
 */
export function tsToMillis(t: unknown): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const parsed = Date.parse(t);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (t instanceof Date) return t.getTime();
  if (typeof t === "object") {
    const obj = t as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === "function") return obj.toMillis();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return 0;
}
