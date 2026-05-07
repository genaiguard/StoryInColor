// Prompt builder for hair-analysis composite image generation.
// One gpt-image-2 edit call per session.

export type TransformationLevel = "conservative" | "moderate" | "bold";
export type FaceShape = "oval" | "round" | "square" | "heart" | "oblong";

// ---------- Style banks ----------
// 8 styles per (transformationLevel, maintenancePreference) bucket.
// maintenancePreference: "low" = avoid was "high-maintenance" or impact was "some"

const STYLE_BANKS: Record<TransformationLevel, { low: string[]; any: string[] }> = {
  conservative: {
    low: [
      "Collarbone Cut",
      "Side-Part Blowout",
      "Long Layers",
      "Invisible Layers",
      "Soft Curtain Bangs",
      "Classic Lob",
      "Braided Half-Up",
      "Sleek Ponytail",
    ],
    any: [
      "Collarbone Cut",
      "Curtain Bangs",
      "Long Layers",
      "Classic Lob",
      "Face-Frame Layers",
      "Soft Bob",
      "Braided Half-Up",
      "Blowout Waves",
    ],
  },
  moderate: {
    low: [
      "Textured Lob",
      "Shaggy Bob",
      "Wispy Bangs",
      "Layered Shag",
      "Braided Front",
      "Low Maintenance Pixie",
      "Modern Bob",
      "Undone Waves",
    ],
    any: [
      "Textured Lob",
      "Layered Shag",
      "Curtain Bang Bob",
      "Modern Shag",
      "Wispy Bangs",
      "French Bob",
      "Braided Front",
      "Blunt Collarbone",
    ],
  },
  bold: {
    low: [
      "Wolf Cut",
      "Octopus Cut",
      "Textured Pixie",
      "Bixie",
      "Shag with Fringe",
      "Undone Bob",
      "Feathered Layers",
      "Modern Mullet",
    ],
    any: [
      "Wolf Cut",
      "Octopus Cut",
      "French Bob",
      "Bixie",
      "Blunt Pixie",
      "Shag with Curtain Bangs",
      "Feathered Layers",
      "Modern Mullet",
    ],
  },
};

export function selectStyles(
  level: TransformationLevel,
  preferLowMaintenance: boolean,
): string[] {
  const bank = STYLE_BANKS[level];
  return preferLowMaintenance ? bank.low : bank.any;
}

// ---------- Composite image prompt ----------

/**
 * Builds the prompt for gpt-image-2 images.edit().
 * Canvas: 1024×1536. Grid: 2 cols × 4 rows. Each cell: 512×384px.
 */
export function buildHairPrompt(styles: string[]): string {
  const labels = styles
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s}`)
    .join(", ");

  return `Based on this portrait, render the same person wearing each of the following hairstyles. Output a SINGLE image on a 1024×1536 pixel canvas structured as an exact 2-column × 4-row grid.

LAYOUT — follow exactly:
- No title. No header. No footer. No outer border. No gap between cells. No padding.
- Grid fills the entire 1024×1536 canvas edge to edge.
- Each cell is exactly 512px wide × 384px tall.
- 8 cells total, filled left-to-right then top-to-bottom.
- Style label: white sans-serif text, small, placed at bottom-left inside each cell on a dark gradient scrim (transparent → 50% black over the bottom 40px of the cell).

STYLES (one per cell, in this exact order):
${labels}

CONSISTENCY:
- Keep the face, skin tone, expression, and background identical across all 8 cells.
- Only the hair changes — color, cut, and styling.
- High editorial quality. Magazine lighting. Photorealistic.

Do your best.`;
}

// ---------- Stylist brief prompt ----------

export function buildStylistBriefPrompt(params: {
  faceShape: FaceShape;
  level: TransformationLevel;
  styles: string[];
  goal?: string;
  avoid?: string;
  feeling?: string;
}): string {
  return `You are a professional hairstylist writing a brief for a colleague.
Write a 2–3 sentence stylist brief in first-person voice from the client's perspective.
It should be practical, specific, and reference the top 3 suggested styles and the face shape.

Client details:
- Face shape: ${params.faceShape}
- Transformation goal: ${params.level} change
- Top suggested styles: ${params.styles.slice(0, 3).join(", ")}
- Goal: ${params.goal || "unspecified"}
- Wants to avoid: ${params.avoid || "unspecified"}
- Desired feeling after: ${params.feeling || "unspecified"}

Output only the brief text. No preamble, no explanation.`;
}

// ---------- Face shape detection prompt ----------

export const FACE_SHAPE_SYSTEM_PROMPT = `You are a professional stylist analyzing a portrait photo.
Determine the person's face shape from the image.
Respond with exactly one JSON object: { "faceShape": "<oval|round|square|heart|oblong>" }
No other text.`;
