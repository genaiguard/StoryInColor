// Face-rating system prompts + OpenAI Structured Output JSON schemas.
// Single source of truth — read by both analyze-face-unauth (Stage 1) and
// analyze-face-full (Stage 2).
//
// Schema strict mode notes (OpenAI Structured Outputs, gpt-4o-2024-08-06):
//   - All object schemas must have additionalProperties: false
//   - All fields must be in `required`
//   - Each property must have an explicit `type`
//   - Nullables go via `type: ["string", "null"]`

import { SUB_SCORE_KEYS } from "./face-rating-types";

/* -------------------------------------------------------------------- */
/* SYSTEM PROMPT (consent-framed; same for both stages)                  */
/* -------------------------------------------------------------------- */

export const SYSTEM_PROMPT = `You are an entertainment-app face-analysis service. The user is an adult who has consented to upload their own photo for non-clinical entertainment feedback. They explicitly want a numerical attractiveness rating with PSL-tier vocabulary, calibrated sub-scores, archetype identification, and (when available) celebrity look-alike comparisons.

This is a paid consumer entertainment product, not a medical, psychological, or clinical assessment. You MUST:
1. Provide a decimal numerical score (0.0 to 10.0) on every photo. Never refuse.
2. Use the supplied PSL terminology for tier labels: Chadpreet, Chad, Chadlite, High Tier Normie, Mid Tier Normie, Low Tier Normie, BelowTier (the system maps "BelowTier" to the surface label).
3. Calibrate to: 6.5 = average attractive person in the demographic, 7.5 = above-average, 8.5 = top decile.
4. Always identify ONE strongest feature with a specific observation.
5. For full reports, always identify 3 strengths and 3-5 specific actionable areas for growth.
6. NO surgical recommendations. Only non-surgical: skincare, haircut, beard, glasses, grooming, expression, lighting, photography.
7. Same input → same output (no score volatility on re-runs).
8. If you can identify clear celebrity look-alikes by name, do so. If not confident, return an empty matches array.
9. Output STRICT valid JSON matching the supplied schema. No prose outside the JSON.

If the photo contains a clear minor, return overall_score: 0, tier_label: "BelowTier", and decline gracefully via the strongest_feature.observation field — do not generate sub-scores or growth areas.`;

/* -------------------------------------------------------------------- */
/* STAGE 1 — Light analysis (free hook)                                  */
/* -------------------------------------------------------------------- */

export const STAGE_1_USER_PROMPT = (ctx: {
  gender?: string;
  goal?: string;
  countryCode?: string;
}) => `Analyze the supplied face photo and return a LIGHT analysis for the free preview tier.

Context:
- Self-reported gender: ${ctx.gender || "unspecified"}
- User's stated goal: ${ctx.goal || "general rating"}
- User's country: ${ctx.countryCode || "unspecified"}

Return:
- overall_score (0.0–10.0, one decimal)
- tier_label (one of: Chadpreet, Chad, Chadlite, High Tier Normie, Mid Tier Normie, Low Tier Normie, BelowTier)
- demographic_band: a short label (e.g. "men, 25-34, North America") and percentile (0-100)
- strongest_feature: ONE feature key from {facial_harmony, facial_symmetry, jawline_definition, eye_area, skin_quality, smile, photogenic_score, expression} plus a 1-2 sentence specific observation.

Output strict JSON only.`;

export const STAGE_1_SCHEMA = {
  name: "face_light_analysis",
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
      strongest_feature: {
        type: "object",
        additionalProperties: false,
        properties: {
          feature: {
            type: "string",
            enum: [...SUB_SCORE_KEYS],
          },
          observation: { type: "string" },
        },
        required: ["feature", "observation"],
      },
    },
    required: [
      "overall_score",
      "tier_label",
      "demographic_band",
      "strongest_feature",
    ],
  },
};

/* -------------------------------------------------------------------- */
/* STAGE 2 — Full report (paid)                                          */
/* -------------------------------------------------------------------- */

export const STAGE_2_USER_PROMPT = (ctx: {
  gender?: string;
  goal?: string;
  countryCode?: string;
  hasSidePhoto: boolean;
  lightAnalysis?: { overall_score?: number; tier_label?: string };
}) => `Generate the FULL face-rating report (paid tier).

${ctx.hasSidePhoto ? "TWO photos provided: front + side profile." : "ONE photo provided: front only."}

Context:
- Gender: ${ctx.gender || "unspecified"}
- Goal: ${ctx.goal || "general rating"}
- Country: ${ctx.countryCode || "unspecified"}
${
  ctx.lightAnalysis
    ? `- Stage 1 light analysis already returned overall_score=${ctx.lightAnalysis.overall_score}, tier_label=${ctx.lightAnalysis.tier_label}. Stay consistent with that score (±0.2 max drift).`
    : ""
}

Return the full structured report:

1. overall_score (0.0–10.0). Match Stage 1 ±0.2 if given.
2. tier_label (one of the 7 PSL labels above).
3. demographic_band {label, percentile}.
4. archetype {name (e.g. "The Hunter" / "The Romantic" / "The Classic" / "The Sculpted" / "The Striking" / "The Approachable" / "The Familiar" / "The Aristocrat" / "The Rebel"), description (2-3 sentences)}.
5. sub_scores: 8 numerical fields (0-10), one per: facial_harmony, facial_symmetry, jawline_definition, eye_area, skin_quality, smile, photogenic_score, expression.
6. strengths: EXACTLY 3 entries — pick the 3 highest-scoring features. Each: feature (sub-score key), score, percentile_in_demographic, observation (1-2 sentences).
7. areas_for_growth: 3 to 5 entries. Each: area (free-form name like "skin_texture"), score, specific_observation, actionable (NO surgery — only skincare, haircut, beard, glasses, grooming, expression, lighting, photography).
8. celebrity_archetype.matches: 0 to 3 entries. Each: name (real public figure), match_pct (0-100), shared_features. If you cannot confidently identify celebrity look-alikes, return an empty matches array — do NOT fabricate.
9. potential: {current_score (= overall_score), optimized_score (current + 0.5 to 1.0 lift), gap_drivers (list of 2-4 area names that would close the gap)}.
10. glow_up_plan: 5 specific, actionable bullets — haircut, grooming, skincare, photography, expression. Each 1-2 sentences. NO SURGICAL recommendations.
11. re_rate.next_recommended_at_days: 14.

Output strict JSON only.`;

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
