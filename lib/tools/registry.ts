import type { Tool } from "./types";

export const TOOLS: Tool[] = [
  {
    id: "coloring-book",
    slug: "coloring-book",
    name: "Coloring Book",
    tagline: "Turn any photo into a beautiful coloring page",
    heroCopy:
      "Family photos, pet portraits, or vacation memories — turned into print-ready line art you can color in.",
    coverImage: "/images/tools/coloring-book.webp",
    creditCost: 1,
    category: "creative",
    inputHint: "Upload any photo. JPG, PNG, or WEBP up to 10MB.",
    outputType: "image",
  },
  {
    id: "palm-reading",
    slug: "palm-reading",
    name: "Palm Reading",
    tagline: "A complete palmistry guide from one photo of your hand",
    heroCopy:
      "Heart, head, life, and fate lines plus the major mounts, presented as a clean editorial guide with a contour line-art of your palm.",
    coverImage: "/images/tools/palm-reading.webp",
    creditCost: 10,
    category: "mystical",
    inputHint: "Upload a clear photo of your open palm in good light.",
    outputType: "image+guide",
  },
  {
    id: "face-reading",
    slug: "face-reading",
    name: "Face Reading",
    tagline: "Mian Xiang physiognomy — a Twelve Palaces report card",
    heroCopy:
      "Forehead, brows, eyes, nose, cheeks, mouth, and chin mapped to the Twelve Palaces, in a refined editorial chart.",
    coverImage: "/images/tools/face-reading.webp",
    creditCost: 10,
    category: "mystical",
    inputHint: "Upload a front-facing selfie in even lighting.",
    outputType: "image+guide",
  },
  {
    id: "aura-reading",
    slug: "aura-reading",
    name: "Aura Reading",
    tagline: "Your aura colors and seven auric layers, visualized",
    heroCopy:
      "Soft watercolor halo overlay plus a multi-layer reading of your dominant aura colors and chakras.",
    coverImage: "/images/tools/aura-reading.webp",
    creditCost: 10,
    category: "mystical",
    inputHint: "Upload a clear selfie against a plain background.",
    outputType: "image+guide",
  },
  {
    id: "iridology",
    slug: "iridology",
    name: "Iridology",
    tagline: "A wellness reflection from the zones of your iris",
    heroCopy:
      "Iris zones, the autonomic nerve wreath, and visible markings mapped to a classic iris chart — for entertainment, not diagnosis.",
    coverImage: "/images/tools/iridology.webp",
    creditCost: 10,
    category: "analysis",
    inputHint: "Upload a sharp close-up of one eye, well-lit.",
    outputType: "image+guide",
  },
  {
    id: "handwriting",
    slug: "handwriting",
    name: "Handwriting Read",
    tagline: "A graphology personality sketch from your handwriting",
    heroCopy:
      "Slant, baseline, pressure, spacing, and signature character translated into a playful personality card.",
    coverImage: "/images/tools/handwriting.webp",
    creditCost: 10,
    category: "creative",
    inputHint: "Upload a clear photo of a handwritten sample on plain paper.",
    outputType: "image+guide",
  },
  {
    id: "style-audit",
    slug: "style-audit",
    name: "Style Audit",
    tagline: "A magazine-style review of your outfit",
    heroCopy:
      "Silhouette, palette, fit, layering, and your closest style archetype — laid out like a Vogue spread.",
    coverImage: "/images/tools/style-audit.webp",
    creditCost: 10,
    category: "creative",
    inputHint: "Upload a full-body photo of your outfit.",
    outputType: "image+guide",
  },
  {
    id: "skincare-glow",
    slug: "skincare-glow",
    name: "Skincare Glow",
    tagline: "A cosmetic skin-zone routine card from a bare-face selfie",
    heroCopy:
      "T-zone, cheeks, under-eye, and jawline observations with a luxe AM/PM routine framework. Cosmetic guidance only.",
    coverImage: "/images/tools/skincare-glow.webp",
    creditCost: 10,
    category: "analysis",
    inputHint: "Upload a bare-face, well-lit selfie.",
    outputType: "image+guide",
  },
  {
    id: "plate-analysis",
    slug: "plate-analysis",
    name: "Plate Analysis",
    tagline: "A dietitian-style infographic of your meal",
    heroCopy:
      "Macro split, plating, color theory, and balance — a beautiful nutrition card from one photo of your plate.",
    coverImage: "/images/tools/plate-analysis.webp",
    creditCost: 10,
    category: "analysis",
    inputHint: "Upload a top-down photo of your plate.",
    outputType: "image+guide",
  },
  {
    id: "plant-care",
    slug: "plant-care",
    name: "Plant Care",
    tagline: "A care card for any houseplant",
    heroCopy:
      "Light, water, soil, and pest guidance plus a botanical contour illustration of your plant.",
    coverImage: "/images/tools/plant-care.webp",
    creditCost: 10,
    category: "analysis",
    inputHint: "Upload a clear photo of your plant.",
    outputType: "image+guide",
  },
  {
    id: "room-vibes",
    slug: "room-vibes",
    name: "Room Vibes",
    tagline: "An interior-styling spread on your room",
    heroCopy:
      "Palette, materials, era, and design archetype — a shelter-magazine read on your space.",
    coverImage: "/images/tools/room-vibes.webp",
    creditCost: 10,
    category: "analysis",
    inputHint: "Upload a wide shot of your room or bookshelf.",
    outputType: "image+guide",
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getToolById(id: string): Tool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
