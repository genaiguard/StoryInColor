// Client-side types + constants for the face-rating product.
// Server-side mirror lives in functions/src/face-rating-types.ts.
// Per PIVOT-2.md.

export type Gender = "male" | "female" | "other";

export type GoalChip =
  | "find-strengths"
  | "see-potential"
  | "compare-celebrities"
  | "glow-up-plan";

/** Six PSL tiers per PIVOT-2.md §4.5 (Option A — locked decision §8 #9). */
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

/** 8 sub-scores shown in the result page. */
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
  label: string; // "men, 25-34, North America"
  percentile: number; // 0-100
}

export interface Archetype {
  name: string; // "The Hunter"
  description: string; // 1-2 sentences
}

export interface Strength {
  feature: string; // e.g. "eye_area"
  score: number; // 0-10
  percentile_in_demographic: number; // 0-100
  observation: string;
}

export interface AreaForGrowth {
  area: string; // e.g. "skin_texture"
  score: number; // 0-10
  specific_observation: string;
  actionable: string;
}

export interface CelebrityMatch {
  name: string;
  match_pct: number; // 0-100
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
  // NO surgical fields — explicitly forbidden per founder decision §10
}

export interface ReRate {
  next_recommended_at_days: number;
}

/**
 * Stage 1 (free hook) output. Returned by analyzeFaceUnauth.
 * Designed to be small (~300 tokens) for fast TTFT.
 */
export interface FaceLightAnalysis {
  overall_score: number; // 0-10 with 1 decimal
  tier_label: string; // PSL term per PSL_TIERS
  demographic_band: DemographicBand;
  strongest_feature: {
    feature: string; // sub-score key
    observation: string; // 1 paragraph
  };
}

/**
 * Stage 2 (paid full) output. Returned by analyzeFaceFull, post-payment.
 * Drives the 11-section result page.
 */
export interface FaceFullAnalysis {
  overall_score: number;
  tier_label: string;
  demographic_band: DemographicBand;
  archetype: Archetype;
  sub_scores: Record<SubScoreKey, number>;
  strengths: Strength[]; // 3
  areas_for_growth: AreaForGrowth[]; // 3-5
  celebrity_archetype: { matches: CelebrityMatch[] }; // 0-3 (may be empty if model refuses)
  potential: Potential;
  glow_up_plan: GlowUpPlan;
  re_rate: ReRate;
}

/** Funnel screen sequence. Per PIVOT-2.md §1.2. */
export type FaceRatingScreen =
  | "intro"
  | "ready"
  | "gender"
  | "goal"
  | "country"
  | "front-photo"
  | "side-photo"
  | "loader"
  | "reveal";

export const FACE_RATING_SCREEN_SEQUENCE: FaceRatingScreen[] = [
  "intro",
  "ready",
  "gender",
  "goal",
  "country",
  "front-photo",
  "side-photo",
  "loader",
  "reveal",
];

export const GOAL_OPTIONS: { id: GoalChip; label: string }[] = [
  { id: "find-strengths", label: "Find my strengths" },
  { id: "see-potential", label: "See my potential" },
  { id: "compare-celebrities", label: "Compare to celebrities" },
  { id: "glow-up-plan", label: "Get a glow-up plan" },
];

export const GENDER_OPTIONS: { id: Gender; label: string }[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "other", label: "Prefer not to say" },
];

/** Loader steps with REAL technical content per PIVOT-2.md §4.1 (theatrical loader). */
export const FACE_LOADER_STEPS: { label: string; durationMs: number }[] = [
  { label: "Detecting your face…", durationMs: 1200 },
  { label: "Extracting facial landmarks…", durationMs: 1800 },
  { label: "Computing harmony, symmetry, and proportions…", durationMs: 2200 },
  { label: "Comparing to our reference dataset…", durationMs: 2500 },
  { label: "Generating your honest reading…", durationMs: 1500 },
];

/** Sub-messages rotated under the loader. */
export const FACE_LOADER_SUBMESSAGES = [
  "Same input → same output. No score volatility.",
  "We use 8 calibrated sub-scores, not just a single number.",
  "Your photos never leave our servers unencrypted.",
  "Almost there.",
  "We're identifying your archetype.",
  "Calibrated against thousands of reference photos.",
];

/** Stage 1 hero teaser pool (used while Stage 1 result is loading on reveal). */
export const FACE_REVEAL_TEASERS = [
  "Your honest face rating is ready.",
  "We see something specific in your features.",
  "Your structure reads stronger than most we've analyzed.",
  "One feature is doing more work than the rest.",
];

/** Affirmation pool — between screens. */
export const FACE_AFFIRMATIONS = [
  "Got it — that calibrates our model.",
  "Locked in. Your reading will reflect this.",
  "Noted.",
  "Recorded — carrying forward.",
  "That helps the demographic match.",
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
