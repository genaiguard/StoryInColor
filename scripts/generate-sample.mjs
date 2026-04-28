#!/usr/bin/env node
/**
 * One-shot sample-image generator for the landing page hero.
 *
 * Generates a base editorial portrait via OpenAI's gpt-image-1 (text-only),
 * saves it to /tmp/woman-portrait.png, then runs a chosen reading prompt
 * on top of it via the /v1/images/edits endpoint and writes the final
 * output (as WebP) into public/images/tools/<slug>.webp — replacing the
 * placeholder cover.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-sample.mjs
 *   OPENAI_API_KEY=sk-... node scripts/generate-sample.mjs face-reading aura-reading
 *
 * Requirements:
 *   - Node 20+ (uses built-in fetch + FormData).
 *   - Sharp from the functions tree (we import it directly because the
 *     root package.json doesn't ship sharp). Run `cd functions && npm i`
 *     once if functions/node_modules doesn't exist yet.
 *
 * No-arg run defaults to face-reading. The base portrait is reused across
 * any face-based readings, so passing multiple slugs in one run only
 * generates one portrait and amortises the cost.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "images", "tools");
const PORTRAIT_PATH = "/tmp/woman-portrait.png";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("\nError: OPENAI_API_KEY env var is missing.\n");
  console.error("Run: OPENAI_API_KEY=sk-... node scripts/generate-sample.mjs\n");
  process.exit(1);
}

// Sharp lives in the functions package. Try to import from there.
let sharp;
try {
  const sharpUrl = path.join(REPO_ROOT, "functions", "node_modules", "sharp", "lib", "index.js");
  sharp = (await import(sharpUrl)).default;
} catch (err) {
  console.error("Could not load sharp from functions/node_modules.");
  console.error("Run `cd functions && npm install` and try again.");
  console.error("Original error:", err.message);
  process.exit(1);
}

const PORTRAIT_PROMPT =
  "Editorial fashion-magazine portrait of a mid-40s woman, natural makeup, " +
  "soft directional daylight, neutral cream paper backdrop, looking three-" +
  "quarters away from camera, calm and approachable expression, sharp focus, " +
  "shallow depth of field, high resolution, subtle film grain, no text or " +
  "logos in frame.";

// Reading prompts mirrored from functions/src/tool-prompts.ts. Edit there
// first when you change wording — these are samples ONLY, not production.
const READINGS = {
  "face-reading": {
    prompt:
      "Based on my face, perform a Mian Xiang (Chinese physiognomy) reading using the Five Officers and the Twelve Palaces — life, wealth, siblings, marriage, children, health, travel, friends, career, property, fortune, and parents — mapped across the forehead, brows, eyes, nose, cheeks, mouth, and chin zones. Compose it as a clean, minimal editorial chart with thin lines, soft rounded cards per palace, refined serif-and-sans typography, and an expensive, gallery-quality feel. Include a small black-on-white contour line-art portrait of the face with the twelve palace zones gently outlined as a decorative element. Frame everything as a cultural-entertainment reflection, not a personality verdict or destiny claim. Do your best.",
    size: "1024x1536",
  },
  "aura-reading": {
    // Aura uses /v1/images/generations in production (text-only) but for the
    // landing-page sample we run /v1/images/edits so the rendered face
    // matches the same person across hero tiles.
    prompt:
      "Intuit an aura reading for the subject in this photo, describing the dominant aura colors (red, orange, yellow, green, blue, indigo, violet), the seven auric layers, and the seven main chakras. Render it as a clean, minimal editorial spread with thin concentric rings, generous whitespace, rounded cards explaining each color and layer, a soft watercolor halo overlaid behind a stylized portrait of the subject, refined serif-and-sans typography, and an expensive ethereal magazine feel. Add a small black-on-white contour line-art silhouette of the head and shoulders as a decorative anchor. This is a reflective entertainment piece, not a spiritual diagnosis. Do your best.",
    size: "1024x1536",
  },
  "skincare-glow": {
    prompt:
      "Based on my selfie, give a cosmetic skincare-glow reflection mapping the T-zone, cheeks, under-eye, and jawline, with gentle observations on apparent texture, tone, hydration, and luminosity, plus a suggested AM and PM routine framework (cleanse, treat, moisturize, SPF in AM; cleanse, treat, hydrate, occlusive in PM). Compose it as a clean, minimal editorial beauty card with thin lines, rounded panels per zone and routine step, soft neutral tones, and a luxe glossy-magazine feel. Add a small black-on-white contour line-art of the face with the skincare zones lightly outlined as a decorative element. This is cosmetic guidance for entertainment only — no medical claims, no diagnosis, no treatment promises. Do your best.",
    size: "1024x1536",
  },
};

async function generatePortrait() {
  console.log("→ Generating base portrait (text-only) ...");
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: PORTRAIT_PROMPT,
      n: 1,
      size: "1024x1024",
      quality: "high",
      output_format: "png",
      moderation: "low",
    }),
  });
  if (!resp.ok) {
    throw new Error(`generations failed: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("generations returned no b64_json");
  const buf = Buffer.from(b64, "base64");
  await fs.writeFile(PORTRAIT_PATH, buf);
  console.log(`  saved ${PORTRAIT_PATH}`);
  return buf;
}

async function runReading(slug, config, portraitBuf) {
  console.log(`→ Running ${slug} ...`);
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", config.prompt);
  form.append("n", "1");
  form.append("size", config.size);
  form.append("quality", "high");
  form.append("input_fidelity", "high");
  form.append("output_format", "png");
  form.append("moderation", "low");
  form.append(
    "image",
    new Blob([portraitBuf], { type: "image/png" }),
    "portrait.png",
  );

  const resp = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`edits failed for ${slug}: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`edits returned no b64_json for ${slug}`);
  const pngBuf = Buffer.from(b64, "base64");

  // Convert PNG → WebP via sharp so the asset matches the .webp filename
  // the registry's coverImage already references.
  const webpBuf = await sharp(pngBuf).webp({ quality: 88 }).toBuffer();
  const outPath = path.join(OUT_DIR, `${slug}.webp`);
  await fs.writeFile(outPath, webpBuf);
  console.log(`  saved ${path.relative(REPO_ROOT, outPath)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const slugs = args.length > 0 ? args : ["face-reading"];
  for (const slug of slugs) {
    if (!READINGS[slug]) {
      console.error(`Unknown reading slug: ${slug}`);
      console.error(`Available: ${Object.keys(READINGS).join(", ")}`);
      process.exit(1);
    }
  }

  const portrait = await generatePortrait();
  for (const slug of slugs) {
    await runReading(slug, READINGS[slug], portrait);
  }

  console.log("\nDone. Commit the new .webp files in public/images/tools/.");
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
