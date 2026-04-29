// Server-only canonical authority for tool prompts + API parameters.
// Client never trusts its own creditCost/prompt — this file is the source of
// truth. Per-tool API mode and quality are tuned per Agent C's research.

export type ToolEndpoint = "edits" | "generations";
export type ToolQuality = "low" | "medium" | "high" | "auto";
export type ToolPreprocessing =
  | "none"
  | "contrast" // boost ink-vs-paper for handwriting
  | "exif-rotate" // auto-rotate top-down meals
  | "detail"; // higher fidelity input (1536px PNG) for fine-detail tools

export type ServerToolConfig = {
  prompt: string;
  creditCost: number;
  outputType: "image" | "image+guide";
  imageSize: string; // "1024x1024" | "1024x1536" | "1536x1024"
  endpoint: ToolEndpoint; // edits (input photo conditioned) vs generations (text-only)
  quality: ToolQuality;
  inputFidelity: "high" | "low"; // only applied to edits
  preprocessing: ToolPreprocessing;
};

export const TOOL_PROMPTS: Record<string, ServerToolConfig> = {
  "coloring-book": {
    prompt:
      "Convert this photo into a clean black-and-white line illustration suitable for a printable coloring page. If there are faces or figures, maintain the original features and essence, but subtly enhance them to appear sweeter, softer, and more charming—like a gently idealized animated style. Use thin, elegant lines with no shading or poche-style hatching. Simplify background details if needed, but preserve the overall mood and composition. The final image should feel graceful, warm, and beautiful, with a soft and uplifting tone.",
    // Free for any signed-in user. Server-side concurrency cap
    // (MAX_CONCURRENT_JOBS = 3 in generate-for-tool.ts) prevents bombardment.
    // Auth + the userCredits doc still gate access — anonymous users cannot
    // call generateForTool, so abuse requires a real account.
    creditCost: 0,
    outputType: "image",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "medium",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "palm-reading": {
    prompt:
      "Based on my hand, perform a complete palmistry reading covering the heart line, head line, life line, and fate line, plus the major mounts (Venus, Jupiter, Saturn, Apollo, Mercury, Luna, Mars) and overall hand shape (earth, air, fire, water). Lay it out as a clean, minimal editorial guide with thin hairlines, generous whitespace, and rounded cards labeling each line and mount, in a premium black-on-cream palette that feels expensive and magazine-like. Embed a small black-on-white contour line-art tracing the palm's main lines as a decorative artwork beside the cards. Frame the reading as a playful entertainment guide, not a literal prediction. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  "face-reading": {
    prompt:
      "Based on my face, perform a Mian Xiang (Chinese physiognomy) reading using the Five Officers and the Twelve Palaces — life, wealth, siblings, marriage, children, health, travel, friends, career, property, fortune, and parents — mapped across the forehead, brows, eyes, nose, cheeks, mouth, and chin zones. Compose it as a clean, minimal editorial chart with thin lines, soft rounded cards per palace, refined serif-and-sans typography, and an expensive, gallery-quality feel. Include a small black-on-white contour line-art portrait of the face with the twelve palace zones gently outlined as a decorative element. Frame everything as a cultural-entertainment reflection, not a personality verdict or destiny claim. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "beauty-report": {
    prompt:
      "Based on my selfie, create a clean, minimal, high-end Facial Beauty Report. Render it as a single black-on-white editorial spread titled 'FACIAL BEAUTY REPORT' with a subtitle 'Single-photo visual assessment' and a small italic note that lighting, flash, expression, and lens distortion can affect precision. Use thin hairlines, generous whitespace, rounded cards, and refined serif-and-sans typography for a luxury-magazine feel. Lay it out with the original photo on the upper left and a small black-on-white contour line drawing of the face below it. To the right, lead with an Overall Attractiveness card showing a single bold score out of 10 and a one-sentence honest summary. Below that, six smaller score cards in a 2-column grid — Symmetry, Proportions, Bone Structure, Skin Quality, Eye Area, and Smile / Dental — each with its own score out of 10 and a short, honest, two-sentence observation. End with three side-by-side panels — Strengths (4-5 bullets with a star icon), Areas for Improvement (4-5 bullets with an arrow icon), and Actionable Grooming / Style Recommendations (5-7 bullets with a comb icon, covering hair, facial hair or makeup, brows, skin, eye area, smile, and photography tips). Keep the tone honest, data-driven, and visually refined — never overly flattering, never unkind. For entertainment only. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  "aura-reading": {
    // Switched to /v1/images/generations: the aura reading is a stylized halo
    // composite where preserving an exact face hurts the result and risks
    // identity drift. Text-only generation is cheaper and produces a cleaner,
    // more idealized output.
    prompt:
      "Intuit an aura reading for a contemplative subject, describing the dominant aura colors (red, orange, yellow, green, blue, indigo, violet), the seven auric layers (etheric, emotional, mental, astral, etheric template, celestial, causal), and how they relate to the seven main chakras (root, sacral, solar plexus, heart, throat, third eye, crown). Render it as a clean, minimal editorial spread with thin concentric rings, generous whitespace, rounded cards explaining each color and layer, a soft watercolor halo overlaid behind a stylized silhouette of the subject, refined serif-and-sans typography, and an expensive ethereal magazine feel. Add a small black-on-white contour line-art silhouette of the head and shoulders as a decorative anchor. This is a reflective entertainment piece, not a spiritual diagnosis. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "generations",
    quality: "high",
    inputFidelity: "high", // unused on generations
    preprocessing: "none",
  },
  iridology: {
    prompt:
      "Based on my eye, create an iridology-style wellness reflection mapping the iris zones — pupillary zone, collarette (autonomic nerve wreath), ciliary zone, and outer rim — and noting visible markings such as lacunae, crypts, and radii, organized around a classic iris chart. Lay it out as a clean, minimal editorial infographic with thin lines, rounded cards for each zone, a refined neutral palette, and a premium clinical-but-elegant feel. Include a small black-on-white contour line-art of the iris and pupillary frill as a decorative emblem. This is a wellness reflection for entertainment only, not a medical diagnosis or health claim — keep all language gentle, suggestive, and lifestyle-oriented. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  handwriting: {
    prompt:
      "Based on my handwriting sample, perform a graphology-style personality sketch analyzing slant (left, vertical, right), baseline trend (rising, straight, falling, wavy), pressure (light, medium, heavy), letter size, spacing, connectivity, zones (upper, middle, lower), and signature character. Present it as a clean, minimal editorial card set with thin lines, rounded panels per trait, elegant typography, and an expensive stationery-magazine feel. Add a small black-on-white contour line-art of a fountain-pen stroke or a traced signature flourish as a decorative element. Frame the result as a playful personality reflection for entertainment, not a clinical or deterministic verdict. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "contrast",
  },
  "style-audit": {
    prompt:
      "Based on my outfit photo, perform an editorial style audit in a Vogue/GQ tone covering silhouette, proportion, fit, layering, color palette, fabric and texture, accessories, and the closest style archetype (classic, minimalist, romantic, dramatic, bohemian, edgy, or eclectic) with a suggested dress-code register. Lay it out as a clean, minimal fashion-magazine spread with thin lines, rounded cards per category, swatch chips for the palette, and a refined, expensive editorial feel. Include a small black-on-white contour line-art croquis of the outfit silhouette as a decorative figure. Frame everything as a style suggestion only, never a judgment of the person. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "skincare-glow": {
    prompt:
      "Based on my selfie, give a cosmetic skincare-glow reflection mapping the T-zone, cheeks, under-eye, and jawline, with gentle observations on apparent texture, tone, hydration, and luminosity, plus a suggested AM and PM routine framework (cleanse, treat, moisturize, SPF in AM; cleanse, treat, hydrate, occlusive in PM). Compose it as a clean, minimal editorial beauty card with thin lines, rounded panels per zone and routine step, soft neutral tones, and a luxe glossy-magazine feel. Add a small black-on-white contour line-art of the face with the skincare zones lightly outlined as a decorative element. This is cosmetic guidance for entertainment only — no medical claims, no diagnosis, no treatment promises. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "detail",
  },
  "plate-analysis": {
    prompt:
      "Based on my plate photo, give a dietitian-style infographic breakdown estimating the macro split (protein, carbohydrate, fat), portion balance, fiber and produce coverage, plating composition, and color theory of the food. Lay it out as a clean, minimal editorial nutrition card with thin lines, rounded panels per macro and observation, a small donut chart for the macro ratio, and a refined cookbook-magazine feel that looks expensive. Include a small black-on-white contour line-art of the plate from above as a decorative emblem. Frame it as general wellness reflection and balanced-eating inspiration, not medical or prescriptive nutrition advice. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1024",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "exif-rotate",
  },
  "plant-care": {
    prompt:
      "Based on my plant photo, give a plant-ID-style care card identifying likely species cues from leaf shape, venation, and color, then advising on light needs (low, bright indirect, full sun), watering cadence, humidity, soil and drainage, fertilizing rhythm, and common pests (spider mites, mealybugs, fungus gnats, scale). Lay it out as a clean, minimal editorial care card with thin lines, rounded panels per topic, small icons, a botanical-journal palette, and an expensive nursery-boutique feel. Add a small black-on-white contour line-art of the plant's silhouette as a decorative botanical illustration. Frame it as friendly care guidance, not a guaranteed diagnosis of the specimen. Do your best.",
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1024x1536",
    endpoint: "edits",
    quality: "medium",
    inputFidelity: "high",
    preprocessing: "none",
  },
  "room-vibes": {
    prompt:
      'Based on my room photo, give an interior-styling read covering palette, materials and textures, lighting, furniture silhouettes, era cues, and the closest design archetype (mid-century modern, Scandinavian, Japandi, minimalist, maximalist, industrial, coastal, or eclectic), plus a "shelf-as-personality" note on objects on display. Lay it out as a clean, minimal editorial interiors spread in landscape orientation with thin lines, rounded cards per category, swatch chips for the palette, refined serif-and-sans typography, and an expensive shelter-magazine feel. Include a small black-on-white contour line-art of the room\'s key silhouette as a decorative vignette. Frame everything as styling inspiration, not a verdict on taste. Do your best.',
    creditCost: 1,
    outputType: "image+guide",
    imageSize: "1536x1024",
    endpoint: "edits",
    quality: "high",
    inputFidelity: "high",
    preprocessing: "none",
  },
};

export function getServerToolConfig(toolId: string): ServerToolConfig | undefined {
  return TOOL_PROMPTS[toolId];
}
