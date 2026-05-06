// Client-side types + constants for the face-rating product.
// Server mirror: functions/src/face-rating-types.ts.
// 12-screen flow per COMPETITOR-FLOWS.md teardown of UMAX/LooksMax/Mogged.

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

/** Six PSL tiers per founder decision §9. */
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

/** 8 sub-scores. */
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

export type SubScoreKey = (typeof SUB_SCORE_KEYS)[number];

export const SUB_SCORE_LABELS: Record<SubScoreKey, string> = {
  facial_harmony: "Facial Harmony",
  facial_symmetry: "Symmetry",
  jawline_definition: "Jawline",
  eye_area: "Eye Area",
  skin_quality: "Skin Quality",
  smile: "Smile",
  photogenic_score: "Photogenic",
  expression: "Expression",
};

export interface DemographicBand {
  label: string;
  percentile: number;
}

export interface Archetype {
  name: string;
  description: string;
}

export interface Strength {
  feature: string;
  score: number;
  percentile_in_demographic: number;
  observation: string;
}

export interface AreaForGrowth {
  area: string;
  score: number;
  specific_observation: string;
  actionable: string;
}

export interface CelebrityMatch {
  name: string;
  match_pct: number;
  shared_features: string;
}

export interface Potential {
  current_score: number;
  optimized_score: number;
  gap_drivers: string[];
}

export interface GlowUpPlan {
  haircut: string;
  grooming: string;
  skincare: string;
  photography: string;
  expression: string;
}

export interface ReRate {
  next_recommended_at_days: number;
}

export interface FaceLightAnalysis {
  overall_score: number;
  tier_label: string;
  demographic_band: DemographicBand;
  strongest_feature: { feature: string; observation: string };
}

export interface FaceFullAnalysis {
  overall_score: number;
  tier_label: string;
  demographic_band: DemographicBand;
  archetype: Archetype;
  sub_scores: Record<SubScoreKey, number>;
  strengths: Strength[];
  areas_for_growth: AreaForGrowth[];
  celebrity_archetype: { matches: CelebrityMatch[] };
  potential: Potential;
  glow_up_plan: GlowUpPlan;
  re_rate: ReRate;
}

/** 12-screen sequence per COMPETITOR-FLOWS.md. */
export type FaceRatingScreen =
  | "intro"
  | "gender"
  | "age"
  | "goal"
  | "self-rate"
  | "mission"
  | "compliments"
  | "lockin"
  | "front-photo"
  | "side-photo"
  | "loader"
  | "reveal";

export const FACE_RATING_SCREEN_SEQUENCE: FaceRatingScreen[] = [
  "intro",
  "gender",
  "age",
  "goal",
  "self-rate",
  "mission",
  "compliments",
  "lockin",
  "front-photo",
  "side-photo",
  "loader",
  "reveal",
];

export const GENDER_OPTIONS: { id: Gender; label: string; promise?: string }[] = [
  { id: "male", label: "Male", promise: "Show me where I land." },
  { id: "female", label: "Female", promise: "Personalize my read." },
  { id: "other", label: "Prefer not to say" },
];

export const AGE_OPTIONS: { id: AgeRange; label: string }[] = [
  { id: "18-24", label: "18–24" },
  { id: "25-34", label: "25–34" },
  { id: "35-44", label: "35–44" },
  { id: "45+", label: "45+" },
];

export const GOAL_OPTIONS: { id: GoalChip; label: string }[] = [
  { id: "psl-tier", label: "Where I land on the PSL scale" },
  { id: "biggest-strength", label: "My biggest strength" },
  { id: "score-blocker", label: "What's holding my score back" },
  { id: "glow-up-plan", label: "My glow-up plan" },
];

export const COMPLIMENTS_OPTIONS: { id: ComplimentsFreq; label: string }[] = [
  { id: "never", label: "Never" },
  { id: "rarely", label: "Rarely" },
  { id: "sometimes", label: "Sometimes" },
  { id: "often", label: "Often" },
  { id: "very-often", label: "Very often" },
];

/** Self-rating slider anchor labels per band (1–10). */
export const SELF_RATE_ANCHORS = [
  { min: 1, max: 1.9, label: "Subhuman" },
  { min: 2, max: 3.9, label: "Low Tier" },
  { min: 4, max: 5.9, label: "Below average" },
  { min: 6, max: 6.9, label: "Average" },
  { min: 7, max: 7.9, label: "Above average" },
  { min: 8, max: 8.9, label: "Chad" },
  { min: 9, max: 10, label: "Chadpreet" },
];

export function selfRateLabelFor(value: number): string {
  for (const a of SELF_RATE_ANCHORS) {
    if (value >= a.min && value <= a.max) return a.label;
  }
  return "Average";
}

/** Loader steps — REAL technical content (credibility). */
export const FACE_LOADER_STEPS: { label: string; durationMs: number }[] = [
  { label: "Detecting your face…", durationMs: 1200 },
  { label: "Extracting facial landmarks…", durationMs: 1800 },
  { label: "Computing harmony, symmetry, and proportions…", durationMs: 2200 },
  { label: "Comparing to our reference dataset…", durationMs: 2500 },
  { label: "Building your honest read…", durationMs: 1500 },
];

/**
 * Loader sub-messages — USER-VOICE per UMAX teardown. Personal-sounding,
 * fake-precise, curiosity-gap escalating into the paywall. Per
 * COMPETITOR-FLOWS.md fix #5.
 */
export const FACE_LOADER_SUBMESSAGES = [
  "3 standout traits detected.",
  "2 areas that could age your read faster.",
  "1 high-priority fix flagged.",
  "Calculating your honest baseline.",
  "Comparing against thousands of reference photos in your demographic.",
];

export const FACE_REVEAL_TEASERS = [
  "Your honest face rating is ready.",
  "We see something specific in your features.",
  "Your structure reads stronger than most we've analyzed.",
  "One feature is doing more work than the rest.",
];

export const FACE_AFFIRMATIONS = [
  "Got it — locked in.",
  "Recorded.",
  "That sharpens the read.",
  "Held. Carrying forward.",
  "Noted.",
];

export function pickFaceAffirmation(): string {
  return FACE_AFFIRMATIONS[Math.floor(Math.random() * FACE_AFFIRMATIONS.length)];
}

export function pickFaceTeaser(): string {
  return FACE_REVEAL_TEASERS[Math.floor(Math.random() * FACE_REVEAL_TEASERS.length)];
}

export function progressForFaceScreen(screen: FaceRatingScreen): number {
  const pos = FACE_RATING_SCREEN_SEQUENCE.indexOf(screen);
  if (pos < 0) return 0;
  const total = FACE_RATING_SCREEN_SEQUENCE.length - 1;
  return Math.min(1, pos / total);
}
