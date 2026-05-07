# Hairstyle Analysis — Product Spec

Pre-implementation reference. Do not implement anything without reading this first.
Synthesized from: competitor analysis (UMAX, LooksMax AI, HairHunt, Prose, Noom), 
professional hairstylist consultation research, and face-rating architecture audit.

---

## What this product is

User uploads one selfie. We run one `gpt-image-2` edit call that generates a single 
composite image containing 8 hairstyle variations of that person, arranged in a 2×4 
grid. The composite is split server-side into 8 individual cell images using `sharp`.
We show 1 cell free (preview). The other 7 are blurred but visible. $4.99 unlocks all 8
plus a stylist-ready brief.

One OpenAI call. ~$0.01 API cost. Split is free.

---

## Architecture (new, mirrors face-rating)

Mounted at `/readings/hairstyle-analysis` via `FACE_RATING_SLUGS` mechanism.
Separate `HairAnalysisFlow` component tree — same plumbing, different product.

### What's reused from face-rating (do not rewrite)
- `pendingReadings` Firestore collection + token/ownerSecret auth model
- `face-rating-helpers.ts` — IP rate limiting, token/email validation, `hashIp`, `makeExpiresAt`
- `credit-ledger.ts`
- Stripe checkout callable + webhook pattern (new lookup key: `hair_analysis_single_v1`)
- `email-service.ts`
- `FaceRatingViz` primitives: `BlurredBlock`, `SectionHeader`, `LockedRow`, `CompletionBadge`, `MaskedText`
- `ProgressBar`, `Affirmation` primitives
- Phase machine: `loading → preview → email-gate → paywall → checkout → polling → full`
- `AccountClaimCard` — reuse with zero changes
- `FACE_RATING_SLUGS` routing in `readings/[slug]/page.tsx`

### What's new
- `lib/hair-analysis/types.ts`
- `components/hair-analysis/HairAnalysisFlow.tsx`
- `components/hair-analysis/useHairAnalysisState.ts`
- `components/hair-analysis/HairStyleGrid.tsx` — the image grid UI
- `components/hair-analysis/FaceShapeSVG.tsx` — SVG face shape diagram
- `functions/src/hair-analysis-prompts.ts`
- `functions/src/analyze-hair-unauth.ts` — Stage 1: OpenAI call + sharp split
- `functions/src/hair-analysis-checkout.ts` — Stripe + credit unlock
- `app/hair-analysis/result/result-view.tsx`

---

## The questionnaire — design rationale

**Critical decision:** Do NOT ask about current hair texture, length, or color.
The model sees all of that from the photo. Asking about it is redundant and 
signals the product is unsophisticated.

Instead: ask purely psychological questions. These do three things simultaneously:
1. Create sunk cost (each answer raises the cost of abandoning)
2. Personalize the prompt (answers determine which 8 styles are generated)
3. Personalize the result page copy (answers are echoed back at them)

Research basis: Noom 113-screen funnel, Prose 30-question quiz, UMAX screen sequence.
7–9 questions is optimal. More than 5 raises conversion 15% (Thumbtack research).
More than 12 doesn't hurt completion but doesn't help either.

---

## The 7 questions — exact wording and options

### Q1 — Goal (identity + aspiration, never diagnostic)

Screen title: **"What's your #1 goal right now?"**

Options (single pick, chip style):
- Fresh start — I need something completely different
- Look more like myself — I've drifted from who I am
- Take it up a notch — I want people to notice
- Get back to a version of me I loved
- I just know something needs to change

*Why this question:* Opens with aspiration, not problem. Forces identity articulation.
The answer directly maps to the style selection bucket (see prompt section below).
"I just know something needs to change" is the highest-converting option — it signals
maximum latent desire without clear direction, which makes the AI feel most necessary.

### Q2 — The negative reference (stylist's most diagnostic question)

Screen title: **"What's the one thing we should never do to your hair?"**

Options (single pick):
- Chop it too short
- Make me look older
- Make me look like everyone else
- Ruin the texture
- Make it high-maintenance
- Nothing — I trust the process

*Why this question:* The "don't want" reference reveals more than the "want."
Professional stylists universally call this their most important intake question.
It also surfaces fear, which creates emotional investment — the user is now
protecting something. "Nothing — I trust the process" is the power user signal.

### Q3 — Social motivation

Screen title: **"How important is it to you that others notice?"**

Options (single pick):
- Very — I love when people compliment my hair
- Somewhat — it affects how I carry myself
- Not much — I want to feel like myself, not perform
- I've stopped thinking about it

*Why this question:* Surfaces the social motivation layer. 
"I've stopped thinking about it" is your highest-value user — they have suppressed 
desire, and this question activates it. Expect them to convert at higher rates.
Use this answer to personalize paywall copy.

### Q4 — The emotional core (the most powerful question)

Screen title: **"Is there a version of yourself you're trying to get back to — or move toward?"**

Options (single pick):
- Get back to — I used to feel better about how I looked
- Move toward — I'm ready to become someone new
- Both, honestly
- I'm not sure yet — I just know something isn't right

*Why this question:* Cited by hairstylist trainers as the single question that separates 
skilled consultations from service orders. "Get back to" users are nostalgic — show them 
classic/refined styles. "Move toward" users want transformation — show them bold/editorial.
"I'm not sure yet" is the highest friction user but converts well because they feel 
understood rather than sold to.

### Q5 — Fear / resistance (name the obstacle before they do)

Screen title: **"What's been holding you back from changing your hair?"**

Options (single pick):
- I don't know what would actually work for me
- I've tried before and it didn't come out right
- I'm scared to ask a stylist — I never know how to explain what I want
- Nothing — I'm ready to try something new
- I didn't think something better existed for me

*Why this question:* This is the reverse psychology screen. Naming the obstacle 
out loud defuses it. "I didn't think something better existed for me" is a 
self-limiting belief — naming it and then immediately following with "let's prove 
that wrong" is a powerful conversion setup. "I'm scared to ask a stylist" is an 
explicit value prop for your product.

### Q6 — How they want to feel (outcome, not description)

Screen title: **"How do you want to feel when you leave the salon?"**

Options (single pick):
- Like people will look twice
- Like a better version of me — subtle but right
- Confident without thinking about it
- Completely unrecognizable (in the best way)
- Finally right

*Why this question:* Borrowed from hairstylist consultation best practice — ask about 
outcome, not about physical description. "Finally right" is the highest emotional 
charge option and the one that most activates the "this is the answer I've been 
looking for" feeling when they see the result.

### Q7 — Attribution / blame (the dark pattern hook)

Screen title: **"How much do you think the right hairstyle could change things for you?"**

Options (single pick, slightly uncomfortable to answer):
- A lot — I think the right cut could change everything
- Some — but I also need to take better care of it
- Honestly, I'm not sure — that's why I'm here
- Not much — I'm happy, just curious

*Why this question:* This is the conversion activation question. It forces the user 
to either commit to "this matters a lot" (which means paying $4.99 is trivially 
justified) or hedge — and even the hedge answers are designed to lead forward. 
"That's why I'm here" is the perfect setup for the paywall. "Not much — just curious" 
users have the lowest predicted conversion; you can use this to A/B messaging.

---

## Prompt personalization logic

The 7 answers collapse into two signals fed into the prompt:

**Signal A: Transformation level** (how bold should the 8 styles be?)
- Conservative (safe evolution, 1–2 steps from current): Q1=look-like-myself or get-back, Q5=scared/didn't-work, Q6=subtle/finally-right
- Moderate (clear change, still wearable): most mid combinations
- Bold (editorial, dramatic): Q1=fresh-start or take-it-up, Q4=move-toward, Q6=completely-unrecognizable

**Signal B: Lifestyle code** (maintenance level)
- Low maintenance signal: Q2=high-maintenance-is-bad, Q7=take-better-care-of-it
- High maintenance allowed: Q2=trust-the-process, Q7=right-cut-changes-everything

These two signals select from a style bank in `hair-analysis-prompts.ts`.

### Example style banks (illustrative — will expand in code)

Conservative + low maintenance:
Collarbone Cut, Side-Part Blowout, Long Layers, Invisible Layers, 
Soft Curtain Bangs, Classic Lob, Face-Frame Highlights, Subtle Shag

Bold + high maintenance:
Curtain Bang Shag, Wolf Cut, French Bob, Octopus Cut, 
Bixie, Blunt Bob, Bleached Pixie, Textured Mullet

The prompt then names these 8 styles explicitly — the model is NOT asked to decide
what to generate. It is told exactly what to put in each cell.

---

## The composite image prompt (exact template)

```
Based on my portrait, render this person wearing each of the following 
hairstyles. Output a SINGLE image on a 1024×1536 canvas structured as 
an exact 2-column × 4-row grid. 

LAYOUT RULES — follow exactly:
- No title. No header. No footer. No outer border. No gap between cells.
- Grid fills the entire canvas edge to edge.
- Each cell is exactly 512px wide × 384px tall.
- 8 cells total, filled left-to-right, top-to-bottom.
- Style label: white sans-serif text, 13px, bottom-left of each cell, 
  on a dark gradient scrim that fades from transparent to 50% black 
  over the bottom 48px of the cell.

STYLES (one per cell, in order):
1. [STYLE_1], 2. [STYLE_2], 3. [STYLE_3], 4. [STYLE_4],
5. [STYLE_5], 6. [STYLE_6], 7. [STYLE_7], 8. [STYLE_8]

Keep the face, skin, and expression identical across all cells. 
Only the hairstyle changes. High editorial quality, magazine lighting. 
Do your best.
```

The 8 style names are substituted from the style bank based on transformation level 
and lifestyle code. Style names are short (2–3 words max) to fit as cell labels.

### Canvas math for sharp splitting
- Total: 1024 × 1536
- Cell width: 512px (1024 / 2)
- Cell height: 384px (1536 / 4)
- Cell [col, row] crops from: x=col×512, y=row×384, width=512, height=384
- 8 cells: [0,0], [1,0], [0,1], [1,1], [0,2], [1,2], [0,3], [1,3]

No heuristic detection needed — the split coordinates are deterministic because 
we specified them in the prompt.

---

## Backend: Stage 1 flow (analyze-hair-unauth)

1. Validate token, IP rate limit (reuse `face-rating-helpers.ts`)
2. Download user photo from Storage
3. Call `gpt-image-2` via `images.edit()` with the personalized composite prompt
4. Receive base64 image
5. Use `sharp` to crop 8 cells from the composite
6. Store all 8 cells at `hair-analysis/{token}/cell-{0..7}.webp` in Storage
7. Store composite at `hair-analysis/{token}/composite.webp` (for debugging)
8. Run a cheap parallel GPT-4o text call to generate: 
   - Detected face shape (from the photo description)
   - Stylist brief (2–3 sentences, see below)
9. Write `pendingReadings/{token}` doc with:
   - `type: "hair-analysis"`
   - `previewCellPath`: cell-0 path (always free)
   - `cellPaths`: all 8 paths (paid unlock)
   - `styleLabels`: the 8 style names in order
   - `faceShape`: "Oval" / "Round" / "Square" / "Heart" / "Oblong"
   - `stylistBrief`: text string
   - `transformationLevel`: "conservative" | "moderate" | "bold"
   - `questionnaire`: the 7 answers stored for analytics
   - Standard fields: `token`, `ipHash`, `ownerSecret`, `status`, `createdAt`, `expiresAt`
10. Return `{ token, previewCellUrl, styleLabels, faceShape }` to client

Stage 2 (paid unlock): No additional OpenAI call. Just flip `status → claimed`, 
return all `cellUrls` + `stylistBrief`.

---

## Result page — preview state

### Hero
```
StoryInColor · Hairstyle Analysis

8 looks generated for you.
[FaceShapeSVG: thin geometric outline of detected face shape]
Face shape: Oval
Goal: [echo their Q1 answer]
```

No score. No rating. The face shape SVG + their goal echoed back = personalization proof.

### The grid (HairStyleGrid component)
2×4 grid of image tiles.
- Cell 0: full quality, no overlay. Best possible image.
- Cells 1–7: `filter: blur(8px)` + `scale(1.1)` to prevent blur edge artifact + 
  lock icon centered on image.
- Style label: ALWAYS visible on ALL cells — even blurred ones.
  The label is OUTSIDE the image (below it, small caps), never inside the blurred area.
  This is the hook. User reads "Wolf Cut" but can't see it on their face.

### Below the grid
```
7 more looks are waiting.

Stylists charge $150–$250 for a consultation like this.
Unlock all 8 for $4.99 — no subscription, no upsells.

[Unlock all 8 looks — $4.99]  ← primary CTA
[Or invite 3 friends to unlock free]  ← secondary (reuse face-rating invite mechanic)
```

### Lock badge (top of page)
Small inline badge: `🔒 Preview · 1 of 8 looks visible`
Matches face-rating's `CompletionBadge`.

---

## Result page — full report state (paid)

### All 8 cells revealed
Same grid, no blur. Cells are tappable/clickable to expand to full-screen lightbox.

### Face Shape section
`FaceShapeSVG` + one paragraph: why this face shape works well with the detected 
transformation level styles.

### Stylist Brief section (the unique value-add)
```
SHOW THIS TO YOUR STYLIST

"My goal is [Q1 answer]. I want to feel [Q6 answer]. I'm open to [transformation level]
changes. Reference styles from my analysis: [style 1], [style 2], [style 3]. 
Please avoid: [Q2 answer]. My face shape is [faceShape], which works well with 
styles that [brief explanation]."
```

One tap to copy. This is the word-of-mouth driver — user screenshots it and sends it
to their stylist. Every share is organic distribution.

### Standard footer
- `AccountClaimCard` — reuse exactly
- Delete photos button — reuse exactly
- Share toggle — reuse exactly (share shows the unlocked grid)
- "For styling inspiration only. Not a professional consultation."

---

## FaceShapeSVG component

5 variants as simple SVG geometric outlines (thin white stroke, no fill):
- **Oval**: vertically elongated ellipse, widest at cheekbones
- **Round**: near-circle, soft jaw
- **Square**: equal width/height, strong jaw, wide forehead
- **Heart**: wide forehead, tapers sharply to narrow jaw/chin
- **Oblong**: tall narrow ellipse, similar width forehead/jaw

Below each: 1-line descriptor. Examples:
- Oval: "Most versatile face shape — almost any style works."
- Round: "Styles that add height and length flatter best."
- Square: "Soft layers and side parts balance a strong jaw."
- Heart: "Volume at the jaw offsets a wide forehead."
- Oblong: "Width at the sides balances a long face."

Rendered as inline SVG, ~80×100px, `stroke="rgba(255,255,255,0.5)"`, 
`strokeWidth="1"`, `fill="none"`. Dark background so it reads clean.

---

## Loading screen (labor illusion — do not skip)

Research: 10–20% conversion lift from a credible-sounding 4-second progress screen.

Steps (each shown for ~800ms):
1. "Analyzing your face structure…"
2. "Reading your goals and preferences…"
3. "Selecting 8 styles from our library…"
4. "Generating your looks with AI…"
5. "Your hairstyle report is ready."

Progress bar. Do not rush this screen. The longer they watch something "working for them,"
the more they feel the result is worth paying for.

---

## Conversion mechanics summary

| Mechanic | Implementation | Research basis |
|---|---|---|
| Sunk cost ladder | 7 questions before photo upload | Thumbtack: 5→20 questions +15% conversion |
| Emotional investment before camera | Questions first, photo second | UMAX pattern |
| Labor illusion | 4-second loading screen with steps | Prose/Noom: +10–20% conversion |
| Blurred grid with visible labels | 7 blurred tiles, labels always visible | Gradient/UMAX: curiosity gap drives payment |
| Style labels visible | User reads "Wolf Cut" but can't see it | Specific to this product — names create desire |
| Price anchor | "$150–$250 salon consultation → $4.99" | Standard anchoring, every beauty app uses it |
| Personalization callback | Q1 answer echoed in hero + paywall copy | ScienceDirect personalization research |
| Invite path | 3 friends = free (reuse face-rating mechanic) | UMAX: turns non-payers into acquisition |
| Stylist brief | Unique utility that drives organic share | Original — not seen in competitors |
| Cell 0 quality | Best generated style shown first | Show the proof before asking for $4.99 |

---

## Screen sequence

```
intro → q1-goal → q2-avoid → q3-social → q4-self → q5-fear → q6-feeling → q7-impact
→ lockin-affirmation → photo-upload → loader → [redirect to result page with token]
```

13 screens total. Photo upload is screen 11 — by then the user has made 7 micro-commitments.
Abandonment at the photo screen is the lowest-friction point to recover with retargeting.

---

## Pricing and Stripe

- Lookup key: `hair_analysis_single_v1`
- Price: $4.99 one-time (matches face-rating)
- Credit path: signed-in users with ≥1 credit skip Stripe (reuse `unlockFaceWithCredit` pattern)

---

## Files to create (implementation order)

1. `lib/hair-analysis/types.ts` — screen sequence, questionnaire types, `HairAnalysisDoc` shape
2. `components/hair-analysis/useHairAnalysisState.ts` — localStorage + screen nav
3. `components/hair-analysis/primitives/FaceShapeSVG.tsx` — 5 SVG variants
4. `components/hair-analysis/HairStyleGrid.tsx` — image grid, blur mechanic
5. `components/hair-analysis/HairAnalysisFlow.tsx` — all 13 screens
6. `functions/src/hair-analysis-prompts.ts` — style banks + prompt builder
7. `functions/src/analyze-hair-unauth.ts` — OpenAI call + sharp split + Firestore write
8. `functions/src/hair-analysis-checkout.ts` — Stripe + credit unlock callables
9. `app/hair-analysis/result/result-view.tsx` — full result page
10. `app/hair-analysis/result/page.tsx` — Next.js page wrapper
11. Add `"hairstyle-analysis"` to `FACE_RATING_SLUGS` in `readings/[slug]/page.tsx`

---

## Open questions before implementation

1. **Which cell to show free (cell 0)?** Options: always show the first one the model renders,
   or ask a text model to pick the "best" one for this face. First is simpler and good enough
   for v1 — the model already has the style order as a prompt signal.

2. **Stylist brief generation:** Parallel GPT-4o text call in Stage 1, or generate on demand 
   at Stage 2 unlock? Parallel is better UX (ready immediately on unlock), but costs ~$0.001 
   extra per session. Recommend parallel.

3. **sharp in Cloud Functions:** Confirm `sharp` is in `functions/package.json`. 
   It's a binary dep that must be compiled for the Firebase runtime. If not already present,
   `npm install sharp` inside `functions/` and verify it builds before writing the function.

4. **Image output format:** Generate composite as PNG (quality), split cells to WEBP 
   (storage efficiency). Sharp handles this conversion inline.

5. **Rate limiting:** Use the same `pendingReadings` + `quizDailyCounters` pattern as 
   face-rating. No new infrastructure needed.
