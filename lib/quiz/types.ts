// Quiz funnel types — shared between client + server-side referencing.
// Per QUIZ-PIVOT-SPEC.md §4.4.

export type QuestionOptionLayout = "pill" | "image-grid" | "emoji-grid";

export type QuestionOption = {
  id: string;
  label: string;
  emoji?: string;
  imageSrc?: string;
};

export type Question = {
  id: string;
  prompt: string;
  subPrompt?: string;
  layout: QuestionOptionLayout;
  options: QuestionOption[];
  affirmationAfter?: string;
};

export type LoaderStep = {
  label: string;
  durationMs: number;
};

export type RevealConfig = {
  /**
   * Headline shown unblurred above the blurred image. May contain
   * `{token}` placeholders that the GPT-4o-mini headline-insight pass
   * (Path A) fills in. Path B fallback uses the static pool in
   * `lib/quiz/reveal-headlines.ts`.
   */
  headlineInsight: string;
  /** Sharp blur sigma. 35 default; 45 for grid-style outputs (hairstyle, color). */
  blurStrength: number;
  unlockCtaLabel: string;
};

export type QuizConfig = {
  toolId: string;
  slug: string;
  hook: Question;
  identityA: Question;
  identityB: Question;
  identityC: Question;
  aspiration: Question;
  specific: Question;
  uploadHint: string;
  uploadInputAccept: string;
  loaderSteps: LoaderStep[];
  reveal: RevealConfig;
};

/** Stable identifier of a quiz answer, written into pendingReadings.quizAnswers. */
export type QuizAnswer = {
  questionId: string;
  optionId: string;
  answeredAt: string; // ISO timestamp
};

/** Mid-quiz affirmation pool, randomly chosen per slot. See §4.6. */
export const AFFIRMATIONS_POOL: string[] = [
  // Verbatim Nebula (per FunnelFox 2026 teardown)
  "You carry something rare within you.",
  "Awaken the mission your soul carries.",
  "Embrace your potential.",
  // StoryInColor original, same register
  "Got it. We'll keep this in mind.",
  "Noted — this changes how we read your photo.",
  "You're more reflective than most people who take this.",
  "That tracks. We see this with people who notice the small things.",
  "Lock that in. The reading will lean here.",
  "Honest answer. We work better with those.",
  "Held. Your reading will reflect this.",
  "That's a thoughtful pick.",
  "That answer puts you in a less-common group.",
  "Recorded. Carrying forward.",
  "Your face holds patterns most people will never see.",
  "There's a story written across your features.",
  "What you're about to discover, very few have seen.",
  "Most people stop here. You went further.",
  "You're not like the others we've read.",
  "What you carry is older than you know.",
  "We see something we want you to see too.",
];

/** Used after sensitive disclosures (Noom-verbatim adapted). */
export const SENSITIVE_AFFIRMATIONS_POOL: string[] = [
  "Thank you for sharing. That's an important (and hard) thing to admit.",
  "Glad you shared that. We'll handle this with care.",
  "We don't mean to pry. Your reading needs this.",
];

/** Loader sub-message rotation pool — every 4s during loader. */
export const LOADER_SUBMESSAGES: string[] = [
  "Hand-tuning your reading.",
  "This usually takes 12–18 seconds.",
  "We use the highest-fidelity model for this.",
  "Almost there.",
  "Drawing the contour line-art.",
  "Editorial-quality output — slower than fast, faster than studio.",
  "Your photo never leaves our servers unencrypted.",
];

/** Headline-insight fallbacks per reading (Path B per §7.5). */
export const HEADLINE_FALLBACKS: Record<string, string[]> = {
  "palm-reading": [
    "Your dominant line tells a story most palms don't.",
    "One of your mounts is more pronounced than 80% of palms we read.",
    "Your hand reads in a less-common configuration.",
    "Your fate line says something specific about timing.",
    "Three of your four major lines share a pattern.",
  ],
  "face-reading": [
    "Your face reads in the top 12% for clarity of features.",
    "One of your Twelve Palaces is unusually expressive.",
    "Your dominant Officer is more prominent than most.",
    "Your face shape sits in a Mian Xiang archetype that's less common.",
    "Two of your features echo each other strongly.",
  ],
  "beauty-report": [
    "Your overall score is in the upper third of photos we've analyzed.",
    "One of your six sub-scores is in the top 10%.",
    "Your bone structure reads more strongly than your other features.",
    "Your skin and smile sub-scores point in the same direction — and it's a strength.",
    "Your face reads better in this light than most in similar lighting.",
  ],
  "aura-reading": [
    "Your dominant aura is rare for someone who picked this color.",
    "Your seven layers don't follow the typical sequence.",
    "Your chakra map suggests one strong center and one quieter one.",
    "Your aura colors echo your chosen color — that's not coincidence.",
    "Your reading sits in a less-common configuration.",
  ],
  iridology: [
    "Your iris zones suggest a less-common wellness profile.",
    "One zone in your iris stands out.",
    "Your collarette is more defined than most.",
    "Your iris pattern reads in a configuration we don't see often.",
    "Your reading speaks to something specific about your energy.",
  ],
  handwriting: [
    "Your handwriting archetype fits under 8% of writers cleanly.",
    "Your slant and pressure tell a consistent story.",
    "Your signature character is more pronounced than your daily writing.",
    "Three of your traits all point to the same archetype.",
    "Your baseline trend is unusually steady.",
  ],
  "style-audit": [
    "Your archetype is one of the rarer four.",
    "Your palette undertone is more decisive than most.",
    "Your silhouette and palette agree — and that's a strength.",
    "Your closet ratio fits a specific style logic.",
    "Your archetype has clear dress codes that suit you.",
  ],
  "hairstyle-analysis": [
    "Three of the eight cuts read strongly on your face shape — and one is unexpected.",
    "Your face shape opens up cuts most people can't pull off.",
    "Your strongest fit is one most people don't try first.",
    "Two of the eight options are strong; the rest split.",
    "Your face geometry suits cuts in a specific style family.",
  ],
  "color-analysis": [
    "Your undertone reads cleaner than most — and three palettes really suit you.",
    "Your best palette is one most people don't guess for themselves.",
    "Your skin tone, hair, and eyes agree on undertone — that's an advantage.",
    "Two of the eight palettes light you up; six don't.",
    "Your undertone places you in a clear seasonal family.",
  ],
  "skincare-glow": [
    "One zone of your face is doing more work than the others — and we have a routine for it.",
    "Your T-zone and cheeks read differently — and it shapes your routine.",
    "Your texture suggests one specific category of treatment.",
    "Your under-eye reads softly — that's a less-common starting point.",
    "Your skin sits in a routine archetype we have a clear framework for.",
  ],
};

export function pickFallbackHeadline(toolId: string): string {
  const pool = HEADLINE_FALLBACKS[toolId];
  if (!pool || pool.length === 0) return "Your reading is ready.";
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickAffirmation(): string {
  return AFFIRMATIONS_POOL[Math.floor(Math.random() * AFFIRMATIONS_POOL.length)];
}
