import type { Tool } from "./types";

const PHOTO_PRIVACY_FAQ = {
  q: "Will my photo be saved?",
  a: "Your upload is processed immediately to generate your result and is retained for your generation history so you can re-download it. Photos are sent to our AI processing provider (OpenAI) for the generation step only; we do not share them for training. You can delete your account and the associated uploads at any time from your account settings.",
};

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
    seo: {
      metaTitle: "Photo to coloring page — free AI generator | StoryInColor",
      metaDescription:
        "Turn any photo into a print-ready black-and-white coloring page. Family photos, pet portraits, vacation memories — your custom coloring book in seconds.",
      whatYouGet: [
        "A clean line illustration drawn from your photo",
        "Print-ready black-and-white output sized for a standard page",
        "Faithful preservation of the subject's likeness and pose",
        "Free starter credits when you sign up — no card required",
      ],
      faq: [
        {
          q: "Can I print these?",
          a: "Yes. Each page is exported in a high-resolution, print-ready format that prints cleanly at home on standard letter or A4 paper.",
        },
        {
          q: "Will it look like my photo?",
          a: "The line art is drawn from your photo, so the subject's pose, proportions, and key features are preserved. Sharp, well-lit photos give the best likeness.",
        },
        {
          q: "Can I do pets?",
          a: "Absolutely. Cats, dogs, birds, horses — pet portraits convert beautifully. A clear close-up of the face works best.",
        },
        {
          q: "What file format do I get?",
          a: "You get a high-resolution PNG ready to print or share. Each page is one credit, so you can build a full custom coloring book.",
        },
      ],
      sampleImage: "/images/tools/coloring-book.webp",
    },
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
    seo: {
      metaTitle: "AI palm reading from a photo of your hand | StoryInColor",
      metaDescription:
        "Upload a photo of your open palm and get a complete editorial palmistry guide — heart, head, life, and fate lines, the major mounts, and a contour line-art of your palm.",
      whatYouGet: [
        "Heart, head, life, and fate lines mapped and interpreted",
        "Major mounts breakdown (Venus, Jupiter, Saturn, and more)",
        "A clean contour line-art of your own palm",
        "A magazine-quality editorial layout you can keep or share",
      ],
      faq: [
        {
          q: "Is this real palmistry?",
          a: "It draws on classical palmistry conventions, but the report is for entertainment and self-reflection — not a prediction or professional reading.",
        },
        {
          q: "How clear should my photo be?",
          a: "A sharp, well-lit, top-down photo of your open palm with the major lines clearly visible gives the best result.",
        },
        {
          q: "Does it work for both hands?",
          a: "Yes. Tradition often reads the dominant hand for the present and the non-dominant hand for innate tendencies — you can run it on either.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/palm-reading.webp",
    },
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
    seo: {
      metaTitle:
        "AI face reading from a selfie — Mian Xiang Twelve Palaces | StoryInColor",
      metaDescription:
        "Upload a clear selfie and get a Mian Xiang face-reading guide — the Twelve Palaces map, Five Officers analysis, and a contour portrait in a magazine-quality layout.",
      whatYouGet: [
        "A Twelve Palaces map drawn over a contour portrait of your face",
        "Five Officers analysis (brows, eyes, nose, mouth, ears)",
        "A clean contour portrait keepsake",
        "A culturally-styled editorial report card",
      ],
      faq: [
        {
          q: "Is this accurate?",
          a: "It follows classical Mian Xiang conventions, but the report is offered as cultural entertainment and self-reflection — not as a professional reading.",
        },
        {
          q: "What kind of selfie works best?",
          a: "A front-facing photo in even, neutral light, with hair off the forehead and a relaxed expression. Avoid heavy filters or makeup.",
        },
        {
          q: "Is it safe?",
          a: "Photos are sent over HTTPS and shared only with our AI processing provider (OpenAI) for the generation step. Reports are stored on your account and visible only to you.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/face-reading.webp",
    },
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
    seo: {
      metaTitle:
        "AI aura reading from a photo — colors, layers, chakras | StoryInColor",
      metaDescription:
        "Upload a selfie and get a soft watercolor halo plus a complete aura reading — dominant colors, the seven auric layers, and a chakra connection map.",
      whatYouGet: [
        "Your dominant aura colors and what they suggest",
        "A seven-layer auric reading from etheric to spiritual",
        "A soft watercolor halo composited around a stylized portrait",
        "A chakra connection map paired with the aura colors",
      ],
      faq: [
        {
          q: "Is this a real aura photo?",
          a: "No. It is an artistic interpretation generated from your selfie, presented for entertainment and self-reflection.",
        },
        {
          q: "What kind of photo works best?",
          a: "A relaxed selfie against a plain, light background, in soft even light, gives the most readable layers and colors.",
        },
        {
          q: "Will it always be the same colors?",
          a: "Aura readings can vary with mood, lighting, and pose — feel free to run a new photo when you feel like a fresh look.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/aura-reading.webp",
    },
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
    seo: {
      metaTitle:
        "AI iridology — wellness reflection from your iris | StoryInColor",
      metaDescription:
        "Upload a close-up photo of your iris and get a beautifully-laid-out wellness reflection — iris zones, the autonomic nerve wreath, and observations in a soft neutral aesthetic. For entertainment, not a medical diagnosis.",
      whatYouGet: [
        "Iris zone map overlaid on a contour of your own eye",
        "Observations of the autonomic nerve wreath and visible markings",
        "A wellness-style infographic in a soft neutral palette",
        "A keepsake card you can save or share",
      ],
      faq: [
        {
          q: "Is this medical advice?",
          a: "No. This is a wellness reflection for entertainment only. Not a diagnosis or treatment recommendation.",
        },
        {
          q: "What kind of photo works best?",
          a: "A sharp, well-lit close-up of one eye, with the iris filling most of the frame. A phone macro mode in daylight works well.",
        },
        {
          q: "Can I do both eyes?",
          a: "Yes — run each eye separately. Iridology traditionally reads each iris on its own.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/iridology.webp",
    },
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
    seo: {
      metaTitle:
        "AI graphology — personality from your handwriting | StoryInColor",
      metaDescription:
        "Upload a photo of your handwriting and get a graphology personality sketch — slant, baseline, pressure, and signature character in a beautifully laid-out card.",
      whatYouGet: [
        "Slant, baseline, and pressure analysis with examples from your sample",
        "A signature character read",
        "Your closest personality archetype card",
        "A playful editorial layout you can keep",
      ],
      faq: [
        {
          q: "Is graphology real?",
          a: "Graphology is a long-standing tradition rather than a peer-reviewed science. We present the report for entertainment and self-reflection only.",
        },
        {
          q: "What should I write?",
          a: "A few sentences of natural handwriting on plain unlined paper, plus your signature on the same page, gives the richest read.",
        },
        {
          q: "Print or cursive?",
          a: "Both work. Use whichever style is most natural for you, and the read will reflect that.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/handwriting.webp",
    },
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
    seo: {
      metaTitle: "AI fashion style audit from your outfit photo | StoryInColor",
      metaDescription:
        "Upload an outfit photo and get a magazine-style fashion audit — silhouette, palette, fit, and your closest style archetype, laid out like a Vogue spread.",
      whatYouGet: [
        "Silhouette, palette, and fit analysis with annotated callouts",
        "A style archetype label (classic, romantic, edgy, minimal, and more)",
        "Wardrobe-tweak suggestions in a tasteful tone",
        "A Vogue-style editorial spread of your look",
      ],
      faq: [
        {
          q: "What kind of photo works best?",
          a: "A full-body, well-lit photo with the whole outfit visible — neutral background, natural pose. Phone selfies in a mirror work fine.",
        },
        {
          q: "Will it judge me?",
          a: "No. The tone is editorial and constructive — like a stylist friend, not a critic.",
        },
        {
          q: "Can I run several outfits?",
          a: "Yes — run each look separately. It is a great way to map your wardrobe and see your dominant archetype.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/style-audit.webp",
    },
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
    seo: {
      metaTitle: "AI skincare glow analysis from a selfie | StoryInColor",
      metaDescription:
        "Upload a bare-face selfie and get a luxe skincare glow card — zone observations for T-zone, cheeks, under-eye, and jawline plus an AM/PM routine framework. Cosmetic only.",
      whatYouGet: [
        "Zone-by-zone observations (T-zone, cheeks, under-eye, jawline)",
        "An AM and PM routine framework with category guidance",
        "Texture, glow, and tone callouts",
        "A luxe beauty card laid out for you to save",
      ],
      faq: [
        {
          q: "Is this medical advice?",
          a: "No. This is cosmetic guidance only and is not a diagnosis or treatment recommendation. For medical concerns, please see a dermatologist.",
        },
        {
          q: "What kind of selfie works best?",
          a: "A bare-face selfie in soft, even daylight — no heavy filters, makeup, or strong shadows. Hair pulled back is ideal.",
        },
        {
          q: "Will it recommend specific products?",
          a: "It suggests product categories (e.g. gentle cleanser, niacinamide serum) rather than specific brands, so you can shop your preferred line.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/skincare-glow.webp",
    },
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
    seo: {
      metaTitle:
        "AI plate analysis — macros and balance from a meal photo | StoryInColor",
      metaDescription:
        "Snap a top-down photo of your meal and get a dietitian-style infographic — estimated macro split, portion balance, and plating notes in a clean editorial layout.",
      whatYouGet: [
        "Estimated macro split (protein, carbs, fats)",
        "A portion balance read across food groups, including fiber and produce coverage",
        "Plating and color-theory notes",
        "A dietitian-style infographic you can save",
      ],
      faq: [
        {
          q: "Is this medical nutrition advice?",
          a: "No, general wellness reflection only. It is not a substitute for guidance from a registered dietitian or your doctor.",
        },
        {
          q: "How accurate are the macros?",
          a: "They are visual estimates from a single photo, intended as a directional read rather than a precise measurement.",
        },
        {
          q: "What kind of photo works best?",
          a: "A top-down photo of the full plate in good light, with all components visible. No filters needed.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/plate-analysis.webp",
    },
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
    seo: {
      metaTitle:
        "AI plant care card — light, water, soil from a plant photo | StoryInColor",
      metaDescription:
        "Snap your plant and get a nursery-boutique care card — species cues, light and water guidance, soil mix, and a pest watch list in a clean botanical layout.",
      whatYouGet: [
        "Species cues and a likely identification",
        "Light, water, and soil guidance tailored to the plant",
        "A pest and stress watch list",
        "A nursery-boutique care card with a contour illustration",
      ],
      faq: [
        {
          q: "Will it identify my plant?",
          a: "It suggests a likely species or close relatives based on visible cues. For rare cultivars, treat the ID as a starting point.",
        },
        {
          q: "What kind of photo works best?",
          a: "A clear, well-lit photo of the whole plant with leaves and stem visible. A second close-up of a leaf helps the read.",
        },
        {
          q: "Does it work for outdoor plants?",
          a: "It is tuned for houseplants but handles common patio and balcony plants well.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/plant-care.webp",
    },
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
    seo: {
      metaTitle:
        "AI room vibes — interior style read from a room photo | StoryInColor",
      metaDescription:
        "Snap your room and get a shelter-magazine spread — palette, materials, era cues, and a design archetype in a beautifully laid-out interior style read.",
      whatYouGet: [
        "Color palette and materials breakdown",
        "Era cues (mid-century, Scandinavian, classical, and more)",
        "A design archetype label for the space",
        "A shelter-magazine spread with annotations",
      ],
      faq: [
        {
          q: "What kind of photo works best?",
          a: "A wide, daytime shot of the room with the dominant furniture and surfaces in frame. A bookshelf or vignette also works.",
        },
        {
          q: "Will it suggest changes?",
          a: "It includes optional styling tweaks framed as ideas rather than prescriptions — you can take or leave them.",
        },
        {
          q: "Multiple rooms?",
          a: "Run each room separately. It is a fun way to map your home's overall design language.",
        },
        PHOTO_PRIVACY_FAQ,
      ],
      sampleImage: "/images/tools/room-vibes.webp",
    },
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getToolById(id: string): Tool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
