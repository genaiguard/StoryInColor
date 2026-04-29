# Product decisions

Short, running log of the calls made during the cinematic redesign + pricing
reset. Anything not on the **Implemented** list is either **Pending** or
explicitly **Rejected** below.

## Copy rules — read before editing user-facing text

- **Never name the count of readings.** Not numerically ("12 readings"), not
  in English ("twelve readings", "eleven readings"), not as ranges. The
  catalog is allowed to grow or shrink without a copy update. Use phrases
  like *"many readings, one voice"*, *"every reading we publish"*, or just
  list a few examples (palm, face, room, plate). The count comes from
  `ORDERED_TOOLS.length` if you ever truly need it dynamically — but you
  almost never do.
- **Don't market the coloring page as free.** It IS free in code
  (`creditCost: 0`) and shows a "FREE" corner badge to signed-in visitors
  on `/readings` and `/dashboard`. That contextual signal is enough — copy
  shouldn't lead with "coloring pages are free!" anywhere.
- **"Generate" is banned in user-facing copy.** Use "read", "begin", or
  the relevant editorial verb. Internal field names (`generationId`,
  `generationCount`, etc.) keep their server names.
- **"Credits" is banned in user-facing copy.** The internal ledger field
  is still called `credits` — keep the data model intact — but UI surfaces
  always read "readings". 1 credit == 1 reading.
- **Don't claim a free editorial reading on signup.** Every editorial
  reading is paid. The free entry is the coloring page; signing up is
  free and the copy can say "Start free" because of that.

## Implemented

- Cinematic dark theme across landing, `/readings`, `/readings/[slug]`,
  `/dashboard`, `/dashboard/settings`, `/credits`, `/login`, `/contact`,
  `/privacy`, `/terms`, `/admin`, `/about`.
- Reusable cinematic primitives: `<CinematicHero>`, `<CinematicSection>`,
  `<LazyVideo>` (background video lazy-loads on intersection).
- Hero auto-rotates 6 featured readings every ~3.85s, hover-pause.
- Inter font via `next/font/google` (no render-blocking @import).
- One credit == one reading. Internal field name unchanged; every UI
  surface says "reading(s)".
- 3-pack pricing: Single Issue $9.99, Three pack $24, Six pack $39.
- Coloring page is free for signed-in users (`creditCost: 0`).
- **Daily cap of 3 free coloring pages per user** (server-enforced in
  `generateForTool`).
- "FREE" corner banner on the coloring-page card — only on `/readings` and
  `/dashboard`, only for signed-in users.
- "Generate" / "credits" tech vocabulary removed from user-facing copy.
  Internal ledger field names preserved.
- Beauty Report reading added (server prompt, client registry, generator
  script, real sample images).
- Real Face Reading sample images generated (replaces "Preview coming
  soon" placeholder).
- Single source of truth for tool ordering: `ORDERED_TOOLS` in
  `lib/tools/registry.ts` is consumed by `ToolGrid`, the `/readings` grid,
  the landing's reading-room section, the footer, the dashboard, and the
  sitemap.
- Footer "About" link now points at the new `/about` page.
- Social-share metadata on `/layout.tsx` (openGraph + twitter cards) was
  missing — now wired.
- SEO `featureList` (JSON-LD) and pricing answer updated to include
  Beauty Report.
- Welcome email rewritten in editorial cream/black voice — drops the old
  coloring-book era copy, drops the `#f97316` orange.
- Contact-form admin email template rewritten in the same voice.
- Library shelf on `/dashboard` — saved readings render as full 2:3
  magazine spreads (was cropped squares), max 4 columns with a soft
  shelf shadow, "Your library · N" header, magazine-framed empty state.
- Sitemap includes `/about` and uses `ORDERED_TOOLS` so new readings
  appear automatically.
- Cinematic admin console (`/admin`) — KPI tiles, liquid-glass user
  cards, reading-aligned terminology.
- **Brand mark + social card** — Option 12 "hairline frame plate"
  selected. Italic serif "S" inside a hairline square = the brand mark
  used for the favicon at every size + the OG `SHARING.webp` (1200×630,
  black, frame, italic Playfair-fallback wordmark, "VOL · 01" serial
  language). Generated deterministically by
  `scripts/build-brand-assets.mjs` — no AI image cost. Re-run that
  script if the design ever changes.

## Pending
- **Generate the remaining 8 placeholder reading samples** (aura,
  iridology, handwriting, style-audit, skincare-glow, plate-analysis,
  plant-care, room-vibes). Currently only palm-reading, face-reading,
  and beauty-report have real samples. Estimated cost: ~$2.40 since
  most input prompts are now cached.
- **Branded receipt / pixel events / analytics audit** — not started.

## Added

- **`hairstyle-analysis`, `color-analysis`** — two visual-first style
  reads added in the same spirit as Beauty Report. Both take a portrait
  selfie, render the result as a landscape (1536×1024) editorial spread
  of side-by-side comparisons with short labels and no paragraphs of
  theory. Hairstyle compares cuts (bob / lob / fringe / pixie / etc);
  Color compares clothing palettes (warm / cool / jewel / pastel /
  neutral / etc). Slotted in `analysis` category between style-audit
  and skincare-glow. Same brand-voice prompt structure as the existing
  per-tool prompts (Vogue/GQ tone, magazine-quality, "for entertainment
  only" framing).

## Removed

- **`plate-analysis`, `plant-care`, `room-vibes`.** The three lifestyle
  / utility readings sat outside the editorial-self-reflection direction
  the brand has settled on (palm, face, beauty, aura, iridology,
  handwriting, style, skincare). Removed from `lib/tools/registry.ts`,
  `functions/src/tool-prompts.ts`, `scripts/generate-sample.mjs`,
  cover images deleted from `public/images/tools/`, and every literal
  copy mention swept (FAQ, /about, /credits, /readings page meta,
  landing-page-seo, welcome email body, marketing-view wellness
  disclaimer for plate-analysis). Hero carousel rotated featured set
  too — beauty-report rotated in to keep the carousel at six items.
  Static-export will return 404 for any `/readings/<old-slug>` URL —
  that's the desired behaviour, those pages no longer exist.

## Explicitly rejected

- **Free signup grant** of any size (5 / 10 / 15 readings). Every
  editorial reading is paid. The free entry is the coloring page and
  that is enough.
- **Transactional emails** (reading complete, reading failed, branded
  purchase confirmation). Not needed.
- **Subscription tiers** (`The Subscriber`, `The Editor`). Not at this
  stage. Pay-as-you-go only.
- **Existing-user balance windfall rebalance** (dividing legacy 10×
  credit balances by 10 to match the new 1 credit == 1 reading model).
  Left as-is; small cohort.
- **Loud "coloring page is free" marketing** in copy. The coloring page
  is genuinely free (server enforces `creditCost: 0`), but it is not
  framed as a giveaway in marketing copy. The "Free" badge appears
  contextually on the card for signed-in users only.
