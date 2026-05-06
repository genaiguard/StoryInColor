// Server-side mirror of lib/face-rating/types.ts.
// The two npm trees don't share modules; keep these in sync by hand.
// Per PIVOT-2.md.

export type Gender = "male" | "female" | "other";
export type AgeRange = "18-24" | "25-34" | "35-44" | "45+";
export type GoalChip =
  | "psl-tier"
  | "biggest-strength"
  | "score-blocker"
  | "glow-up-plan";
export type ComplimentsFreq =
  | "never"
  | "rarely"
  | "sometimes"
  | "often"
  | "very-often";

export const PSL_TIERS = [
  { min: 9.0, max: 10.0, label: "Chadpreet" },
  { min: 8.0, max: 8.99, label: "Chad" },
  { min: 7.0, max: 7.99, label: "Chadlite" },
  { min: 6.0, max: 6.99, label: "High Tier Normie" },
  { min: 5.0, max: 5.99, label: "Mid Tier Normie" },
  { min: 3.5, max: 4.99, label: "Low Tier Normie" },
  { min: 0.0, max: 3.49, label: "Subhuman" },
] as const;

export function tierForScore(score: number): string {
  for (const t of PSL_TIERS) {
    if (score >= t.min && score <= t.max) return t.label;
  }
  return PSL_TIERS[PSL_TIERS.length - 1].label;
}

export const SUB_SCORE_KEYS = [
  "facial_harmony",
  "facial_symmetry",
  "jawline_definition",
  "eye_area",
  "skin_quality",
  "smile",
  "photogenic_score",
  "expression",
] as const;

/** Stage 1 output schema — small, fast, drives the email-capture hook. */
export interface FaceLightAnalysis {
  overall_score: number;
  tier_label: string;
  demographic_band: { label: string; percentile: number };
  strongest_feature: { feature: string; observation: string };
}

/** Stage 2 output schema — full report, paid. */
export interface FaceFullAnalysis {
  overall_score: number;
  tier_label: string;
  demographic_band: { label: string; percentile: number };
  archetype: { name: string; description: string };
  sub_scores: Record<string, number>;
  strengths: {
    feature: string;
    score: number;
    percentile_in_demographic: number;
    observation: string;
  }[];
  areas_for_growth: {
    area: string;
    score: number;
    specific_observation: string;
    actionable: string;
  }[];
  celebrity_archetype: {
    matches: { name: string; match_pct: number; shared_features: string }[];
  };
  potential: {
    current_score: number;
    optimized_score: number;
    gap_drivers: string[];
  };
  glow_up_plan: {
    haircut: string;
    grooming: string;
    skincare: string;
    photography: string;
    expression: string;
  };
  re_rate: { next_recommended_at_days: number };
}

/** Pending face-rating doc — extends the existing pendingReadings collection
 *  with a discriminator (`type: "face-rating"`) so we can distinguish from
 *  legacy /quiz funnel docs that occupy the same collection. */
export interface PendingFaceReadingDoc {
  type: "face-rating";
  token: string;
  status:
    | "processing"
    | "ready"
    | "failed"
    | "claimed"
    | "expired";
  ipHash: string;
  gender?: Gender;
  ageRange?: AgeRange;
  goal?: GoalChip;
  /** User's pre-analysis self-rating (1–10). Calibration prior. */
  selfRate?: number;
  /** "How often do strangers compliment your looks?" — calibration prior. */
  complimentsFreq?: ComplimentsFreq;
  /** Legacy field — kept for backward compat. */
  countryCode?: string;
  frontPhotoStoragePath: string;
  sidePhotoStoragePath?: string;
  /** Stage 1 light analysis (free hook). */
  lightAnalysis?: FaceLightAnalysis;
  /** Stage 2 full analysis (paid). Set on payment success. */
  fullAnalysis?: FaceFullAnalysis;
  /** Email captured to "see your reading." */
  email?: string;
  emailCapturedAt?: FirebaseFirestore.Timestamp;
  marketingOptIn?: boolean;
  /** Stripe checkout session id once user initiates checkout. */
  stripeCheckoutSessionId?: string;
  /** Set after webhook processes payment. */
  claimedByUid?: string;
  claimedAt?: FirebaseFirestore.Timestamp;
  /** Sharable URL — opt-in toggle (option C). */
  shareId?: string; // 8-char alphanumeric
  shareEnabled?: boolean;
  /** Invite-3-friends mechanic. */
  inviteCode?: string; // 6-char alphanumeric, owner's referral code
  inviteRedemptions?: number; // count of unique referrers who completed an analysis
  inviteUnlocked?: boolean; // true once 3 friends complete
  /** Re-rate of same face (free if within 14 days of first paid analysis). */
  reRateCount?: number;
  /**
   * Owner secret — generated server-side on Stage 1, returned to the
   * original client, persisted in the doc. Required on every sensitive
   * post-claim callable (delete, share toggle, invite create, full report
   * read for claimed docs). Per BUG-REVIEW.md C1+C2.
   */
  ownerSecret?: string;
  /** Stage 2 in-progress flag — short-lived guard against duplicate runs. */
  stage2InProgressAt?: FirebaseFirestore.Timestamp;
  photosDeleted?: boolean;
  photosDeletedAt?: FirebaseFirestore.Timestamp;
  creditedInviteCodes?: string[];
  referredByInviteCode?: string;
  /** Standard pending fields. */
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
  fbEventId?: string;
  errorMessage?: string;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
}

export const FACE_RATING_ENABLED_FLAG = "STORYINCOLOR_FACE_RATING_ENABLED";

export function isFaceRatingEnabled(): boolean {
  // Defaults to true unless explicitly disabled, since this is the new
  // primary product post-pivot.
  return process.env[FACE_RATING_ENABLED_FLAG] !== "false";
}
