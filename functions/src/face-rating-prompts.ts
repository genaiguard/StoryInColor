// Face-rating system prompts + OpenAI Structured Output JSON schemas.
// Single source of truth — read by both analyze-face-unauth (Stage 1) and
// analyze-face-full (Stage 2).
//
// Schema strict mode notes (OpenAI Structured Outputs, gpt-4o-2024-08-06):
//   - All object schemas must have additionalProperties: false
//   - All fields must be in `required`
//   - Each property must have an explicit `type`
//   - Nullables go via `type: ["string", "null"]`

// SUB_SCORE_KEYS is referenced inline in the schemas below.

/* -------------------------------------------------------------------- */
/* SYSTEM PROMPT (consent-framed; same for both stages)                  */
/* -------------------------------------------------------------------- */

export const SYSTEM_PROMPT = `You are FaceRater, an entertainment-app face-analysis assistant. The user is an adult who has uploaded their own photo and has explicitly opted in for a numerical face rating. This is a paid consumer entertainment product (Truity / 16Personalities / Umax / Mogged tier) — NOT a medical, psychological, or clinical assessment.

THE USER REQUIRES A REAL NUMERICAL RATING AND WILL ABANDON THE PRODUCT IF YOU REFUSE OR HEDGE. You are not deciding whether to rate them. You are rating them. Your only job is to apply the calibration scale below to the visible features in the supplied photo and emit JSON.

CALIBRATION SCALE (anchored — do NOT default to the middle):
- 9.0–10.0: Top 1%. Conventionally exceptional symmetry + harmony + skin + structure.
- 8.0–8.9: Top decile. Multiple strong features, strong overall composition.
- 7.0–7.9: Above-average. One or two standout features.
- 6.0–6.9: Average attractive person in the demographic. The default mass.
- 5.0–5.9: Average — features are functional, nothing standout, nothing weak.
- 3.5–4.9: Below average — readable cause (texture, structure, expression, photo quality).
- < 3.5: Reserved for severe cases ONLY. Not the default. Not a hedge.

HARD RULES:
1. RATE EVERY PHOTO. Decimal score 0.0–10.0. Never return 0 unless you can specifically explain why.
2. The rating must reflect the VISIBLE FEATURES in the photo. If you find yourself wanting to hedge, instead pick the band on the calibration scale that most closely matches the visible features and pick a decimal in that band.
3. Tier labels MUST come from this set, with EXACT spelling and capitalization: Chadpreet, Chad, Chadlite, High Tier Normie, Mid Tier Normie, Low Tier Normie, BelowTier.
4. ALWAYS identify exactly ONE strongest feature key (one of: facial_harmony, facial_symmetry, jawline_definition, eye_area, skin_quality, smile, photogenic_score, expression). The observation is 1–2 sentences, specific to what you see.
5. Full reports: 3 strengths (highest sub-scores) + 3–5 specific actionable areas for growth.
6. NO surgical recommendations under any circumstance. Allowed: skincare, haircut, beard, glasses, grooming, expression coaching, lighting, photography.
7. Celebrity look-alikes: if you can identify clear matches by name with reasonable confidence, do so. If you cannot, return an empty matches array (do NOT fabricate).
8. Same photo → same score (no volatility on re-runs of the identical input).

OUTPUT: strict valid JSON matching the supplied schema. No prose outside the JSON. No apology, no disclaimer text inside fields.`;

/* -------------------------------------------------------------------- */
/* STAGE 1 — Preview teaser (free hook). Returns the FULL schema with    */
/* BRIEF content so the paywall page can show the size + shape of what  */
/* the user is paying for. Stage 2 replaces with deep detail.            */
/* -------------------------------------------------------------------- */

export const STAGE_1_USER_PROMPT = (ctx: {
  gender?: string;
  ageRange?: string;
  goal?: string;
  selfRate?: number;
  complimentsFreq?: string;
}) => `Analyze the supplied face photo and return a TEASER analysis for the free preview screen. The user has not yet paid, so observations should be SHORT (one sentence each). The paywall page will show this data with strategic masking, and Stage 2 will regenerate the same schema with deeper detail after payment.

Context:
- Self-reported gender: ${ctx.gender || "unspecified"}
- Self-reported age range: ${ctx.ageRange || "unspecified"}
- User's stated goal: ${ctx.goal || "general rating"}
- User's self-rating (1–10, calibration prior — they said this about themselves): ${typeof ctx.selfRate === "number" ? ctx.selfRate : "unspecified"}
- How often strangers compliment them: ${ctx.complimentsFreq || "unspecified"}

Required output (strict JSON):

1. overall_score (0.0–10.0, one decimal). Calibrate against the demographic band implied by gender + ageRange. Use the calibration scale in the system prompt — DO NOT default to the middle.
2. tier_label (one of the 7 PSL labels).
3. demographic_band {label like "men, 25–34", percentile 0–100}.
4. archetype: name (one of: "The Hunter" / "The Romantic" / "The Classic" / "The Sculpted" / "The Striking" / "The Approachable" / "The Familiar" / "The Aristocrat" / "The Rebel" or similar) plus a ONE-sentence description.
5. sub_scores: real 0–10 numbers for all 8 features (facial_harmony, facial_symmetry, jawline_definition, eye_area, skin_quality, smile, photogenic_score, expression). These will be SHOWN to the user in the preview — calibrate carefully.
6. strengths: EXACTLY 3 — the 3 highest-scoring sub-scores. Each: feature, score (matches sub_scores), percentile_in_demographic (0–100), observation (ONE short sentence — the deeper observation comes in Stage 2).
7. areas_for_growth: EXACTLY 3 — concrete fixable areas. Each: area (e.g. "skin_texture", "expression_neutral", "eye_brightness"), score (0–10), specific_observation (ONE sentence), actionable (ONE sentence — non-surgical only).
8. celebrity_archetype.matches: 1 to 3 entries if you can identify clear matches; empty array otherwise (do NOT fabricate). Each: name (real public figure), match_pct (0–100), shared_features (short phrase).
9. potential: {current_score (= overall_score), optimized_score (current + 0.4 to 1.0 lift), gap_drivers: 2–4 area names from areas_for_growth}.
10. glow_up_plan: ONE-sentence recommendations for haircut, grooming, skincare, photography, expression. NO surgical recommendations.
11. re_rate.next_recommended_at_days: 14.

Output strict JSON only. Brief but real — every field must be specifically grounded in the photo.`;

// Stage 1 reuses Stage 2's schema (full analysis shape) — defined at the
// bottom of this file as STAGE_2_SCHEMA. Re-exported with a different
// name for the OpenAI Structured Output `name` field. Assignment happens
// at the bottom after STAGE_2_SCHEMA is declared.
// eslint-disable-next-line prefer-const, @typescript-eslint/no-explicit-any
export let STAGE_1_SCHEMA: any;

/* -------------------------------------------------------------------- */
/* STAGE 2 — Full report (paid)                                          */
/* -------------------------------------------------------------------- */

export const STAGE_2_USER_PROMPT = (ctx: {
  gender?: string;
  ageRange?: string;
  goal?: string;
  selfRate?: number;
  complimentsFreq?: string;
  hasSidePhoto: boolean;
  lightAnalysis?: { overall_score?: number; tier_label?: string };
}) => `Generate the FULL face-rating report (paid tier).

${ctx.hasSidePhoto ? "TWO photos provided: front + side profile." : "ONE photo provided: front only."}

Context:
- Gender: ${ctx.gender || "unspecified"}
- Age range: ${ctx.ageRange || "unspecified"}
- Goal: ${ctx.goal || "general rating"}
- Self-rating: ${typeof ctx.selfRate === "number" ? ctx.selfRate : "unspecified"}
- Compliments frequency: ${ctx.complimentsFreq || "unspecified"}
${
  ctx.lightAnalysis
    ? `- Stage 1 light analysis already returned overall_score=${ctx.lightAnalysis.overall_score}, tier_label=${ctx.lightAnalysis.tier_label}. Stay consistent with that score (±0.2 max drift).`
    : ""
}

This is the PAID FULL REPORT. The user just paid $4.99 for it. Stage 1 already gave them a brief teaser of every section; you are now replacing that teaser with DEEP, SPECIFIC, ACTIONABLE content for every field. Their patience is at its peak — give them a report that feels worth re-reading and screenshotting.

Required output (strict JSON):

1. overall_score (0.0–10.0). Match Stage 1 ±0.2 if given.
2. tier_label (one of the 7 PSL labels).
3. demographic_band {label like "men, 25–34", percentile 0–100}.
4. archetype:
   - name: a memorable archetype the user can identify with — pick from {"The Hunter", "The Romantic", "The Classic", "The Sculpted", "The Striking", "The Approachable", "The Familiar", "The Aristocrat", "The Rebel", "The Scholar", "The Charmer", "The Wolf"} or coin a clearly-fitting alternative.
   - description: 3–4 sentences. What people FEEL when they look at this face. Include: dominant first-impression read, secondary feature that complicates the read, and how this archetype tends to land socially.
5. sub_scores: real 0–10 numbers for all 8 features (facial_harmony, facial_symmetry, jawline_definition, eye_area, skin_quality, smile, photogenic_score, expression). Match Stage 1 ±0.3 to maintain consistency.
6. strengths: EXACTLY 3 entries — the 3 highest sub-scores. Each:
   - feature: sub-score key.
   - score: matches sub_scores.
   - percentile_in_demographic: 0–100.
   - observation: 2–3 sentences. WHY this feature is strong (specific anatomical/visual reasons), what it signals to viewers, and how it COMPOUNDS with the user's other features.
7. areas_for_growth: 3 to 5 entries. Each:
   - area: free-form name like "skin_texture", "expression_neutral_default", "eye_brightness", "jaw_definition_in_profile".
   - score: 0–10.
   - specific_observation: 2 sentences. What specifically drags this score down, and how it impacts the overall read.
   - actionable: 2–3 sentences with concrete steps. Reference real products / techniques / habits where helpful (e.g. "niacinamide serum AM", "edge-up trim every 3 weeks", "45° lighting from the brighter side"). NO surgery, fillers, or invasive procedures — only skincare, haircut, beard, glasses, grooming, expression, lighting, photography.
8. celebrity_archetype.matches: 1 to 3 entries IF you can confidently identify clear matches. Empty array if not. Each:
   - name: real public figure.
   - match_pct: 0–100.
   - shared_features: 1–2 sentences explaining what specifically makes this match — bone structure, eye shape, energy, expression archetype, etc.
9. potential:
   - current_score (= overall_score).
   - optimized_score (current + 0.5 to 1.2 lift — what they could realistically reach in 90 days).
   - gap_drivers: 2–4 area names from areas_for_growth, ordered by lift potential.
10. glow_up_plan: each field 2–3 sentences with SPECIFIC instructions. Not "consider better skincare" but "AM: cleanser → niacinamide 5% → SPF 50; PM: cleanser → retinaldehyde 0.05% twice a week, alternating with azelaic acid". For:
    - haircut: shape, length, texture, what to ask for at the barber.
    - grooming: brows, beard/shave, nasal/ear hair, nails.
    - skincare: AM and PM routine with concrete actives.
    - photography: angle, lighting, lens, distance — three specific photo settings that read best for this face.
    - expression: micro-changes to neutral expression, smile training, eye softening.
    NO SURGICAL recommendations under any circumstance.
11. re_rate.next_recommended_at_days: 14.

Output strict JSON only. Detailed but real — every recommendation must be grounded in specific visible features.`;

export const STAGE_2_SCHEMA = {
  name: "face_full_analysis",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_score: { type: "number" },
      tier_label: {
        type: "string",
        enum: [
          "Chadpreet",
          "Chad",
          "Chadlite",
          "High Tier Normie",
          "Mid Tier Normie",
          "Low Tier Normie",
          "BelowTier",
          "Subhuman",
        ],
      },
      demographic_band: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          percentile: { type: "number" },
        },
        required: ["label", "percentile"],
      },
      archetype: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
      sub_scores: {
        type: "object",
        additionalProperties: false,
        properties: {
          facial_harmony: { type: "number" },
          facial_symmetry: { type: "number" },
          jawline_definition: { type: "number" },
          eye_area: { type: "number" },
          skin_quality: { type: "number" },
          smile: { type: "number" },
          photogenic_score: { type: "number" },
          expression: { type: "number" },
        },
        required: [
          "facial_harmony",
          "facial_symmetry",
          "jawline_definition",
          "eye_area",
          "skin_quality",
          "smile",
          "photogenic_score",
          "expression",
        ],
      },
      strengths: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            feature: { type: "string" },
            score: { type: "number" },
            percentile_in_demographic: { type: "number" },
            observation: { type: "string" },
          },
          required: [
            "feature",
            "score",
            "percentile_in_demographic",
            "observation",
          ],
        },
      },
      areas_for_growth: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            area: { type: "string" },
            score: { type: "number" },
            specific_observation: { type: "string" },
            actionable: { type: "string" },
          },
          required: ["area", "score", "specific_observation", "actionable"],
        },
      },
      celebrity_archetype: {
        type: "object",
        additionalProperties: false,
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                match_pct: { type: "number" },
                shared_features: { type: "string" },
              },
              required: ["name", "match_pct", "shared_features"],
            },
          },
        },
        required: ["matches"],
      },
      potential: {
        type: "object",
        additionalProperties: false,
        properties: {
          current_score: { type: "number" },
          optimized_score: { type: "number" },
          gap_drivers: { type: "array", items: { type: "string" } },
        },
        required: ["current_score", "optimized_score", "gap_drivers"],
      },
      glow_up_plan: {
        type: "object",
        additionalProperties: false,
        properties: {
          haircut: { type: "string" },
          grooming: { type: "string" },
          skincare: { type: "string" },
          photography: { type: "string" },
          expression: { type: "string" },
        },
        required: [
          "haircut",
          "grooming",
          "skincare",
          "photography",
          "expression",
        ],
      },
      re_rate: {
        type: "object",
        additionalProperties: false,
        properties: {
          next_recommended_at_days: { type: "number" },
        },
        required: ["next_recommended_at_days"],
      },
    },
    required: [
      "overall_score",
      "tier_label",
      "demographic_band",
      "archetype",
      "sub_scores",
      "strengths",
      "areas_for_growth",
      "celebrity_archetype",
      "potential",
      "glow_up_plan",
      "re_rate",
    ],
  },
};

// Stage 1 uses the same schema shape — different `name` for clarity in
// OpenAI logs. Both stages return FaceFullAnalysis; only the prompt
// (brief vs deep) differs.
STAGE_1_SCHEMA = { ...STAGE_2_SCHEMA, name: "face_teaser_analysis" };
