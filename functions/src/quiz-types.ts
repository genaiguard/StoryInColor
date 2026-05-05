// Server-side types for the quiz funnel (mirrors lib/quiz/types.ts shape).
// Kept as a separate file in functions/ because the two npm trees don't
// share modules — we maintain types by hand on each side.

export type QuizAnswers = Record<string, string>;

export type PendingReadingStatus =
  | "processing"
  | "ready"
  | "failed"
  | "claimed"
  | "expired";

export interface PendingReadingDoc {
  token: string;
  toolId: string;
  status: PendingReadingStatus;
  ipHash: string;
  quizAnswers: QuizAnswers;
  inputStoragePath: string;
  outputStoragePath?: string;
  outputDownloadUrl?: string;
  blurredOutputDownloadUrl?: string;
  blurredStoragePath?: string;
  email?: string;
  emailCapturedAt?: FirebaseFirestore.Timestamp;
  fbEventId?: string;
  attribution?: {
    fbp?: string;
    fbc?: string;
    gaClientId?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    referrer?: string;
  };
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  claimedByUid?: string;
  claimedAt?: FirebaseFirestore.Timestamp;
  errorMessage?: string;
}

export const QUIZ_FUNNEL_ENABLED_FLAG = "STORYINCOLOR_QUIZ_FUNNEL_ENABLED";

/** True iff the kill-switch env var allows quiz funnel functions to run. */
export function isQuizFunnelEnabled(): boolean {
  return process.env[QUIZ_FUNNEL_ENABLED_FLAG] === "true";
}
