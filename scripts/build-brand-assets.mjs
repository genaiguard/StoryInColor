#!/usr/bin/env node
/**
 * Local-only brand asset generator for the Option 12 "hairline frame plate"
 * direction (chosen 2026-04-29).
 *
 * Renders deterministically with sharp + system fonts (no AI image
 * generation, no OpenAI cost). Re-run anytime the SVG below changes:
 *
 *   node scripts/build-brand-assets.mjs
 *
 * Outputs (commit these):
 *   - public/images/SHARING.webp                (1200×630 OG card)
 *   - public/favicon.svg                        (master vector)
 *   - public/favicon.ico                        (32×32 PNG, ico-named)
 *   - public/favicon-16x16.png
 *   - public/favicon-32x32.png
 *   - public/favicon-96x96.png
 *   - public/apple-touch-icon.png               (180×180)
 *   - public/web-app-manifest-192x192.png
 *   - public/web-app-manifest-512x512.png
 *
 * The italic "S" renders via the font stack `'Playfair Display', Georgia,
 * 'Times New Roman', serif`. Sharp's librsvg uses fontconfig to resolve
 * — Playfair Display is unlikely to be system-installed, so it falls
 * back to Georgia or Times Italic, which look indistinguishable at
 * favicon sizes.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Sharp ships with the functions package (already used by the sample
// generator). Avoids a separate root-level install.
const sharpUrl = `file://${resolve(ROOT, "functions/node_modules/sharp/lib/index.js")}`;
const sharp = (await import(sharpUrl)).default;

// ---------------------------------------------------------------------------
// 1) Open Graph card — Option 12 "hairline frame plate"
// ---------------------------------------------------------------------------

const OG_SVG = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#000000"/>
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#ffffff" stroke-width="1"/>
  <rect x="50" y="50" width="1100" height="530" fill="none" stroke="#3a3a3a" stroke-width="1"/>
  <text x="600" y="115" fill="#9b9b9b" text-anchor="middle"
    font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="500"
    letter-spacing="3.6">VOL · 01 — EDITORIAL AI PHOTO READINGS</text>
  <text x="600" y="335" fill="#ffffff" text-anchor="middle"
    font-family="'Playfair Display', Georgia, 'Times New Roman', serif"
    font-size="128" font-weight="400" font-style="italic" letter-spacing="-3.84">StoryInColor</text>
  <line x1="500" y1="385" x2="700" y2="385" stroke="#ffffff" stroke-width="1" opacity="0.5"/>
  <text x="600" y="430" fill="#bcbcbc" text-anchor="middle"
    font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="400">A magazine-quality reading, written from a single photo.</text>
  <text x="600" y="528" fill="#9b9b9b" text-anchor="middle"
    font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="500"
    letter-spacing="3.36">STORYINCOLOR.COM</text>
</svg>`;

await sharp(Buffer.from(OG_SVG))
  .webp({ quality: 90, effort: 6 })
  .toFile(resolve(ROOT, "public/images/SHARING.webp"));
console.log("✓ public/images/SHARING.webp (1200×630)");

// ---------------------------------------------------------------------------
// 2) Favicon — same hairline-frame mark, square
// ---------------------------------------------------------------------------

/** Render the Option 12 brand mark at any square size. */
function favSvg(size) {
  // Stroke and inset scale gently so the frame remains visible at 16px
  // without overpowering at 512px.
  const stroke = size <= 32 ? 1 : size <= 64 ? 1.4 : Math.max(2, size / 96);
  const inset = Math.max(2, Math.round(size * 0.094));
  const fontSize = size * 0.66;
  const yPos = size * 0.71;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <rect x="${inset}" y="${inset}" width="${size - 2 * inset}" height="${size - 2 * inset}" fill="none" stroke="#ffffff" stroke-width="${stroke}"/>
  <text x="${size / 2}" y="${yPos}" fill="#ffffff" text-anchor="middle"
    font-family="'Playfair Display', Georgia, 'Times New Roman', serif"
    font-size="${fontSize}" font-weight="400" font-style="italic">S</text>
</svg>`;
}

const PUBLIC = resolve(ROOT, "public");

// Master SVG — modern browsers fetch this directly.
writeFileSync(resolve(PUBLIC, "favicon.svg"), favSvg(64), "utf8");
console.log("✓ public/favicon.svg");

// PNG variants. Render at 2× the target size, then resize down — gives
// crisper edges than rendering at the target size directly.
const variants = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-96x96.png", size: 96 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "web-app-manifest-192x192.png", size: 192 },
  { name: "web-app-manifest-512x512.png", size: 512 },
];

for (const { name, size } of variants) {
  const renderSize = Math.max(size * 2, 256);
  await sharp(Buffer.from(favSvg(renderSize)))
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(resolve(PUBLIC, name));
  console.log(`✓ public/${name} (${size}×${size})`);
}

// favicon.ico — sharp can't write multi-image .ico directly. Render a
// single 32×32 PNG with .ico extension. Modern browsers accept this;
// older clients may want a true multi-resolution ICO, but the .svg +
// PNG variants above cover everything in practice.
await sharp(Buffer.from(favSvg(256)))
  .resize(32, 32, { kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toFile(resolve(PUBLIC, "favicon.ico"));
console.log("✓ public/favicon.ico (32×32 PNG, .ico-named)");

console.log("\nDone. Commit the regenerated files.");
