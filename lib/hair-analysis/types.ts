// Client-side types + constants for the hairstyle-analysis product.
// Server mirror: functions/src/hair-analysis-types.ts (keep in sync by hand).

export type HairGoal =
  | "fresh-start"
  | "look-like-myself"
  | "take-it-up"
  | "get-back"
  | "something-needs-to-change";

export type HairAvoid =
  | "too-short"
  | "look-older"
  | "look-generic"
  | "ruin-texture"
  | "high-maintenance"
  | "trust-the-process";

export type HairSocialMotivation =
  | "very"
  | "somewhat"
  | "not-much"
  | "stopped-thinking";

export type HairSelfDirection =
  | "get-back"
  | "move-toward"
  | "both"
  | "not-sure";

export type HairBlocker =
  | "dont-know-what-works"
  | "didnt-work-before"
  | "scared-of-stylist"
  | "ready"
  | "didnt-think-existed";

export type HairFeeling =
  | "look-twice"
  | "better-version"
  | "confident-effortless"
  | "unrecognizable"
  | "finally-right";

export type HairImpact =
  | "a-lot"
  | "some"
  | "not-sure-thats-why"
  | "not-much";

export type HairTransformationLevel = "conservative" | "moderate" | "bold";

export type FaceShape = "oval" | "round" | "square" | "heart" | "oblong";

/** One generated hairstyle cell. */
export interface HairStyleCell {
  label: string;
  storagePath: string;
  /** Signed download URL — set server-side from token. */
  url?: string;
}

/** Stage 1 preview data returned to client. */
export interface HairPreview {
  faceShape: FaceShape;
  transformationLevel: HairTransformationLevel;
  previewCell: HairStyleCell;   // always free
  styleLabels: string[];        // all 8 labels — always visible
}

/** Full paid report. */
export interface HairFullReport {
  faceShape: FaceShape;
  transformationLevel: HairTransformationLevel;
  cells: HairStyleCell[];       // all 8 cells
  stylistBrief: string;
}

// ---------- Screen sequence ----------

export type HairAnalysisScreen =
  | "intro"
  | "q1-goal"
  | "q2-avoid"
  | "q3-social"
  | "q4-self"
  | "q5-blocker"
  | "q6-feeling"
  | "q7-impact"
  | "lockin"
  | "photo-upload"
  | "loader"
  | "reveal";

export const HAIR_SCREEN_SEQUENCE: HairAnalysisScreen[] = [
  "intro",
  "q1-goal",
  "q2-avoid",
  "q3-social",
  "q4-self",
  "q5-blocker",
  "q6-feeling",
  "q7-impact",
  "lockin",
  "photo-upload",
  "loader",
  "reveal",
];

// ---------- Questionnaire options ----------

export const GOAL_OPTIONS: { id: HairGoal; label: string; sub?: string }[] = [
  { id: "fresh-start", label: "Fresh start", sub: "I need something completely different" },
  { id: "look-like-myself", label: "Look more like myself", sub: "I've drifted from who I am" },
  { id: "take-it-up", label: "Take it up a notch", sub: "I want people to notice" },
  { id: "get-back", label: "Get back to a version of me I loved" },
  { id: "something-needs-to-change", label: "I just know something needs to change" },
];

export const AVOID_OPTIONS: { id: HairAvoid; label: string }[] = [
  { id: "too-short", label: "Chop it too short" },
  { id: "look-older", label: "Make me look older" },
  { id: "look-generic", label: "Make me look like everyone else" },
  { id: "ruin-texture", label: "Ruin the texture" },
  { id: "high-maintenance", label: "Make it high-maintenance" },
  { id: "trust-the-process", label: "Nothing — I trust the process" },
];

export const SOCIAL_OPTIONS: { id: HairSocialMotivation; label: string }[] = [
  { id: "very", label: "Very — I love when people compliment my hair" },
  { id: "somewhat", label: "Somewhat — it affects how I carry myself" },
  { id: "not-much", label: "Not much — I want to feel like myself, not perform" },
  { id: "stopped-thinking", label: "I've stopped thinking about it" },
];

export const SELF_DIRECTION_OPTIONS: { id: HairSelfDirection; label: string; sub?: string }[] = [
  { id: "get-back", label: "Get back to", sub: "I used to feel better about how I looked" },
  { id: "move-toward", label: "Move toward", sub: "I'm ready to become someone new" },
  { id: "both", label: "Both, honestly" },
  { id: "not-sure", label: "I'm not sure yet", sub: "I just know something isn't right" },
];

export const BLOCKER_OPTIONS: { id: HairBlocker; label: string }[] = [
  { id: "dont-know-what-works", label: "I don't know what would actually work for me" },
  { id: "didnt-work-before", label: "I've tried before and it didn't come out right" },
  { id: "scared-of-stylist", label: "I'm scared to ask a stylist — I never know how to explain what I want" },
  { id: "ready", label: "Nothing — I'm ready to try something new" },
  { id: "didnt-think-existed", label: "I didn't think something better existed for me" },
];

export const FEELING_OPTIONS: { id: HairFeeling; label: string }[] = [
  { id: "look-twice", label: "Like people will look twice" },
  { id: "better-version", label: "Like a better version of me — subtle but right" },
  { id: "confident-effortless", label: "Confident without thinking about it" },
  { id: "unrecognizable", label: "Completely unrecognizable (in the best way)" },
  { id: "finally-right", label: "Finally right" },
];

export const IMPACT_OPTIONS: { id: HairImpact; label: string }[] = [
  { id: "a-lot", label: "A lot — I think the right cut could change everything" },
  { id: "some", label: "Some — but I also need to take better care of it" },
  { id: "not-sure-thats-why", label: "Honestly, I'm not sure — that's why I'm here" },
  { id: "not-much", label: "Not much — I'm happy, just curious" },
];

// ---------- Loader steps ----------

export const HAIR_LOADER_STEPS: { label: string; durationMs: number }[] = [
  { label: "Analyzing your face structure…", durationMs: 1000 },
  { label: "Reading your goals and preferences…", durationMs: 900 },
  { label: "Selecting 8 styles from our library…", durationMs: 1100 },
  { label: "Generating your looks with AI…", durationMs: 1800 },
  { label: "Your hairstyle report is ready.", durationMs: 800 },
];

export const HAIR_LOADER_SUBMESSAGES = [
  "8 styles being generated for your face.",
  "Face shape detected — narrowing the selection.",
  "Matching styles to your stated goals.",
  "Final renders in progress…",
];

// ---------- Affirmations (after each question) ----------

export const HAIR_AFFIRMATIONS = [
  "Got it.",
  "Recorded.",
  "That helps us narrow it down.",
  "Noted.",
  "Good — that shapes the selection.",
];

export function pickHairAffirmation(): string {
  return HAIR_AFFIRMATIONS[Math.floor(Math.random() * HAIR_AFFIRMATIONS.length)];
}

export function progressForHairScreen(screen: HairAnalysisScreen): number {
  const pos = HAIR_SCREEN_SEQUENCE.indexOf(screen);
  if (pos < 0) return 0;
  return Math.min(1, pos / (HAIR_SCREEN_SEQUENCE.length - 1));
}

/** Map goal + self-direction → transformation level. */
export function deriveTransformationLevel(
  goal: HairGoal | undefined,
  selfDirection: HairSelfDirection | undefined,
  feeling: HairFeeling | undefined,
): HairTransformationLevel {
  const boldGoals: HairGoal[] = ["fresh-start", "take-it-up"];
  const boldFeelings: HairFeeling[] = ["unrecognizable"];
  const conservativeGoals: HairGoal[] = ["look-like-myself", "get-back"];
  const conservativeFeelings: HairFeeling[] = ["better-version", "finally-right", "confident-effortless"];

  let boldScore = 0;
  if (goal && boldGoals.includes(goal)) boldScore += 2;
  if (selfDirection === "move-toward") boldScore += 1;
  if (feeling && boldFeelings.includes(feeling)) boldScore += 2;
  if (goal && conservativeGoals.includes(goal)) boldScore -= 1;
  if (selfDirection === "get-back") boldScore -= 1;
  if (feeling && conservativeFeelings.includes(feeling)) boldScore -= 1;

  if (boldScore >= 2) return "bold";
  if (boldScore <= -1) return "conservative";
  return "moderate";
}
