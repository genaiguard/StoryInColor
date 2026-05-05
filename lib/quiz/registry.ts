// Quiz registry — all reading-specific quiz configs. Per QUIZ-PIVOT-SPEC.md §5.
// Each entry parameterizes the standardized 8-screen flow (§4.1).
// Adding a new reading = adding one config object here.

import type { QuizConfig } from "./types";
import { sharedIdentityA, sharedIdentityC } from "./shared";

const COMMON_LOADER_DURATION_MS = 2400;

/** Helper: build a 5-step loader from labels (each step ~2.4s). */
function loader(labels: string[]) {
  return labels.map((label) => ({ label, durationMs: COMMON_LOADER_DURATION_MS }));
}

/* -------------------------------------------------------------------------- */
/* 5.1 Palm Reading                                                           */
/* -------------------------------------------------------------------------- */
const palmReadingQuiz: QuizConfig = {
  toolId: "palm-reading",
  slug: "palm-reading",
  hook: {
    id: "palm-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "relationship", label: "Something on my mind about a relationship", emoji: "💔" },
      { id: "career", label: "A career or direction question", emoji: "🧭" },
      { id: "curiosity", label: "Just curious", emoji: "🌀" },
      { id: "experienced", label: "I already read palms for myself", emoji: "🌙" },
    ],
    affirmationAfter: "Got it. We'll keep this in mind.",
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "palm-line-instinct",
    prompt: "Which line on your hand catches your eye first?",
    layout: "pill",
    options: [
      { id: "heart", label: "Heart line", emoji: "❤️" },
      { id: "head", label: "Head line", emoji: "🧠" },
      { id: "life", label: "Life line", emoji: "🌿" },
      { id: "fate", label: "Fate line", emoji: "✨" },
    ],
    affirmationAfter: "That's a thoughtful pick.",
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "palm-aspiration",
    prompt: "What would you most like the reading to clarify?",
    layout: "pill",
    options: [
      { id: "love", label: "Love and relationships", emoji: "❤️" },
      { id: "career", label: "Career direction", emoji: "🛤" },
      { id: "growth", label: "Personal growth", emoji: "🌱" },
      { id: "future", label: "What's coming next", emoji: "🔮" },
    ],
  },
  specific: {
    id: "palm-handedness",
    prompt: "How dominant is your dominant hand?",
    layout: "pill",
    options: [
      { id: "right", label: "Strongly right-handed", emoji: "✋" },
      { id: "left", label: "Strongly left-handed", emoji: "🤚" },
      { id: "mixed", label: "Mixed / use both", emoji: "🤲" },
      { id: "unsure", label: "Not sure", emoji: "🤷" },
    ],
    affirmationAfter: "Locked in. The reading will lean here.",
  },
  uploadHint:
    "Open your dominant hand, palm up, in good light. One photo.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading the major lines…",
    "Mapping the seven mounts…",
    "Cross-referencing classical palmistry…",
    "Composing your editorial spread…",
    "Almost done…",
  ]),
  reveal: {
    headlineInsight: "Your palm reads more strongly than 73% of the hands we analyze.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my full palm reading",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.2 Face Reading                                                           */
/* -------------------------------------------------------------------------- */
const faceReadingQuiz: QuizConfig = {
  toolId: "face-reading",
  slug: "face-reading",
  hook: {
    id: "face-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "self", label: "I want to understand myself better", emoji: "🪞" },
      { id: "direction", label: "I'm looking for direction", emoji: "🧭" },
      { id: "tradition", label: "Curious about the Mian Xiang tradition", emoji: "🌟" },
      { id: "saw", label: "I saw this somewhere and got curious", emoji: "🤔" },
    ],
    affirmationAfter: "Noted — this changes how we read your photo.",
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "face-compliment",
    prompt: "Which feature do people compliment you on most?",
    layout: "pill",
    options: [
      { id: "eyes", label: "Eyes", emoji: "👀" },
      { id: "smile", label: "Smile", emoji: "😊" },
      { id: "bones", label: "Cheekbones / bone structure", emoji: "🦴" },
      { id: "none", label: "Honestly, no one really comments", emoji: "🤷" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "face-aspiration",
    prompt: "Which life palace are you most curious about?",
    layout: "pill",
    options: [
      { id: "marriage", label: "Relationships and marriage", emoji: "❤️" },
      { id: "career", label: "Career and wealth", emoji: "💰" },
      { id: "home", label: "Home and family", emoji: "🏠" },
      { id: "future", label: "Future and travel", emoji: "🌅" },
    ],
  },
  specific: {
    id: "face-shape",
    prompt: "How would you describe your face shape, honestly?",
    layout: "pill",
    options: [
      { id: "round", label: "Round", emoji: "⭕" },
      { id: "square", label: "Square / strong jaw", emoji: "🟫" },
      { id: "heart", label: "Heart / oval", emoji: "💎" },
      { id: "unsure", label: "Not sure", emoji: "🤔" },
    ],
    affirmationAfter: "That answer puts you in a less-common group.",
  },
  uploadHint:
    "A front-facing selfie, soft daylight, hair off the forehead. Relaxed expression.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Mapping the Five Officers…",
    "Charting the Twelve Palaces…",
    "Reading the forehead and life palace…",
    "Composing your report card…",
    "Final touches…",
  ]),
  reveal: {
    headlineInsight: "Your face reads in the top 12% for clarity of features.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my Twelve Palaces report",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.3 Beauty Report                                                          */
/* -------------------------------------------------------------------------- */
const beautyReportQuiz: QuizConfig = {
  toolId: "beauty-report",
  slug: "beauty-report",
  hook: {
    id: "beauty-hook",
    prompt: "What brings you here?",
    subPrompt: "An honest beauty read isn't for everyone. We make it kind, not brutal.",
    layout: "pill",
    options: [
      { id: "score", label: "Curious where I score", emoji: "🪞" },
      { id: "tips", label: "Looking for grooming or styling tips", emoji: "💄" },
      { id: "photos", label: "Trying to look better in photos", emoji: "📸" },
      { id: "honest", label: "My friends won't tell me the truth", emoji: "🤝" },
    ],
    affirmationAfter: "Honest answer. We work better with those.",
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "beauty-photo-feel",
    prompt: "How do you usually feel after seeing yourself in photos?",
    layout: "pill",
    options: [
      { id: "good", label: "Pretty good", emoji: "😌" },
      { id: "mixed", label: "Mixed — depends on the photo", emoji: "🤔" },
      { id: "not-great", label: "Not great, usually", emoji: "😬" },
      { id: "avoid", label: "I avoid being in photos", emoji: "📵" },
    ],
    affirmationAfter:
      "Thank you for sharing. That's an important (and hard) thing to admit.",
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "beauty-aspiration",
    prompt: "What's the most useful thing this could give you?",
    layout: "pill",
    options: [
      { id: "honest-score", label: "An honest score", emoji: "📊" },
      { id: "improve", label: "Specific things I could improve", emoji: "✨" },
      { id: "strengths", label: "Strengths I should lean into", emoji: "🌟" },
      { id: "photo-tips", label: "How to photograph better", emoji: "📷" },
    ],
  },
  specific: {
    id: "beauty-feature-change",
    prompt: "What's the one feature you'd change if you could?",
    layout: "pill",
    options: [
      { id: "nose", label: "Nose", emoji: "👃" },
      { id: "eyes", label: "Eye area", emoji: "👁" },
      { id: "smile", label: "Smile / teeth", emoji: "😬" },
      { id: "jaw", label: "Jaw / bone structure", emoji: "🦴" },
      { id: "none", label: "Wouldn't change anything", emoji: "❌" },
    ],
    affirmationAfter: "Lock that in. The reading will lean here.",
  },
  uploadHint:
    "Front-facing selfie, soft daylight, no heavy filter or makeup. The flatter the lighting, the better.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading bone structure…",
    "Measuring symmetry…",
    "Analyzing eye area…",
    "Reading skin and smile…",
    "Compiling your sub-scores…",
    "Done.",
  ]),
  reveal: {
    headlineInsight:
      "Your overall score is in the upper third of the photos we've analyzed.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my full beauty report",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.4 Aura Reading                                                           */
/* -------------------------------------------------------------------------- */
const auraReadingQuiz: QuizConfig = {
  toolId: "aura-reading",
  slug: "aura-reading",
  hook: {
    id: "aura-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "colors", label: "Curious what colors I carry", emoji: "🌈" },
      { id: "energy", label: "Working on my energy or chakras", emoji: "🧘" },
      { id: "exploring", label: "Just exploring", emoji: "🌀" },
      { id: "experienced", label: "I've done aura readings before", emoji: "💫" },
    ],
    affirmationAfter: "Got it. We'll keep this in mind.",
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "aura-color-instinct",
    prompt: "Which color are you instinctively drawn to today?",
    subPrompt: "Trust the first one your eyes land on.",
    layout: "pill",
    options: [
      { id: "red", label: "Red", emoji: "🔴" },
      { id: "orange", label: "Orange", emoji: "🟠" },
      { id: "yellow", label: "Yellow", emoji: "🟡" },
      { id: "green", label: "Green", emoji: "🟢" },
      { id: "blue", label: "Blue", emoji: "🔵" },
      { id: "violet", label: "Violet", emoji: "🟣" },
    ],
    affirmationAfter: "That answer puts you in a less-common group.",
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "aura-aspiration",
    prompt: "What part of aura reading interests you most?",
    layout: "pill",
    options: [
      { id: "colors", label: "My dominant colors", emoji: "🎨" },
      { id: "layers", label: "The seven layers", emoji: "🌀" },
      { id: "chakra", label: "My chakra connection", emoji: "🕉" },
      { id: "blocks", label: "What's blocking my energy", emoji: "🪞" },
    ],
  },
  specific: {
    id: "aura-active-chakra",
    prompt: "What chakra would you guess feels most active for you right now?",
    subPrompt: "First instinct is fine — there's no wrong answer.",
    layout: "pill",
    options: [
      { id: "root", label: "Root", emoji: "🔴" },
      { id: "sacral", label: "Sacral", emoji: "🟠" },
      { id: "solar-plexus", label: "Solar plexus", emoji: "🟡" },
      { id: "heart", label: "Heart", emoji: "💚" },
      { id: "throat", label: "Throat", emoji: "💙" },
      { id: "third-eye", label: "Third eye", emoji: "💜" },
      { id: "crown", label: "Crown", emoji: "🤍" },
    ],
    affirmationAfter: "Locked in. The reading will lean here.",
  },
  uploadHint:
    "A relaxed selfie against a plain light background. Soft even light gives the cleanest read.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Sensing your dominant frequency…",
    "Reading the seven auric layers…",
    "Mapping your chakra connections…",
    "Composing your halo…",
    "Almost there…",
  ]),
  reveal: {
    headlineInsight: "Your reading sits in a less-common configuration.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my aura reading",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.5 Iridology                                                              */
/* -------------------------------------------------------------------------- */
const iridologyQuiz: QuizConfig = {
  toolId: "iridology",
  slug: "iridology",
  hook: {
    id: "iridology-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "wellness", label: "I'm into holistic wellness", emoji: "🧘" },
      { id: "eyes-show", label: "I've always wondered what eyes can show", emoji: "👁" },
      { id: "self", label: "Looking for self-knowledge", emoji: "🧬" },
      { id: "exploring", label: "Just exploring", emoji: "🔬" },
    ],
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "iris-eye-color",
    prompt: "What's your eye color?",
    layout: "pill",
    options: [
      { id: "brown", label: "Brown", emoji: "🟫" },
      { id: "green", label: "Green", emoji: "💚" },
      { id: "blue", label: "Blue", emoji: "💙" },
      { id: "hazel", label: "Hazel", emoji: "🟤" },
      { id: "gray", label: "Gray", emoji: "⚪" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "iridology-aspiration",
    prompt: "What would be most valuable to learn?",
    layout: "pill",
    options: [
      { id: "wellness-tendencies", label: "Wellness tendencies", emoji: "🌿" },
      { id: "personality", label: "Personality traits", emoji: "🧠" },
      { id: "energy-zones", label: "Energy zones", emoji: "⚡" },
      { id: "balance", label: "Hydration and balance", emoji: "💧" },
    ],
  },
  specific: {
    id: "iridology-energy-recall",
    prompt: "When did you last feel really energized?",
    layout: "pill",
    options: [
      { id: "today", label: "Today", emoji: "☀️" },
      { id: "this-week", label: "This week", emoji: "📅" },
      { id: "this-month", label: "This month", emoji: "🗓" },
      { id: "cant-recall", label: "Honestly, can't remember", emoji: "😴" },
    ],
    affirmationAfter:
      "Glad you shared that. We'll handle this with care.",
  },
  uploadHint:
    "A sharp close-up of one eye, well-lit. Phone macro mode in daylight works best.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Mapping iris zones…",
    "Reading the autonomic nerve wreath…",
    "Identifying lacunae and crypts…",
    "Composing your wellness card…",
    "Done.",
  ]),
  reveal: {
    headlineInsight: "Your iris pattern reads in a less-common configuration.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my iris reading",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.6 Handwriting                                                            */
/* -------------------------------------------------------------------------- */
const handwritingQuiz: QuizConfig = {
  toolId: "handwriting",
  slug: "handwriting",
  hook: {
    id: "handwriting-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "curious", label: "Curious what my handwriting says about me", emoji: "✍️" },
      { id: "self", label: "Self-knowledge", emoji: "🪞" },
      { id: "gift", label: "For a friend or partner", emoji: "🎁" },
      { id: "systems", label: "I love personality systems", emoji: "🔍" },
    ],
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "handwriting-style",
    prompt: "How would you describe your handwriting?",
    layout: "pill",
    options: [
      { id: "neat", label: "Neat and consistent", emoji: "✏️" },
      { id: "fast", label: "Fast and a little messy", emoji: "🌀" },
      { id: "decorative", label: "Decorative / expressive", emoji: "🎨" },
      { id: "illegible", label: "Honestly, illegible even to me", emoji: "🤷" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "handwriting-aspiration",
    prompt: "What part of the read interests you most?",
    layout: "pill",
    options: [
      { id: "archetype", label: "Personality archetype", emoji: "🧠" },
      { id: "emotions", label: "Emotional patterns", emoji: "💭" },
      { id: "decisions", label: "Decision-making style", emoji: "🎯" },
      { id: "signature", label: "What my signature says", emoji: "✒️" },
    ],
  },
  specific: {
    id: "handwriting-handedness",
    prompt: "Right- or left-handed?",
    layout: "pill",
    options: [
      { id: "right", label: "Right", emoji: "✋" },
      { id: "left", label: "Left", emoji: "🤚" },
      { id: "either", label: "Either / both", emoji: "🤲" },
    ],
    affirmationAfter: "Recorded. Carrying forward.",
  },
  uploadHint:
    "A photo of a handwritten sample on plain paper. A few sentences plus your signature is ideal.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading the slant and baseline…",
    "Measuring pressure…",
    "Analyzing your signature…",
    "Matching to archetypes…",
    "Composing your card…",
  ]),
  reveal: {
    headlineInsight:
      "Your handwriting archetype fits under 8% of writers cleanly.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my handwriting read",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.7 Style Audit                                                            */
/* -------------------------------------------------------------------------- */
const styleAuditQuiz: QuizConfig = {
  toolId: "style-audit",
  slug: "style-audit",
  hook: {
    id: "style-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "refining", label: "I want to refine how I dress", emoji: "🛍" },
      { id: "archetype", label: "Curious what my style archetype is", emoji: "🪞" },
      { id: "nail", label: "I want to nail my personal style", emoji: "🎯" },
      { id: "profile", label: "For my dating or social profile photos", emoji: "📸" },
    ],
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "style-archetype-instinct",
    prompt: "Which Vogue cover archetype feels most like you?",
    layout: "pill",
    options: [
      { id: "classic", label: "Classic", emoji: "🤍" },
      { id: "romantic", label: "Romantic", emoji: "🌸" },
      { id: "edgy", label: "Edgy", emoji: "🖤" },
      { id: "minimalist", label: "Minimalist", emoji: "⚪" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "style-aspiration",
    prompt: "What would be most useful?",
    layout: "pill",
    options: [
      { id: "archetype-label", label: "My style archetype", emoji: "🏷" },
      { id: "palette", label: "My best palette", emoji: "🎨" },
      { id: "outfit-feedback", label: "Specific outfit feedback", emoji: "👗" },
      { id: "wardrobe", label: "Wardrobe direction", emoji: "🛒" },
    ],
  },
  specific: {
    id: "style-closet-ratio",
    prompt: "What's your closet ratio right now?",
    layout: "pill",
    options: [
      { id: "neutral", label: "Mostly black/neutral", emoji: "⚫" },
      { id: "color", label: "Mostly color", emoji: "🌈" },
      { id: "basics", label: "Mostly basics", emoji: "👕" },
      { id: "statement", label: "Mostly statement pieces", emoji: "🎭" },
    ],
    affirmationAfter: "Held. Your reading will reflect this.",
  },
  uploadHint:
    "A full-body photo of your outfit, neutral background. Mirror selfies work fine.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading silhouette and proportion…",
    "Analyzing palette and fit…",
    "Matching your archetype…",
    "Composing your editorial…",
  ]),
  reveal: {
    headlineInsight: "Your archetype is one of the rarer four.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my style audit",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.8 Hairstyle Analysis                                                     */
/* -------------------------------------------------------------------------- */
const hairstyleAnalysisQuiz: QuizConfig = {
  toolId: "hairstyle-analysis",
  slug: "hairstyle-analysis",
  hook: {
    id: "hairstyle-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "big-change", label: "I'm considering a big change", emoji: "✂️" },
      { id: "rut", label: "I'm stuck in a rut", emoji: "🤔" },
      { id: "event", label: "I have a big event coming up", emoji: "💍" },
      { id: "curious", label: "Curious what would suit me", emoji: "🪞" },
    ],
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "hair-current-length",
    prompt: "What's your current length?",
    layout: "pill",
    options: [
      { id: "pixie", label: "Pixie / very short", emoji: "✂️" },
      { id: "bob", label: "Bob / lob", emoji: "💇" },
      { id: "shoulder", label: "Shoulder-length", emoji: "👩" },
      { id: "long", label: "Long", emoji: "👱‍♀️" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "hair-aspiration",
    prompt: "What do you most want to see?",
    layout: "pill",
    options: [
      { id: "cuts", label: "Cuts that suit my face", emoji: "✂️" },
      { id: "fringe", label: "Bangs / fringe options", emoji: "🎀" },
      { id: "color", label: "Color ideas alongside cut", emoji: "🎨" },
      { id: "untried", label: "A look I haven't tried", emoji: "🤩" },
    ],
  },
  specific: {
    id: "hair-texture",
    prompt: "What's your hair texture?",
    layout: "pill",
    options: [
      { id: "straight", label: "Straight", emoji: "🌾" },
      { id: "wavy", label: "Wavy", emoji: "🌊" },
      { id: "curly", label: "Curly", emoji: "🌀" },
      { id: "coily", label: "Coily / kinky", emoji: "⛓" },
    ],
    affirmationAfter: "Lock that in. The reading will lean here.",
  },
  uploadHint:
    "Front-facing selfie, hair in its natural fall (or pulled back if it's curly). Soft daylight.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading your face shape…",
    "Mapping your hairline and forehead…",
    "Selecting cuts that suit your geometry…",
    "Rendering 8 styles on you…",
    "Composing your editorial spread…",
  ]),
  reveal: {
    headlineInsight:
      "Three of the eight cuts read strongly on your face shape — and one is unexpected.",
    blurStrength: 45, // grid output, needs heavier blur
    unlockCtaLabel: "See all 8 cuts on me",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.9 Color Analysis                                                         */
/* -------------------------------------------------------------------------- */
const colorAnalysisQuiz: QuizConfig = {
  toolId: "color-analysis",
  slug: "color-analysis",
  hook: {
    id: "color-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "wardrobe", label: "I want a wardrobe that actually works on me", emoji: "👗" },
      { id: "undertone", label: "I want to know my undertone", emoji: "💄" },
      { id: "consult-alt", label: "I'm considering a House of Colour consult", emoji: "🎁" },
      { id: "curious", label: "Just curious", emoji: "🪞" },
    ],
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "color-instinct",
    prompt: "Which color makes you feel most like yourself?",
    layout: "pill",
    options: [
      { id: "warm-red", label: "Warm red", emoji: "🔴" },
      { id: "cool-blue", label: "Cool blue", emoji: "🔵" },
      { id: "earth", label: "Earth / camel", emoji: "🟫" },
      { id: "jewel", label: "Jewel tone", emoji: "💎" },
      { id: "pastel", label: "Pastel", emoji: "🌸" },
      { id: "black", label: "Black", emoji: "⚫" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "color-aspiration",
    prompt: "What would help most?",
    layout: "pill",
    options: [
      { id: "best-palette", label: "My best palette", emoji: "🎨" },
      { id: "undertone", label: "Warm vs cool undertone", emoji: "🌡" },
      { id: "avoid", label: "Colors to avoid", emoji: "👚" },
      { id: "jewel-or-pastel", label: "Jewel tone or pastel?", emoji: "💎" },
    ],
  },
  specific: {
    id: "hair-color",
    prompt: "What's your hair color?",
    layout: "pill",
    options: [
      { id: "brown", label: "Brown", emoji: "🟫" },
      { id: "blonde", label: "Blonde", emoji: "🟡" },
      { id: "red", label: "Red", emoji: "🔴" },
      { id: "black", label: "Black", emoji: "⚫" },
      { id: "gray", label: "Gray / silver", emoji: "⚪" },
    ],
  },
  uploadHint:
    "Front-facing selfie in natural daylight. No heavy filters — they shift skin tone. Hair pulled back is ideal.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading your undertone…",
    "Comparing you in 8 palettes…",
    "Identifying which colors light you up…",
    "Composing your palette card…",
  ]),
  reveal: {
    headlineInsight:
      "Your undertone reads cleaner than most — and three palettes really light you up.",
    blurStrength: 45, // grid output
    unlockCtaLabel: "See all 8 palettes on me",
  },
};

/* -------------------------------------------------------------------------- */
/* 5.10 Skincare Glow                                                         */
/* -------------------------------------------------------------------------- */
const skincareGlowQuiz: QuizConfig = {
  toolId: "skincare-glow",
  slug: "skincare-glow",
  hook: {
    id: "skincare-hook",
    prompt: "What brought you here?",
    layout: "pill",
    options: [
      { id: "routine", label: "I want a routine that actually works", emoji: "✨" },
      { id: "zones", label: "Curious how my skin zones read", emoji: "🪞" },
      { id: "glow", label: "Glow and hydration are my goal", emoji: "💧" },
      { id: "products", label: "Help me pick the right products", emoji: "🛒" },
    ],
  },
  identityA: sharedIdentityA,
  identityB: {
    id: "skin-type",
    prompt: "What's your skin type?",
    layout: "pill",
    options: [
      { id: "dry", label: "Dry", emoji: "💧" },
      { id: "oily", label: "Oily", emoji: "💦" },
      { id: "combination", label: "Combination", emoji: "⚖️" },
      { id: "sensitive", label: "Sensitive", emoji: "🌷" },
    ],
  },
  identityC: sharedIdentityC,
  aspiration: {
    id: "skincare-aspiration",
    prompt: "What would help most?",
    layout: "pill",
    options: [
      { id: "am-routine", label: "AM routine", emoji: "☀️" },
      { id: "pm-routine", label: "PM routine", emoji: "🌙" },
      { id: "zones", label: "Targeting specific zones", emoji: "🎯" },
      { id: "products", label: "Product categories to focus on", emoji: "🛒" },
    ],
  },
  specific: {
    id: "skincare-concern",
    prompt: "What's your top concern right now?",
    layout: "pill",
    options: [
      { id: "breakouts", label: "Breakouts", emoji: "🔴" },
      { id: "dullness", label: "Dullness", emoji: "🌑" },
      { id: "texture", label: "Texture", emoji: "〰️" },
      { id: "under-eye", label: "Under-eye", emoji: "😴" },
      { id: "tone", label: "Tone / pigmentation", emoji: "🟫" },
    ],
    affirmationAfter:
      "Glad you shared that. We'll handle this with care.",
  },
  uploadHint:
    "Bare-face selfie in soft daylight. No filter, no makeup. Hair pulled back is ideal.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",
  loaderSteps: loader([
    "Reading your T-zone…",
    "Mapping cheeks and under-eye…",
    "Reading texture and glow…",
    "Composing your routine card…",
  ]),
  reveal: {
    headlineInsight:
      "One zone of your face is doing more work than the others — and we have a routine for it.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my skincare card",
  },
};

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */

export const QUIZ_REGISTRY: Record<string, QuizConfig> = {
  "palm-reading": palmReadingQuiz,
  "face-reading": faceReadingQuiz,
  "beauty-report": beautyReportQuiz,
  "aura-reading": auraReadingQuiz,
  iridology: iridologyQuiz,
  handwriting: handwritingQuiz,
  "style-audit": styleAuditQuiz,
  "hairstyle-analysis": hairstyleAnalysisQuiz,
  "color-analysis": colorAnalysisQuiz,
  "skincare-glow": skincareGlowQuiz,
};

export function getQuizConfig(slug: string): QuizConfig | undefined {
  return QUIZ_REGISTRY[slug];
}

/** Slugs the quiz funnel supports. Coloring page deliberately excluded (§5.11). */
export const QUIZ_SLUGS = Object.keys(QUIZ_REGISTRY);
