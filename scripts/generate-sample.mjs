#!/usr/bin/env node
/**
 * Local marketing-image generator for landing pages and reading pages.
 *
 * This is intentionally a one-off local script. Do not run it from GitHub
 * Actions or during the deploy build; generated images should be committed.
 *
 * For each reading, this script:
 *   1. Generates an appropriate INPUT photo via /v1/images/generations
 *      (the input matches what a real user would upload — a palm photo for
 *       palm reading, a plate photo for plate analysis, etc.).
 *   2. Caches inputs by `inputType` so face-based readings share a portrait
 *      and we don't pay for duplicate input generations.
 *   3. Feeds the input through the production reading prompt via
 *      /v1/images/edits or /v1/images/generations with the same parameters
 *      used in production (input_fidelity=high, moderation=low, etc.).
 *   4. Converts the PNG output to WebP via sharp and writes it to:
 *      - public/images/tools/<slug>.webp
 *      - public/images/tools/<slug>-sample.webp
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-sample.mjs palm-reading
 *   OPENAI_API_KEY=sk-... node scripts/generate-sample.mjs --all
 *   OPENAI_IMAGE_MODEL=gpt-image-2-2026-04-21 node scripts/generate-sample.mjs palm-reading
 *   node scripts/generate-sample.mjs palm-reading
 *
 * If OPENAI_API_KEY is not in the shell, the script also checks .env.local,
 * .env, functions/.env.local, and functions/.env.
 *
 * Cost: roughly $0.40-$0.50 per reading (one input + one output at high
 * quality). All 11 ≈ $5. Re-run after registry changes.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "images", "tools");
const CACHE_DIR = path.join(REPO_ROOT, ".cache", "generate-sample");
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

async function readApiKeyFromEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("OPENAI_API_KEY="));
    if (!line) return "";
    return line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}

async function getApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  const envFiles = [
    ".env.local",
    ".env",
    path.join("functions", ".env.local"),
    path.join("functions", ".env"),
  ];
  for (const envFile of envFiles) {
    const key = await readApiKeyFromEnvFile(path.join(REPO_ROOT, envFile));
    if (key) return key;
  }
  return "";
}

const apiKey = await getApiKey();
if (!apiKey) {
  console.error("\nOPENAI_API_KEY env var is missing.");
  console.error("Run: OPENAI_API_KEY=sk-... node scripts/generate-sample.mjs palm-reading\n");
  process.exit(1);
}

let sharp;
try {
  const sharpUrl = path.join(
    REPO_ROOT,
    "functions",
    "node_modules",
    "sharp",
    "lib",
    "index.js",
  );
  sharp = (await import(sharpUrl)).default;
} catch (err) {
  console.error("Could not load sharp from functions/node_modules.");
  console.error("Run `cd functions && npm install` and try again.");
  console.error("Original error:", err.message);
  process.exit(1);
}

// --- Inputs (the photos a real user would upload) ---------------------------

const INPUT_PROMPTS = {
  portrait:
    "Editorial fashion-magazine portrait of a mid-40s woman, natural makeup, soft directional daylight, neutral cream paper backdrop, looking three-quarters away from the camera, calm and approachable expression, sharp focus on the face, shallow depth of field, high resolution, no text or logos in frame.",
  "blonde-portrait":
    "Editorial fashion-magazine portrait of a mid-40s blonde woman with natural shoulder-length hair, soft daylight from the side window, fresh natural makeup with peachy lip color, neutral cream paper backdrop, front-facing selfie framing from the chest up, relaxed warm half-smile, natural skin texture and subtle freckles visible, sharp focus on the face, fashion-magazine quality, no text or logos in frame.",
  palm:
    "Photograph of an open right palm of an adult, fingers slightly spread, palm facing the camera, taken straight-on under soft natural light against a neutral cream backdrop, sharp focus on the palm lines, all major lines (heart, head, life, fate) clearly visible, fashion-magazine quality, no jewelry, no text or logos in frame.",
  iris:
    "Extreme close-up macro photograph of a single human eye, iris and pupil filling the frame, hazel-green iris with clearly visible texture, fibers and crypts, soft natural light, eyelashes softly out of focus, no makeup, magazine-quality detail, no text or logos in frame.",
  handwriting:
    "Top-down photograph of a handwritten paragraph in elegant cursive on cream paper, fountain pen with dark ink, slight slant, varied line pressure, soft natural daylight from the side, magazine-quality, no text legible enough to read meaning, just the visual of the handwriting.",
  outfit:
    "Editorial full-body fashion photograph of a mid-30s woman, standing relaxed against a neutral cream studio backdrop, wearing a cream cashmere turtleneck sweater, tailored chocolate-brown wool trousers, leather loafers, gold hoop earrings, soft daylight from the side, magazine-quality, no text or logos in frame.",
  plate:
    "Top-down photograph of a beautifully plated lunch on a stoneware plate set on a light wood table — grilled salmon fillet, roasted heirloom carrots, herb-flecked quinoa, half a lemon, microgreens — soft natural daylight, fashion-food-magazine quality, no text or logos in frame.",
  plant:
    "Editorial photograph of a single thriving monstera deliciosa houseplant in a hand-thrown terracotta pot, set on a light wood floor against a neutral cream wall, soft daylight from a window on the left, magazine lifestyle quality, no text or logos in frame.",
  room:
    "Editorial wide-shot photograph of a stylish living room corner — mid-century modern walnut credenza, a single art print on the wall, a low ceramic vase with eucalyptus, a curated stack of large hardcover books, soft natural light pouring in from the right, neutral and warm palette, shelter-magazine quality, no text or logos in frame.",
};

// --- Readings (the production prompts, mirrored from tool-prompts.ts) -------

const READINGS = {
  "coloring-book": {
    inputType: "portrait",
    prompt:
      "Convert this photo into a clean black-and-white line illustration suitable for a printable coloring page. If there are faces or figures, maintain the original features and essence, but subtly enhance them to appear sweeter, softer, and more charming—like a gently idealized animated style. Use thin, elegant lines with no shading or poche-style hatching. Simplify background details if needed, but preserve the overall mood and composition. The final image should feel graceful, warm, and beautiful, with a soft and uplifting tone.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "medium",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "palm-reading": {
    inputType: "palm",
    prompt:
      "Based on my hand, perform a complete palmistry reading covering the heart line, head line, life line, and fate line, plus the major mounts (Venus, Jupiter, Saturn, Apollo, Mercury, Luna, Mars) and overall hand shape (earth, air, fire, water). Lay it out as a clean, minimal editorial guide with thin hairlines, generous whitespace, and rounded cards labeling each line and mount, in a premium black-on-cream palette that feels expensive and magazine-like. Embed a small black-on-white contour line-art tracing the palm's main lines as a decorative artwork beside the cards. Frame the reading as a playful entertainment guide, not a literal prediction. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  "face-reading": {
    inputType: "portrait",
    prompt:
      "Based on my face, perform a Mian Xiang (Chinese physiognomy) reading using the Five Officers and the Twelve Palaces — life, wealth, siblings, marriage, children, health, travel, friends, career, property, fortune, and parents — mapped across the forehead, brows, eyes, nose, cheeks, mouth, and chin zones. Compose it as a clean, minimal editorial chart with thin lines, soft rounded cards per palace, refined serif-and-sans typography, and an expensive, gallery-quality feel. Include a small black-on-white contour line-art portrait of the face with the twelve palace zones gently outlined as a decorative element. Frame everything as a cultural-entertainment reflection, not a personality verdict or destiny claim. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "beauty-report": {
    // Uses its own dedicated input — the marketing sample needs a different
    // person from the face-reading "portrait" cache so the two reading
    // pages don't show the same model.
    inputType: "blonde-portrait",
    prompt:
      "Based on my selfie, create a clean, minimal, high-end Facial Beauty Report. Render it as a single black-on-white editorial spread titled 'FACIAL BEAUTY REPORT' with a subtitle 'Single-photo visual assessment' and a small italic note that lighting, flash, expression, and lens distortion can affect precision. Use thin hairlines, generous whitespace, rounded cards, and refined serif-and-sans typography for a luxury-magazine feel. Lay it out with the original photo on the upper left and a small black-on-white contour line drawing of the face below it. To the right, lead with an Overall Attractiveness card showing a single bold score out of 10 and a one-sentence honest summary. Below that, six smaller score cards in a 2-column grid — Symmetry, Proportions, Bone Structure, Skin Quality, Eye Area, and Smile / Dental — each with its own score out of 10 and a short, honest, two-sentence observation. End with three side-by-side panels — Strengths (4-5 bullets with a star icon), Areas for Improvement (4-5 bullets with an arrow icon), and Actionable Grooming / Style Recommendations (5-7 bullets with a comb icon, covering hair, facial hair or makeup, brows, skin, eye area, smile, and photography tips). Keep the tone honest, data-driven, and visually refined — never overly flattering, never unkind. For entertainment only. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  "aura-reading": {
    inputType: null,
    prompt:
      "Intuit an aura reading for a contemplative subject, describing the dominant aura colors (red, orange, yellow, green, blue, indigo, violet), the seven auric layers (etheric, emotional, mental, astral, etheric template, celestial, causal), and how they relate to the seven main chakras (root, sacral, solar plexus, heart, throat, third eye, crown). Render it as a clean, minimal editorial spread with thin concentric rings, generous whitespace, rounded cards explaining each color and layer, a soft watercolor halo overlaid behind a stylized silhouette of the subject, refined serif-and-sans typography, and an expensive ethereal magazine feel. Add a small black-on-white contour line-art silhouette of the head and shoulders as a decorative anchor. This is a reflective entertainment piece, not a spiritual diagnosis. Do your best.",
    endpoint: "generations",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
  iridology: {
    inputType: "iris",
    prompt:
      "Based on my eye, create an iridology-style wellness reflection mapping the iris zones — pupillary zone, collarette (autonomic nerve wreath), ciliary zone, and outer rim — and noting visible markings such as lacunae, crypts, and radii, organized around a classic iris chart. Lay it out as a clean, minimal editorial infographic with thin lines, rounded cards for each zone, a refined neutral palette, and a premium clinical-but-elegant feel. Include a small black-on-white contour line-art of the iris and pupillary frill as a decorative emblem. This is a wellness reflection for entertainment only, not a medical diagnosis or health claim — keep all language gentle, suggestive, and lifestyle-oriented. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  handwriting: {
    inputType: "handwriting",
    prompt:
      "Based on my handwriting sample, perform a graphology-style personality sketch analyzing slant (left, vertical, right), baseline trend (rising, straight, falling, wavy), pressure (light, medium, heavy), letter size, spacing, connectivity, zones (upper, middle, lower), and signature character. Present it as a clean, minimal editorial card set with thin lines, rounded panels per trait, elegant typography, and an expensive stationery-magazine feel. Add a small black-on-white contour line-art of a fountain-pen stroke or a traced signature flourish as a decorative element. Frame the result as a playful personality reflection for entertainment, not a clinical or deterministic verdict. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "contrast",
  },
  "style-audit": {
    inputType: "outfit",
    prompt:
      "Based on my outfit photo, perform an editorial style audit in a Vogue/GQ tone covering silhouette, proportion, fit, layering, color palette, fabric and texture, accessories, and the closest style archetype (classic, minimalist, romantic, dramatic, bohemian, edgy, or eclectic) with a suggested dress-code register. Lay it out as a clean, minimal fashion-magazine spread with thin lines, rounded cards per category, swatch chips for the palette, and a refined, expensive editorial feel. Include a small black-on-white contour line-art croquis of the outfit silhouette as a decorative figure. Frame everything as a style suggestion only, never a judgment of the person. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "skincare-glow": {
    inputType: "portrait",
    prompt:
      "Based on my selfie, give a cosmetic skincare-glow reflection mapping the T-zone, cheeks, under-eye, and jawline, with gentle observations on apparent texture, tone, hydration, and luminosity, plus a suggested AM and PM routine framework (cleanse, treat, moisturize, SPF in AM; cleanse, treat, hydrate, occlusive in PM). Compose it as a clean, minimal editorial beauty card with thin lines, rounded panels per zone and routine step, soft neutral tones, and a luxe glossy-magazine feel. Add a small black-on-white contour line-art of the face with the skincare zones lightly outlined as a decorative element. This is cosmetic guidance for entertainment only — no medical claims, no diagnosis, no treatment promises. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  "plate-analysis": {
    inputType: "plate",
    prompt:
      "Based on my plate photo, give a dietitian-style infographic breakdown estimating the macro split (protein, carbohydrate, fat), portion balance, fiber and produce coverage, plating composition, and color theory of the food. Lay it out as a clean, minimal editorial nutrition card with thin lines, rounded panels per macro and observation, a small donut chart for the macro ratio, and a refined cookbook-magazine feel that looks expensive. Include a small black-on-white contour line-art of the plate from above as a decorative emblem. Frame it as general wellness reflection and balanced-eating inspiration, not medical or prescriptive nutrition advice. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1024",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "exif-rotate",
  },
  "plant-care": {
    inputType: "plant",
    prompt:
      "Based on my plant photo, give a plant-ID-style care card identifying likely species cues from leaf shape, venation, and color, then advising on light needs (low, bright indirect, full sun), watering cadence, humidity, soil and drainage, fertilizing rhythm, and common pests (spider mites, mealybugs, fungus gnats, scale). Lay it out as a clean, minimal editorial care card with thin lines, rounded panels per topic, small icons, a botanical-journal palette, and an expensive nursery-boutique feel. Add a small black-on-white contour line-art of the plant's silhouette as a decorative botanical illustration. Frame it as friendly care guidance, not a guaranteed diagnosis of the specimen. Do your best.",
    endpoint: "edits",
    imageSize: "1024x1536",
    quality: "medium",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "room-vibes": {
    inputType: "room",
    prompt:
      'Based on my room photo, give an interior-styling read covering palette, materials and textures, lighting, furniture silhouettes, era cues, and the closest design archetype (mid-century modern, Scandinavian, Japandi, minimalist, maximalist, industrial, coastal, or eclectic), plus a "shelf-as-personality" note on objects on display. Lay it out as a clean, minimal editorial interiors spread in landscape orientation with thin lines, rounded cards per category, swatch chips for the palette, refined serif-and-sans typography, and an expensive shelter-magazine feel. Include a small black-on-white contour line-art of the room\'s key silhouette as a decorative vignette. Frame everything as styling inspiration, not a verdict on taste. Do your best.',
    endpoint: "edits",
    imageSize: "1536x1024",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
};

async function generateInput(inputType) {
  const cachedPath = path.join(CACHE_DIR, `input-${inputType}.png`);
  try {
    const cached = await fs.readFile(cachedPath);
    console.log(`  [reusing cached input: ${cachedPath}]`);
    return cached;
  } catch {
    /* fall through */
  }
  const prompt = INPUT_PROMPTS[inputType];
  if (!prompt) throw new Error(`No INPUT_PROMPT for inputType=${inputType}`);

  console.log(`  generating input photo (${inputType})...`);
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
      output_format: "png",
      moderation: "low",
    }),
  });
  if (!resp.ok) {
    throw new Error(`input generation failed: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("input generation returned no b64_json");
  const buf = Buffer.from(b64, "base64");
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachedPath, buf);
  return buf;
}

async function prepareInput(inputBuf, preprocessing) {
  let pipeline = sharp(inputBuf);

  if (preprocessing === "exif-rotate") {
    pipeline = pipeline.rotate();
  }
  if (preprocessing === "contrast") {
    pipeline = pipeline.normalise().linear(1.2, -10);
  }

  const detail = preprocessing === "detail";
  const targetDim = detail ? 1536 : 1024;
  pipeline = pipeline.resize({
    width: targetDim,
    height: targetDim,
    fit: sharp.fit.inside,
    withoutEnlargement: true,
  });

  if (detail) {
    return {
      buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
      contentType: "image/png",
      filename: "input.png",
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: 90 }).toBuffer(),
    contentType: "image/jpeg",
    filename: "input.jpg",
  };
}

async function runReading(slug, config, inputBuf) {
  console.log(`→ ${slug}: running reading prompt...`);
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", config.prompt);
  form.append("n", "1");
  form.append("size", config.imageSize);
  form.append("quality", config.quality);
  form.append("output_format", "png");
  form.append("moderation", "low");

  if (config.endpoint === "edits") {
    const prepared = await prepareInput(inputBuf, config.preprocessing);
    if (!IMAGE_MODEL.startsWith("gpt-image-2")) {
      form.append("input_fidelity", config.inputFidelity);
    }
    form.append(
      "image",
      new Blob([prepared.buffer], { type: prepared.contentType }),
      prepared.filename,
    );
  }

  const apiUrl =
    config.endpoint === "generations"
      ? "https://api.openai.com/v1/images/generations"
      : "https://api.openai.com/v1/images/edits";

  const resp = await fetch(apiUrl, {
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

  const webpBuf = await sharp(pngBuf).webp({ quality: 88 }).toBuffer();
  await fs.mkdir(OUT_DIR, { recursive: true });

  const coverPath = path.join(OUT_DIR, `${slug}.webp`);
  const inputPath = path.join(OUT_DIR, `${slug}-input.webp`);
  const samplePath = path.join(OUT_DIR, `${slug}-sample.webp`);
  await fs.writeFile(coverPath, webpBuf);
  await fs.writeFile(samplePath, webpBuf);
  if (inputBuf) {
    const inputWebpBuf = await sharp(inputBuf).webp({ quality: 88 }).toBuffer();
    await fs.writeFile(inputPath, inputWebpBuf);
    console.log(`  saved ${path.relative(REPO_ROOT, inputPath)}`);
  }
  console.log(`  saved ${path.relative(REPO_ROOT, coverPath)}`);
  console.log(`  saved ${path.relative(REPO_ROOT, samplePath)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const slugs = args.includes("--all")
    ? Object.keys(READINGS)
    : args.filter((arg) => !arg.startsWith("--"));
  if (slugs.length === 0) {
    console.error("Choose at least one reading slug, or pass --all.");
    console.error(`Available: ${Object.keys(READINGS).join(", ")}`);
    process.exit(1);
  }
  for (const slug of slugs) {
    if (!READINGS[slug]) {
      console.error(`Unknown reading slug: ${slug}`);
      console.error(`Available: ${Object.keys(READINGS).join(", ")}`);
      process.exit(1);
    }
  }

  for (const slug of slugs) {
    const config = READINGS[slug];
    console.log(`Using ${IMAGE_MODEL}`);
    const inputBuf = config.endpoint === "edits" ? await generateInput(config.inputType) : null;
    await runReading(slug, config, inputBuf);
  }

  console.log("\nDone. Review and commit the new .webp files in public/images/tools/.");
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
