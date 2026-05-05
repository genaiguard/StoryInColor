#!/usr/bin/env node
/**
 * Generate the four Identity-A mood-grid images for the quiz funnel.
 * Per QUIZ-PIVOT-SPEC.md §4.5 §13 (Appendix B).
 *
 * Output: public/images/quiz/mood/{warm,contemplative,playful,grounded}.webp
 *
 * Cost: 4 × ~$0.06 (medium-quality 1024×1024 generations) ≈ $0.25.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-quiz-mood-images.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "images", "quiz", "mood");

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("Set OPENAI_API_KEY in shell or .env. Aborting.");
  process.exit(1);
}

const MOODS = [
  {
    slug: "warm",
    label: "Warm",
    prompt: `An editorial portrait photograph capturing the feeling of "warm" —
a relaxed face in soft golden-hour light, eyes closed or gently
smiling, conveying openness and gentleness. Cream and amber tones,
hairline cinematic film grain, magazine-quality composition.
Square frame. No text, no graphics, no overlay. Subject only,
neutral simple background. Visual mood reference for a self-discovery quiz —
the photo represents the FEELING "warm", not a literal warm-temperature scene.`,
  },
  {
    slug: "contemplative",
    label: "Contemplative",
    prompt: `An editorial portrait photograph capturing the feeling of "contemplative" —
a thoughtful face turned slightly away, looking down or into the middle
distance with calm focus, holding a quiet pause. Cool blue-gray tones,
soft window light, magazine editorial composition. Square frame. No text,
no graphics, no overlay. Subject only, neutral simple background. Visual
mood reference for a self-discovery quiz.`,
  },
  {
    slug: "playful",
    label: "Playful",
    prompt: `An editorial portrait photograph capturing the feeling of "playful" —
a face with a small spontaneous smile, light in the eyes, the moment
right before a laugh, slight head tilt. Light pastel and cream tones,
bright but soft natural light, magazine editorial composition.
Square frame. No text, no graphics, no overlay. Subject only, neutral
simple background. Visual mood reference for a self-discovery quiz.`,
  },
  {
    slug: "grounded",
    label: "Grounded",
    prompt: `An editorial portrait photograph capturing the feeling of "grounded" —
a face with a steady direct gaze, calm and present, neither smiling
nor frowning, the posture of someone settled in themselves. Earthy
brown and ochre tones, soft directional light, magazine editorial
composition. Square frame. No text, no graphics, no overlay. Subject
only, neutral simple background. Visual mood reference for a
self-discovery quiz.`,
  },
];

async function generateMood(mood) {
  console.log(`\n[${mood.slug}] Generating…`);
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: mood.prompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
      moderation: "low",
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${txt}`);
  }
  const json = await resp.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No b64_json returned");
  const buf = Buffer.from(b64, "base64");
  const outPath = path.join(OUT_DIR, `${mood.slug}.webp`);
  await sharp(buf)
    .resize(800, 800, { fit: "cover" })
    .webp({ quality: 88 })
    .toFile(outPath);
  const stat = await fs.stat(outPath);
  console.log(`[${mood.slug}] Wrote ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const mood of MOODS) {
    try {
      await generateMood(mood);
    } catch (err) {
      console.error(`[${mood.slug}] Failed:`, err.message);
    }
  }
  console.log("\nDone.");
}

main();
