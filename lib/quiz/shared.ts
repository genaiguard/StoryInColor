// Shared quiz questions used across multiple readings (§4.5).
// Identity A and Identity C are universal; Aspiration is per-reading-light.

import type { Question } from "./types";

/** Identity A — shared mood image-grid. Asked first across all readings. */
export const sharedIdentityA: Question = {
  id: "shared-mood",
  prompt: "Which of these feels most like you right now?",
  layout: "image-grid",
  options: [
    { id: "warm", label: "Warm", imageSrc: "/images/quiz/mood/warm.webp" },
    {
      id: "contemplative",
      label: "Contemplative",
      imageSrc: "/images/quiz/mood/contemplative.webp",
    },
    {
      id: "playful",
      label: "Playful",
      imageSrc: "/images/quiz/mood/playful.webp",
    },
    {
      id: "grounded",
      label: "Grounded",
      imageSrc: "/images/quiz/mood/grounded.webp",
    },
  ],
  affirmationAfter: "That tracks.",
};

/** Identity C — shared self-discovery emoji-grid. */
export const sharedIdentityC: Question = {
  id: "shared-self-discovery",
  prompt: "Where are you with self-discovery these days?",
  layout: "emoji-grid",
  options: [
    { id: "starting", label: "Just starting", emoji: "🌱" },
    { id: "longtime", label: "Always have been into it", emoji: "🌿" },
    { id: "deep", label: "Deep in it", emoji: "🌳" },
    { id: "not-sure", label: "Honestly not sure", emoji: "🤔" },
  ],
};
