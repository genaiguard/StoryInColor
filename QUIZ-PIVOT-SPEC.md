# StoryInColor — Quiz-Funnel Pivot Specification

> **Status:** Draft v2.1 — 2026-05-04
> **Author:** Claude (with founder direction)
> **Audience:** Engineering, design, marketing
> **Scope:** Replace the sign-up-first credit-purchase funnel with a category-standard quiz → upload → blurred reveal → paywall flow, applied uniformly across **all 11 readings** in one rollout. **v2 added the pricing strategy revision (§17): hybrid subscription + credit packs, daily personalized content, repriced tiers. v2.1 reframes the subscription as a "self-discovery membership" product (Artifact / Profile / Practice), introduces the Reading Profile as a first-class data model, and revises the subscription positioning copy.**

> **What changed v1 → v2 → v2.1.**
> - **v1 → v2** (pricing): credit-pack-only paywall replaced by hybrid subscription + packs + daily content. See §17.
> - **v2 → v2.1** (positioning): the subscription is no longer a "credit bundle with daily text" — it's an **ongoing self-discovery membership** with three product layers: **Artifact** (the reading you unlock), **Profile** (the persistent self-knowledge profile we build from your quiz answers + readings), and **Practice** (ongoing monthly readings + daily reflections). See §17.0 for the strategic frame, §17.5 for the renamed "Daily Reflection" (was "whisper"), and §17.6 for the new Reading Profile data model.

---

## TL;DR (60-second read)

**The problem.** Last campaign: 309 ad clicks → 32 sign-ups → 2 checkouts → **0 purchases**. The category (mystical/AI-photo) runs on quiz funnels — Nebula, Umax, BetterMe, Faceify all use the same pattern. We're running a credit-store funnel. That's the gap.

**The fix.** Replace `/login → /credits` with `/quiz/<slug>` — an 8-screen flow ending in a blurred reveal of the user's actual reading + email capture + tiered paywall. Account creation deferred until after payment. All 11 readings rebuilt on a shared template; only ~6 strings change per reading.

**Pricing pivot + positioning pivot (v2.1).** Pure credit-pack pricing caps LTV at ~1/4 to 1/8 of subscription LTV in this category. Recommended structure: **$14.99/mo subscription with 7-day trial as the hero / $89.99 yr ($7.50 effective monthly) / $11.99 one-time as bottom-of-page escape hatch.** But the positioning matters as much as the price: the subscription is reframed as a **self-discovery membership** with three product layers — **Artifact** (the unlock), **Profile** (a persistent self-knowledge profile we build from quiz answers + readings), **Practice** (ongoing monthly readings + Daily Reflection drawn from the Profile). The subscription is no longer a credit bundle. It's "build your reading profile and try a new lens each month." See §17.0 for the strategic frame.

**Architecture changes.**
1. Generation runs **before payment** for cold traffic (new `generateForToolUnauth` callable). Output stored in `pendingReadings/{token}` with 24h TTL.
2. Stripe webhook **materializes the Firebase Auth account at purchase time**, claims the pending reading, sends a magic-link email.
3. Existing `/credits` + auth flow stays for **returning users**.

**Effort.** 4 working days, one engineer, end-to-end for all 11 readings (Phases 0–4 in §10).

**Success metric.** Cost-per-Purchase ≤ $25 within 14 days of launch. Anything above $30 → roll back ad routing.

**What we're explicitly NOT doing.** No fleeceware patterns. No fake countdowns. No hidden auto-renewal. No roach-motel cancel. Legitimate category mechanics only — see §6.2.

**Open decisions** (§11.2): $1 trial as primary or exit-only? Magic-link or forced password? GPT-4o-mini personalized headline or static fallback pool? — Founder calls these before launch.

---

---

---

## 0. About StoryInColor

**StoryInColor turns one of your photos into a personalized editorial reading.** A user uploads a single image — a selfie, a palm, an eye close-up, a handwritten note, an outfit photo — and receives a one-time, magazine-quality PNG that combines stylized imagery with reading-specific content (a palmistry guide, a Mian Xiang face report, an aura halo, a beauty score breakdown, a hairstyle grid, etc.). The output is designed to be kept and re-shared, not consumed and discarded.

**The catalog (11 readings).** Mystical/self-reflection: palm, face, aura, iridology, handwriting. Beauty/style: beauty report, hairstyle analysis, color analysis, skincare glow, style audit. Plus the free coloring page (turns any photo into printable line-art).

**The aesthetic.** Editorial — Vogue/GQ-leaning typography, generous whitespace, thin hairlines, rounded cards, a refined black-on-cream or black-on-white palette. Deliberately *not* Snapchat-filter or app-rating aesthetic. Each reading is presented as a single tall portrait spread (1024×1536) the user could plausibly frame.

**The framing.** All readings are presented as "for entertainment and self-reflection" — never as professional palmistry, medical iridology, dermatological skincare advice, or destiny prediction. The tone is editorial and reflective rather than mystical-prescriptive.

**The audience.** Primarily women, mostly US, mostly mobile. Acquisition is overwhelmingly paid Facebook/Instagram ads (the campaigns this spec is rebuilding the funnel for) plus organic search to the `/readings/<slug>` SEO surfaces.

**The business shape today.** Pay-per-reading. $9.99 single / $24 trio / $39 set-of-six credit packs. Free signup, zero free reading credits — every editorial reading is paid (the coloring page is the only free output). One credit equals one reading. Internal field name `credits`; user-facing wording always says "readings."

**The technology.** Next.js 15 static export deployed via GitHub Pages (storyincolor.com), with a thin layer of Firebase Cloud Functions for auth, generation, payments, and email. Image generation runs on OpenAI's `gpt-image-2` (with `gpt-image-1` for the coloring page line-art). One reading costs us $0.06–$0.25 in OpenAI fees; takes ~30 seconds to generate. Stripe Embedded Checkout handles payments. Firebase Auth handles sign-in (email/password + Google).

**Why this matters for the pivot.** The product is structurally a single durable artifact per upload — closer to a Truity personality report ($19–$29 one-time, multi-page PDF) than to a Nebula astrology subscription (daily content, ongoing transit calculations). That gravity has shaped the v1 pricing toward credit packs. The pivot in this spec asks: can we add a recurring layer (the Reading Profile + Daily Reflection in §17) that gives the same artifact-per-reading product a subscription rationale, without sacrificing the artifact's durability or the editorial aesthetic that's our actual brand differentiator?

---

## Table of contents

0. [About StoryInColor](#0-about-storyincolor)
1. [Why this pivot exists](#1-why-this-pivot-exists)
2. [Current state](#2-current-state)
3. [Target state — architecture overview](#3-target-state--architecture-overview)
4. [The standardized quiz framework](#4-the-standardized-quiz-framework)
5. [Per-reading quiz specifications (all 11)](#5-per-reading-quiz-specifications)
6. [The paywall](#6-the-paywall)
7. [Animations, micro-interactions, and copy systems](#7-animations-micro-interactions-and-copy-systems)
8. [Backend, data model, and Stripe](#8-backend-data-model-and-stripe)
9. [Analytics + success criteria](#9-analytics--success-criteria)
10. [Implementation plan + sequencing](#10-implementation-plan--sequencing)
11. [Risks + open questions](#11-risks--open-questions)
12. [Appendix A — competitor source material](#12-appendix-a--competitor-source-material)
17. [**Pricing strategy v2 (hybrid sub + packs + daily content)**](#17-pricing-strategy-v2--hybrid-subscription--credit-packs--daily-content)
18. [Appendix F — competitor pricing research](#18-appendix-f--competitor-pricing-research)

---

## 1. Why this pivot exists

We're running a **credit-store funnel** in a category dominated by **quiz funnels**. Every successful operator in this space — Nebula, Co-Star, BetterMe, Umax, Faceify, GlamAI, Noom, the entire mystical/AI-photo App Store top-grossing layer — converts cold paid traffic by:

1. Asking the user to do **15–30 micro-commitment screens** before any monetary ask
2. Showing the personalized result **partially / blurred** before the paywall (curiosity-gap pattern)
3. Capturing **email after the result is teased**, not before
4. Offering a **multi-tier paywall with a trial-priced entry point**, not a credit pack

StoryInColor today does none of these. Our funnel:

- Asks the user to create a full account **before** they've seen any value
- Generates the result **only after** payment (so we have no "blurred result" lever to trigger curiosity)
- Captures email at full sign-up (Firebase Auth user creation)
- Sells **credit packs** ($9.99 single / $24 trio / $39 set) — a SaaS-style pricing table that requires the user to project future demand they haven't formed yet

**Funnel data supporting the pivot** (astrology ad set, 2026-04-29 → 2026-04-30, $109.59 spent):

```
309 landing-page views
 ↓ 90% drop
 32 registrations         ← /login is doing its job
 ↓ 94% drop
  2 InitiateCheckouts
 ↓ 100% drop
  0 purchases
```

The drop from registration to checkout is the killer. Users register, see the credit-pack table at $9.99 minimum without having formed any commitment to the product, and bounce.

**This pivot is not optional.** The category dictates the funnel shape. Operators who try to sell mystical/AI-photo content without a quiz funnel either don't exist at scale or lose to those who do. A founder Reddit consensus, App Store top-grossing analysis, and FunnelFox's 2026 web2app teardown of 311 funnels all converge on the same pattern.

---

## 2. Current state

### 2.1 User flow today

```
Facebook ad
  → /readings/<slug>                    [marketing page, SEO surface]
    → tap "Start with this reading"
      → /login?register=true&next=/readings/<slug>
        → fill email/password/confirm
          → tap "Create account"
            → Firebase Auth user created
              → ensureUserCredits callable (FREE_CREDITS_PER_USER = 0)
                → /readings/<slug> [now signed-in, MarketingView hidden via CSS data-tool-auth]
                  → <ToolWorkflow> renders upload card with "Buy a reading" prompt
                    → tap "Buy a reading"
                      → /credits?next=/readings/<slug>
                        → pick a credit pack (single / trio / set)
                          → tap "Buy now"
                            → embedded Stripe Checkout modal
                              → submit payment
                                → Stripe webhook → /credits balance
                                  → redirect back to /readings/<slug>?credit_purchase=success
                                    → upload photo
                                      → generateForTool callable
                                        → photo deducted as 1 credit
                                          → OpenAI generation runs (~30s)
                                            → /readings/<slug>/result?jobId=<id>
                                              → Firestore polling for job.status === "complete"
                                                → final image displayed
```

**13 distinct decision points before first payment. 7 page navigations.**

### 2.2 Architecture today

| Concern | Where it lives | Notes |
|---|---|---|
| Tool inventory (client) | `lib/tools/registry.ts` | Display copy, FAQ, SEO, advisory `creditCost`. |
| Tool inventory (server, canonical) | `functions/src/tool-prompts.ts` | Real `creditCost`, prompt, OpenAI params. Server-only authority. |
| Marketing page | `app/readings/[slug]/page.tsx` mounting `<MarketingView>` + `<ToolWorkflow>` | One static HTML per slug; CSS toggles which is visible based on auth state. |
| Auth | `app/firebase/firebase-provider.tsx` | Firebase Auth (email/pw + Google). |
| Sign-up form | `app/login/page.tsx` | Email + password + confirm. Adds welcome email + CompleteRegistration event. |
| Credit purchase UI | `app/credits/page.tsx` | Pack list + embedded Stripe Checkout modal. |
| Credit ledger | `userCredits/{uid}` Firestore + `usageEvents` subcollection | Server-only writes. |
| Generation | `functions/src/generate-for-tool.ts` | Auth-required. Deducts credits before OpenAI call. Refund on failure. Stores output to `users/{uid}/generations/`. |
| Stripe checkout session | `functions/src/index.ts` `createCheckoutSession` | Embedded mode, `redirect_on_completion: 'if_required'`. |
| Stripe webhook | `functions/src/index.ts` `stripeWebhook` | Idempotent fulfilment. Lands credits in `userCredits/{uid}`. |
| Analytics | `lib/analytics/events.ts` + `functions/src/conversions/dispatch.ts` | Pixel + GA4 client + CAPI/MP server with shared `event_id`. |
| Attribution | `lib/attribution/capture.ts` + `lib/attribution/persist.ts` | First-touch / last-touch persisted to `users/{uid}` on sign-up. |

### 2.3 Why each step bleeds users

| Step | Drop cause |
|---|---|
| `/readings/<slug>` → `/login?register=true` | "Start" button reads as a transactional commitment with no product preview. Many users tap "Back" within 5s. |
| `/login?register=true` → submit | Email + password + confirm on mobile. Friction normal for category. ~70% complete (Clarity data). |
| `/login` → `/credits` | The biggest reframe: the user just registered to "see" the reading and instead lands on a credit-pack pricing table. The $9.99 anchor is shocking because the user has no comparison frame and no preview of what they're buying. **Largest single drop in our funnel.** |
| `/credits` → Stripe submit | Pack format requires future-demand projection. "Buy 6 readings for $39" is a worse offer than "Try one for $1" for cold traffic. |

---

## 3. Target state — architecture overview

### 3.1 Target user flow

```
Facebook ad
  → /quiz/<slug>                                    [PUBLIC, no auth]
    → Screen 1: Hook question      [1 tap, 5s]
      → Screen 2-4: Identity questions [3 taps, 20s]
        → Screen 5: Aspiration question [1 tap, 8s]
          → Screen 6: Reading-specific question [1 tap, 8s]
            → Screen 7: Photo upload [1 action, 15s]
              → Screen 8: Loading screen [theatre, 10-15s]
                → [server: temp generation + blurring runs in background]
                → Screen 9: Blurred reveal + headline insight + email field
                  → submit email
                    → Screen 10: Multi-tier paywall (single / trial-weekly / 6-pack)
                      → submit payment
                        → [server: Stripe webhook materializes account + claims pendingReading]
                        → Screen 11: Unblurred result
                          → optional account-finalization screen (set password / Google link)
                            → /dashboard
```

**Key changes from current:**

- `/quiz/<slug>` is **public** — no auth required to enter.
- Account creation **does not happen until purchase succeeds.** Email is captured separately, account materialized on Stripe webhook.
- Generation runs **before** payment. Output is stored in a `pendingReadings/{token}` doc and a corresponding `pending/{token}/output.png` Storage path with a short TTL.
- The blurred preview is the **monetization lever.** Users have already invested 60-90s + uploaded their face; the curiosity gap from seeing their result blurred is the conversion engine.

### 3.2 Routing strategy — old vs new surfaces

| Surface | Audience | Status |
|---|---|---|
| `/` landing page | Organic + brand | Keep as-is. SEO + returning users. |
| `/readings/<slug>` | Organic search | Keep as-is. SEO surface, ranks. |
| `/readings` reading-room index | Organic + signed-in users browsing | Keep as-is. |
| `/login` | Returning users + organic sign-up | Keep, but **paid ads no longer route here.** |
| `/credits` | Existing signed-in users buying more | Keep, but **becomes a returning-user surface only.** |
| `/dashboard`, `/dashboard/settings` | Signed-in users | Keep as-is. |
| **`/quiz/<slug>` (NEW)** | All paid ad traffic | **The new ad-LP for every reading.** |
| **`/quiz/<slug>/result/<token>` (NEW)** | Quiz completers (auth or unauth) | Blurred preview + paywall + post-payment unlock. |

**Ad routing:** every active ad's `link_data.link` is updated from `https://storyincolor.com/readings/<slug>?utm_*` → `https://storyincolor.com/quiz/<slug>?utm_*`. Old `/readings/<slug>` URLs continue to work for organic search; they just stop receiving paid clicks.

### 3.3 The four backend-architectural changes

Each is non-trivial. Listed in dependency order.

#### 3.3.1 Generation runs before payment (decoupled from credits)

Today: `generateForTool` requires auth + deducts a credit before generating. This must split into two paths:

- **Public path (new):** `generateForToolUnauth` — no auth required, no credit deduction. Inputs: `toolId`, `tempPhotoStoragePath` (under `pending/{token}/`), `quizAnswers` (optional, for downstream prompt enrichment / analytics). Output: writes to `pendingReadings/{token}` with `{ outputStoragePath, outputDownloadUrl, blurredOutputDownloadUrl, expiresAt, status }`. **Rate-limited per IP** (e.g. 5 reads / IP / 24h) since there's no credit gate.
- **Authed path (existing):** unchanged for returning signed-in users hitting `/dashboard` → tool workflow (the current flow continues to exist for repeat purchasers).

#### 3.3.2 Pending reading lifecycle

A new short-lived collection:

```ts
// Firestore: pendingReadings/{token}
{
  token: string;             // uuid, also the URL slug fragment
  toolId: string;
  status: "processing" | "ready" | "failed" | "claimed" | "expired";
  ipHash: string;            // for rate limiting + abuse tracing (sha256 of IP + salt)
  quizAnswers: Record<string, string>;
  inputStoragePath: string;  // pending/{token}/input.{ext}
  outputStoragePath?: string; // pending/{token}/output.png
  outputDownloadUrl?: string;
  blurredOutputDownloadUrl?: string;  // pending/{token}/blurred.jpg
  email?: string;            // captured at email screen
  emailCapturedAt?: Timestamp;
  fbEventId?: string;        // for Pixel/CAPI dedup at unlock
  createdAt: Timestamp;
  expiresAt: Timestamp;       // createdAt + 24h
  claimedByUid?: string;      // set when account is materialized post-payment
  claimedAt?: Timestamp;
}
```

**TTL:** 24h via Firestore TTL policy on `expiresAt`. After expiry, both Firestore doc and Storage assets are deleted by a scheduled cleanup function. (Firestore TTL deletes the doc; the Storage assets need a parallel scheduled function because Firestore TTL doesn't reach Storage.)

#### 3.3.3 Blurred preview generation

Server-side after the OpenAI generation completes, before writing the `pendingReadings` doc:

```js
// functions/src/generate-for-tool-unauth.ts
const fullBuf = Buffer.from(b64, "base64");
const blurredBuf = await sharp(fullBuf)
  .blur(35)                  // heavy blur
  .resize(800, 1200, { fit: 'inside' })
  .jpeg({ quality: 60 })
  .toBuffer();
// Save both: full version stays gated, blurred version is publicly readable
```

Storage rules: `pending/{token}/blurred.jpg` is publicly readable (it's blurred, low-resolution, and short-lived). `pending/{token}/output.png` requires the matching `pendingReadings/{token}` doc's `claimedByUid` to equal `request.auth.uid`.

#### 3.3.4 Account materialization at Stripe webhook

The Stripe Checkout Session is created with:

- Customer email pre-filled from the email captured at Screen 9
- Metadata: `{ pendingReadingToken, quizSlug, fbEventId }`

When `stripeWebhook` receives `checkout.session.completed`:

1. Look up `pendingReadings/{token}`. If missing → log warning, fulfilment fallback (still credit the email-only customer record).
2. Find or create a Firebase Auth user keyed on `email`.
3. Materialize `users/{uid}` doc with attribution from `pendingReadings.attribution` (captured at quiz entry).
4. Materialize `userCredits/{uid}` doc with the purchased credit count.
5. Mark `pendingReadings/{token}.claimedByUid = uid` and `status = claimed`.
6. Move `pending/{token}/output.png` → `users/{uid}/generations/{generationId}.png`.
7. Fire `Purchase` CAPI/MP with the shared `fbEventId`.
8. Email the user a magic-link to `/dashboard` (so they can sign in via email click without setting a password — Firebase passwordless email link sign-in).

The user's first sign-in experience after payment is a one-click magic link from email. Optional: at first dashboard load, show a "Set a password to make sign-in faster" prompt that's dismissable.

### 3.4 What stays the same

Don't pivot what isn't broken:

- `lib/tools/registry.ts` — keep, augment with `quiz` field.
- `functions/src/tool-prompts.ts` — keep, untouched.
- `lib/analytics/events.ts` — extend with new quiz events; existing events untouched.
- `lib/attribution/capture.ts` + `persist.ts` — extend to capture on quiz entry instead of (or in addition to) sign-up.
- Existing `/credits` purchase path for repeat buyers — keep.
- All admin tooling, generation prompts, OpenAI integration, Storage bucket structure for authed users — keep.

---

## 4. The standardized quiz framework

### 4.1 The 8-screen template

Every reading uses the same 8-screen template. Only the **per-screen content** varies. The framework is parameterized via a `QuizConfig` object per reading.

| # | Screen | Purpose | Time | User input |
|---|---|---|---|---|
| 1 | **Hook** | Frame intent in the user's own words | 5s | 1 tap (single-select) |
| 2 | **Identity A** | Self-descriptive validation | 7s | 1 tap (single-select, image choices preferred) |
| 3 | **Identity B** | Variation; visual question | 7s | 1 tap (single-select) |
| 4 | **Identity C** | Variation; emoji or scale | 7s | 1 tap (slider or pick) |
| 5 | **Aspiration** | What they want to learn | 8s | 1 tap (single-select) |
| 6 | **Reading-specific** | The only truly per-reading question | 8s | 1 tap (single-select) |
| 7 | **Upload** | Photo input (THE commitment device) | 15-30s | File pick / camera |
| 8 | **Loading + reveal + email** | Theatre, blurred reveal, email capture | 25s | Email field + submit |

Total median time: **~80-100 seconds** before the paywall. This is the sweet-spot range FunnelFox identifies for cold-traffic mystical/AI funnels — long enough to commit, short enough not to fatigue.

Then the paywall (Screen 9, separate route): one click to choose tier, one Stripe payment.

### 4.2 Visual grammar

- **One question per screen.** Never two.
- **Full-bleed dark background** (`bg-black`, matches existing site theme), single accent color (white) for selectable options.
- **Question typography:** large serif italic for the question (`text-3xl md:text-5xl`), regular sans for options (`text-base md:text-lg`).
- **Selectable options:** rounded pill cards with a left-aligned glyph (emoji or small icon), a label, and a subtle border. Tap → fills with white, text inverts, advances to next screen on the next animation frame (no separate "Next" button on single-select screens).
- **Progress bar:** thin (1px) horizontal at the very top of the screen. Fills 1/8, 2/8, … 7/8 across questions; resets at upload, fills again during the loader.
- **Back button:** top-left only, small ghost button. No "skip" button — the framework relies on completing.
- **Mid-quiz affirmations:** between screens 3↔4 and 5↔6, a 1.5s "Got it. We'll keep this in mind." card that fades in/out. Doesn't require a tap.
- **Color motif:** retains the existing brand cinematic dark palette so the funnel doesn't visually break with the rest of the site (returning users / brand recognition).

### 4.3 Component architecture

```
components/quiz/
├── QuizFlow.tsx              ← top-level, drives the screen sequence
├── QuizScreen.tsx            ← shared chrome (progress bar, back button, animations)
├── screens/
│   ├── HookScreen.tsx        ← Screen 1
│   ├── IdentityScreen.tsx    ← Screens 2-4 (parameterized by question)
│   ├── AspirationScreen.tsx  ← Screen 5
│   ├── SpecificScreen.tsx    ← Screen 6 (parameterized per reading)
│   ├── UploadScreen.tsx      ← Screen 7
│   ├── LoaderScreen.tsx      ← Screen 8a (the analyzing theatre)
│   ├── RevealScreen.tsx      ← Screen 8b (blurred result + email)
│   └── PaywallScreen.tsx     ← Screen 9 (separate route, post-email)
├── primitives/
│   ├── OptionCard.tsx        ← the rounded pill option (emoji + label)
│   ├── ImageOptionCard.tsx   ← image-grid option (used in Identity B)
│   ├── ProgressBar.tsx
│   ├── Affirmation.tsx
│   └── BlurredImage.tsx
└── hooks/
    ├── useQuizState.ts       ← in-memory + localStorage persistence
    └── useQuizAnalytics.ts   ← fires per-screen events
```

```
lib/quiz/
├── types.ts                  ← QuizConfig, Question, QuizAnswer types
├── registry.ts               ← QuizConfig per toolId (the per-reading content)
└── shared.ts                 ← shared identity questions used across multiple readings
```

```
app/quiz/
├── [slug]/
│   ├── page.tsx              ← loads QuizConfig by slug, renders QuizFlow
│   └── result/
│       └── [token]/
│           ├── page.tsx      ← reveal screen (blurred) + paywall + post-payment unblur
│           └── unlocked/
│               └── page.tsx  ← post-payment unblurred view + dashboard handoff
```

### 4.4 The QuizConfig schema

```ts
// lib/quiz/types.ts
export type QuestionOptionLayout = "pill" | "image-grid" | "emoji-grid";

export type Question = {
  id: string;                        // stable per reading, used in analytics
  prompt: string;                    // the question shown
  subPrompt?: string;                // optional small subtitle
  layout: QuestionOptionLayout;
  options: QuestionOption[];
  affirmationAfter?: string;         // 1-line "got it" copy shown 1.5s before next
};

export type QuestionOption = {
  id: string;                        // stable, e.g. "fade-up", "soft-curls"
  label: string;
  emoji?: string;                    // shown on pill layout
  imageSrc?: string;                 // shown on image-grid layout
  weight?: number;                   // optional scoring weight for downstream personalisation
};

export type LoaderStep = {
  label: string;                     // "Mapping facial geometry..."
  durationMs: number;                // visible duration; sum across steps == total loader time
};

export type RevealConfig = {
  headlineInsight: string;           // shown unblurred above the blurred image
  blurStrength: number;              // 25-50, sharp's blur sigma
  unlockCtaLabel: string;            // "Unlock my reading"
};

export type QuizConfig = {
  toolId: string;                    // matches Tool.id
  slug: string;                      // matches Tool.slug
  hook: Question;                    // Screen 1
  identityA: Question;               // Screen 2
  identityB: Question;               // Screen 3
  identityC: Question;               // Screen 4
  aspiration: Question;              // Screen 5
  specific: Question;                // Screen 6
  uploadHint: string;                // Screen 7 caption
  uploadInputAccept: string;         // mime types allowed
  loaderSteps: LoaderStep[];         // Screen 8a
  reveal: RevealConfig;              // Screen 8b
};
```

### 4.5 Shared questions

Three of the six pre-upload questions are **shared across all 11 readings**. They appear in `lib/quiz/shared.ts` and are referenced by every per-reading `QuizConfig`:

- **Identity A — "Which of these feels most like you right now?"** Image-grid of 4 mood photos (warm/contemplative/playful/grounded). 4 options. Same on every reading.
- **Identity C — "Where are you with self-discovery these days?"** Emoji-grid: 🌱 just starting / 🌿 always have been into it / 🌳 deep in it / 🤔 honestly not sure. 4 options. Same on every reading.
- **Aspiration — "What are you hoping to learn today?"** Pill list customized lightly per reading category but mostly shared.

Identity B + Specific are unique per reading.

### 4.6 Mid-quiz affirmation library

Shared pool, randomly selected per slot. **The first three lines are verbatim from Nebula** (per FunnelFox's web2app teardown — these are the canonical category-leading affirmations that the user has paid hundreds of millions of dollars to optimize). The rest are written in the same tonal register:

```
[Verbatim Nebula]
"You carry something rare within you."
"Awaken the mission your soul carries."
"Embrace your potential."

[StoryInColor-original, same register]
"Got it. We'll keep this in mind."
"Noted — this changes how we read your photo."
"You're more reflective than most people who take this."
"That tracks. We see this with people who notice the small things."
"Lock that in. The reading will lean here."
"Honest answer. We work better with those."
"Held. Your reading will reflect this."
"That's a thoughtful pick."
"That answer puts you in a less-common group."
"Recorded. Carrying forward."
"Your face holds patterns most people will never see."
"There's a story written across your features."
"What you're about to discover, very few have seen."
"Most people stop here. You went further."
"You're not like the others we've read."
"What you carry is older than you know."
"We see something we want you to see too."
```

After **sensitive disclosures specifically** (e.g. the beauty-report Identity B "How do you feel about yourself in photos?" or the iridology Specific question about feeling drained), use Noom's verbatim validation pattern:

```
[Verbatim Noom — adapted for tone]
"Thank you for sharing. That's an important (and hard) thing to admit."
"Glad you shared that. We'll handle this with care."
"We don't mean to pry. Your reading needs this."
```

Pulls from the pool with no repeats per session.

### 4.7 The Flo reassurance pattern (v2 enhancement)

Flo's pattern is to follow every quiz answer with a 1-line reassurance that **validates the answer is normal AND inserts a small product benefit relevant to the answer**. Example structure:

> *User answers: "I avoid being in photos"*
>
> Reassurance: "That's more common than you think — over 60% of people who take this say the same. We'll factor that into how we frame the reading: actionable, not judgemental."

For v1, we use generic affirmations from the pool above. For v2, build per-answer reassurance pairs (one per option in the bespoke per-reading questions) — this is the pattern that makes Flo's funnel one of the highest-converting in adjacent verticals (per Retention.blog).

---

## 5. Per-reading quiz specifications

For each of the 11 readings, here is the full per-screen spec. **Identity A, Identity C, and Aspiration are shared (see §4.5); only Identity B and the Specific question are bespoke per reading. Hook, Loader, and Reveal copy are also bespoke.**

For brevity, shared questions (A, C, Aspiration) are referenced by ID rather than re-spec'd in each section.

### 5.1 Palm Reading — `palm-reading`

| Screen | Content |
|---|---|
| **1. Hook** | "What pulled you toward palmistry today?" — 4 pills: 💔 *"A relationship moment"*, 🧭 *"A career or path question"*, 🌀 *"Just curiosity"*, 🌙 *"I read these for myself already"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "Which line on your hand catches your eye first?" — 4 image-pills with cropped hand-line illustrations: *Heart line*, *Head line*, *Life line*, *Fate line* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What would you most like the reading to clarify?" — 4 pills: ❤️ *"Love and relationships"*, 🛤 *"Career direction"*, 🌱 *"Personal growth"*, 🔮 *"What's coming next"* |
| **6. Specific** | "How dominant is your dominant hand?" — 4 pills: ✋ *"Strongly right-handed"*, 🤚 *"Strongly left-handed"*, 🤲 *"Mixed / use both for different things"*, 🤷 *"Not sure"* — *(palm tradition reads dominant hand for present, non-dominant for innate; this question is also a Forer-effect setup)* |
| **7. Upload** | "Open your dominant hand, palm up, in good light. One photo." — file/camera, JPG/PNG/WEBP, max 10MB |
| **8a. Loader** | 5 steps × 2.5s each: *"Reading the major lines…"*, *"Mapping the seven mounts…"*, *"Cross-referencing classical palmistry…"*, *"Composing your editorial spread…"*, *"Almost done…"* |
| **8b. Reveal headline** | "Your dominant line is the **{strongest_line_from_image}** — and it tells a specific story." (insight string is filled by GPT-4o-mini reading the result; default fallback: "Your palm reads more strongly than 73% of the hands we analyze.") |
| **8b. Unlock CTA** | "Reveal my full palm reading" |

### 5.2 Face Reading — `face-reading`

| Screen | Content |
|---|---|
| **1. Hook** | "What brings you to face reading?" — 4 pills: 🪞 *"Want to understand myself better"*, 🧭 *"Looking for direction"*, 🌟 *"Curious about Mian Xiang tradition"*, 🤔 *"Saw this somewhere and got curious"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "Which feature do people compliment you on most?" — 4 pills: 👀 *"Eyes"*, 😊 *"Smile"*, 🦴 *"Cheekbones / bone structure"*, 🤷 *"Honestly, no one really comments"* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "Which life palace are you most curious about?" — 4 pills: ❤️ *"Relationships and marriage"*, 💰 *"Career and wealth"*, 🏠 *"Home and family"*, 🌅 *"Future and travel"* |
| **6. Specific** | "How would you describe your face shape, honestly?" — 4 pills: ⭕ *"Round"*, 🟫 *"Square / strong jaw"*, 💎 *"Heart / oval"*, 🤔 *"Not sure"* |
| **7. Upload** | "A front-facing selfie, soft daylight, hair off the forehead. Relaxed expression." |
| **8a. Loader** | "Mapping the Five Officers…", "Charting the Twelve Palaces…", "Reading the forehead and life palace…", "Composing your report card…", "Final touches…" |
| **8b. Reveal headline** | "Your most expressive palace is **{name}** — and it shapes how others read you." (default fallback: "Your face reads in the top 12% for clarity of features.") |
| **8b. Unlock CTA** | "Reveal my Twelve Palaces report" |

### 5.3 Beauty Report — `beauty-report`

| Screen | Content |
|---|---|
| **1. Hook** | "Why are you here for an honest beauty read?" — 4 pills: 🪞 *"Curious how I score"*, 💄 *"Want grooming / styling tips"*, 📸 *"Improving my photos / dating profile"*, 🤝 *"Friends won't tell me the truth"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "How do you usually feel after seeing yourself in photos?" — 4 pills: 😌 *"Pretty good"*, 🤔 *"Mixed — depends on the photo"*, 😬 *"Not great, usually"*, 📵 *"I avoid being in photos"* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What's the most useful thing this could give you?" — 4 pills: 📊 *"An honest score"*, ✨ *"Specific things I could improve"*, 🌟 *"Strengths I should lean into"*, 📷 *"How to photograph better"* |
| **6. Specific** | "What's the one feature you'd change if you could?" — 5 pills: 👃 *"Nose"*, 👁 *"Eye area"*, 😬 *"Smile / teeth"*, 🦴 *"Jaw / bone structure"*, ❌ *"Wouldn't change anything"* — *(also a strong Forer setup: the answer becomes a callback in the reading)* |
| **7. Upload** | "Front-facing selfie, soft daylight, no heavy filter or makeup. The flatter the lighting, the better." |
| **8a. Loader** | "Reading bone structure…", "Measuring symmetry…", "Analyzing eye area…", "Reading skin and smile…", "Compiling your sub-scores…", "Done." (6 steps × 2.5s) |
| **8b. Reveal headline** | "Your overall score: **{score}/10** — and one of your sub-scores is in the top 15%." (the sub-score and number are filled from the actual generated card; default fallback: "Your overall score is in the upper third of the photos we've analyzed.") |
| **8b. Unlock CTA** | "Reveal my full beauty report" |

### 5.4 Aura Reading — `aura-reading`

| Screen | Content |
|---|---|
| **1. Hook** | "What pulls you toward aura work today?" — 4 pills: 🌈 *"Curious what colors I carry"*, 🧘 *"Working on energy / chakras"*, 🌀 *"Just exploring"*, 💫 *"I've done aura readings before"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "Which color are you instinctively drawn to today?" — color-grid: 🔴 Red, 🟠 Orange, 🟡 Yellow, 🟢 Green, 🔵 Blue, 🟣 Violet — *(this becomes a callback: "You picked violet — and your dominant aura layer reads violet. That's not coincidence.")* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What part of aura reading interests you most?" — 4 pills: 🎨 *"My dominant colors"*, 🌀 *"The seven layers"*, 🕉 *"My chakra connection"*, 🪞 *"What's blocking my energy"* |
| **6. Specific** | "What chakra would you guess feels most active for you right now?" — 7 pills with chakra colors: 🔴 *Root*, 🟠 *Sacral*, 🟡 *Solar plexus*, 💚 *Heart*, 💙 *Throat*, 💜 *Third eye*, 🤍 *Crown* |
| **7. Upload** | "A relaxed selfie against a plain light background. Soft even light gives the cleanest read." |
| **8a. Loader** | "Sensing your dominant frequency…", "Reading the seven auric layers…", "Mapping your chakra connections…", "Composing your halo…", "Almost there…" |
| **8b. Reveal headline** | "Your dominant aura is **{color}** — and it sits in your **{layer}** layer. That's a less-common combination." |
| **8b. Unlock CTA** | "Reveal my aura reading" |

### 5.5 Iridology — `iridology`

| Screen | Content |
|---|---|
| **1. Hook** | "What pulled you toward iris reading?" — 4 pills: 🧘 *"Holistic wellness curiosity"*, 👁 *"Always wondered what eyes can show"*, 🧬 *"Looking for self-knowledge"*, 🔬 *"Just exploring"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "What's your eye color?" — 5 pills with iris swatches: 🟫 Brown, 💚 Green, 💙 Blue, 🟤 Hazel, ⚪ Gray |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What would be most valuable to learn?" — 4 pills: 🌿 *"Wellness tendencies"*, 🧠 *"Personality traits"*, ⚡ *"Energy zones"*, 💧 *"Hydration and balance"* |
| **6. Specific** | "When did you last feel really energized?" — 4 pills: ☀️ *"Today"*, 📅 *"This week"*, 🗓 *"This month"*, 😴 *"Honestly, can't remember"* — *(answer becomes a callback in the reveal: "Your iris suggests stamina — and you said you can't remember last feeling energized. The reading speaks to that gap.")* |
| **7. Upload** | "A sharp close-up of one eye, well-lit. Phone macro mode in daylight works best." |
| **8a. Loader** | "Mapping iris zones…", "Reading the autonomic nerve wreath…", "Identifying lacunae and crypts…", "Composing your wellness card…", "Done." |
| **8b. Reveal headline** | "Your iris zones suggest a **{insight}** profile — with one zone in particular that stands out." (fallback: "Your iris pattern reads in a less-common configuration.") |
| **8b. Unlock CTA** | "Reveal my iris reading" |

### 5.6 Handwriting — `handwriting`

| Screen | Content |
|---|---|
| **1. Hook** | "Why a graphology read?" — 4 pills: ✍️ *"Curious what my handwriting says"*, 🪞 *"Self-knowledge"*, 🎁 *"For a friend / partner"*, 🔍 *"I love personality systems"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "How would you describe your handwriting?" — 4 pills: ✏️ *"Neat and consistent"*, 🌀 *"Fast and a little messy"*, 🎨 *"Decorative / expressive"*, 🤷 *"Honestly, illegible even to me"* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What part of the read interests you most?" — 4 pills: 🧠 *"Personality archetype"*, 💭 *"Emotional patterns"*, 🎯 *"Decision-making style"*, ✒️ *"What my signature says"* |
| **6. Specific** | "Right- or left-handed?" — 3 pills: ✋ Right, 🤚 Left, 🤲 Either / both |
| **7. Upload** | "A photo of a handwritten sample on plain paper. A few sentences plus your signature is ideal." |
| **8a. Loader** | "Reading the slant and baseline…", "Measuring pressure…", "Analyzing your signature…", "Matching to archetypes…", "Composing your card…" |
| **8b. Reveal headline** | "Your handwriting archetype is the **{archetype}** — under 8% of writers fit this profile cleanly." |
| **8b. Unlock CTA** | "Reveal my handwriting read" |

### 5.7 Style Audit — `style-audit`

| Screen | Content |
|---|---|
| **1. Hook** | "Why a style audit?" — 4 pills: 🛍 *"Refining how I dress"*, 🪞 *"Curious about my archetype"*, 🎯 *"Want to nail my personal style"*, 📸 *"For my dating / social profile"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "Which Vogue cover archetype feels most like you?" — image-grid 4 pills: *Classic*, *Romantic*, *Edgy*, *Minimalist* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What would be most useful?" — 4 pills: 🏷 *"My style archetype"*, 🎨 *"My best palette"*, 👗 *"Specific outfit feedback"*, 🛒 *"Wardrobe direction"* |
| **6. Specific** | "What's your closet ratio right now?" — 4 pills: ⚫ *"Mostly black/neutral"*, 🌈 *"Mostly color"*, 👕 *"Mostly basics"*, 🎭 *"Mostly statement pieces"* |
| **7. Upload** | "A full-body photo of your outfit, neutral background. Mirror selfies work fine." |
| **8a. Loader** | "Reading silhouette and proportion…", "Analyzing palette and fit…", "Matching your archetype…", "Composing your editorial…" |
| **8b. Reveal headline** | "Your closest archetype: **{archetype}** — and your palette is more **{undertone}** than most." |
| **8b. Unlock CTA** | "Reveal my style audit" |

### 5.8 Hairstyle Analysis — `hairstyle-analysis`

| Screen | Content |
|---|---|
| **1. Hook** | "What's behind the hair question right now?" — 4 pills: ✂️ *"Considering a big change"*, 🤔 *"Stuck in a rut"*, 💍 *"Big event coming up"*, 🪞 *"Just curious what would suit me"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "What's your current length?" — 4 pills: ✂️ *"Pixie / very short"*, 💇 *"Bob / lob"*, 👩 *"Shoulder-length"*, 👱‍♀️ *"Long"* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What do you most want to see?" — 4 pills: ✂️ *"Cuts that suit my face"*, 🎀 *"Bangs / fringe options"*, 🎨 *"Color ideas alongside cut"*, 🤩 *"A look I haven't tried"* |
| **6. Specific** | "What's your hair texture?" — 4 pills: 🌾 *Straight*, 🌊 *Wavy*, 🌀 *Curly*, ⛓ *Coily / kinky* |
| **7. Upload** | "Front-facing selfie, hair in its natural fall (or pulled back if it's curly). Soft daylight." |
| **8a. Loader** | "Reading your face shape…", "Mapping your hairline and forehead…", "Selecting cuts that suit your geometry…", "Rendering 8 styles on you…", "Composing your editorial spread…" |
| **8b. Reveal headline** | "Three of the eight cuts read strongly on your face shape — and one is unexpected." |
| **8b. Unlock CTA** | "See all 8 cuts on me" |

### 5.9 Color Analysis — `color-analysis`

| Screen | Content |
|---|---|
| **1. Hook** | "Why a personal color read?" — 4 pills: 👗 *"Building a wardrobe that works"*, 💄 *"Want to know my undertone"*, 🎁 *"Considering a House of Colour consult"*, 🪞 *"Just curious"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "Which color makes you feel most like yourself?" — color-grid: 6 swatches across warm/cool/jewel/pastel |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What would help most?" — 4 pills: 🎨 *"My best palette"*, 🌡 *"Warm vs cool undertone"*, 👚 *"Colors to avoid"*, 💎 *"Jewel tone or pastel?"* |
| **6. Specific** | "What's your hair color?" — 5 pills: 🟫 Brown, 🟡 Blonde, 🔴 Red, ⚫ Black, ⚪ Gray / silver |
| **7. Upload** | "Front-facing selfie in natural daylight. No heavy filters — they shift skin tone. Hair pulled back is ideal." |
| **8a. Loader** | "Reading your undertone…", "Comparing you in 8 palettes…", "Identifying which colors light you up…", "Composing your palette card…" |
| **8b. Reveal headline** | "Your undertone reads **{warm/cool/neutral}** — and three of the eight palettes really light you up." |
| **8b. Unlock CTA** | "See all 8 palettes on me" |

### 5.10 Skincare Glow — `skincare-glow`

| Screen | Content |
|---|---|
| **1. Hook** | "What's bringing you to a skin read?" — 4 pills: ✨ *"Want a routine that actually works"*, 🪞 *"Curious about my zones"*, 💧 *"Glow + hydration"*, 🛒 *"Picking products"* |
| **2. Identity A** | [shared] |
| **3. Identity B** | "What's your skin type?" — 4 pills: 💧 *Dry*, 💦 *Oily*, ⚖️ *Combination*, 🌷 *Sensitive* |
| **4. Identity C** | [shared] |
| **5. Aspiration** | "What would help most?" — 4 pills: ☀️ *"AM routine"*, 🌙 *"PM routine"*, 🎯 *"Targeting specific zones"*, 🛒 *"Product categories to focus on"* |
| **6. Specific** | "What's your top concern right now?" — 5 pills: 🔴 *Breakouts*, 🌑 *Dullness*, 〰️ *Texture*, 😴 *Under-eye*, 🟫 *Tone / pigmentation* |
| **7. Upload** | "Bare-face selfie in soft daylight. No filter, no makeup. Hair pulled back is ideal." |
| **8a. Loader** | "Reading your T-zone…", "Mapping cheeks and under-eye…", "Reading texture and glow…", "Composing your routine card…" |
| **8b. Reveal headline** | "Your **{zone}** is the most expressive zone — and we have a specific routine framework for it." |
| **8b. Unlock CTA** | "Reveal my skincare card" |

### 5.11 Coloring Page — `coloring-book`

The coloring page is **free** (`creditCost: 0`) and is treated as a **funnel exit**, not a paywall path. The quiz funnel does not apply. This reading remains accessible only post-account-creation via `/dashboard` and the existing `/readings/coloring-book` surface, with the daily cap of 3 free generations enforced server-side.

**Reasoning:** Per DECISIONS.md, we do not market the coloring page as free. Routing paid ad traffic to it would (a) violate that rule, (b) earn zero ad-attributable revenue, and (c) pollute the conversion-event signal Meta is optimizing on. Coloring-page acquisition stays organic + dashboard-only.

---

## 6. The paywall

### 6.0 Verbatim copy patterns we are intentionally borrowing

Every line in this paywall has a documented source from a million-dollar app. Citations attached so future iterations know what's load-bearing vs decorative:

| Element | Our copy | Source |
|---|---|---|
| Headline above blurred image | "Your reading is ready" | Universal pattern (Nebula, Noom, Flo, Zoe, Curology all use "ready" / "results" framing). |
| Sub-text personalization line | The headline insight from §5.x reveal copy | Pattern: Nebula's "Only 3% of users have Starseed marks" — rarity + identity hook. |
| Tier 2 (highlighted) badge | "Most popular" | Apphud paywall study: "Most Popular" / "Popular" is the universal verbatim badge. |
| Trust line above CTA | "Trusted by 12,400+ readings generated" | Pattern: Umax's "Trusted by 1,000,000+ people" / Noom's "We've helped 3,627,436 people lose weight". Hyper-precise number is the lift; we round-up start at 12,400. |
| Guarantee line | "30-day satisfaction guarantee" | Pattern: Spotify "Cancel anytime", category-standard reassurance. |
| Single CTA verb | "Unlock my reading" | Pattern: Apphud — "Continue" / "Subscribe now" / "Start" universal; "Unlock" is GlamAI/FaceApp pattern for AI-photo specifically (FunnelFox AI paywall optimization). |
| Email capture CTA | "See my reading" | Verbatim Noom: "See my results"; verbatim BetterMe: "Get My Plan". |
| Email field micro-copy | "Where should we send your reading?" | Canonical phrasing per RightMessage / ConvertFlow / Involve.me quiz-funnel literature. |
| Exit-intent headline | "Wait — your reading is sitting right here." | StoryInColor original; in same register as Nebula's exit-intent €1 trial drawer. |

### 6.1 The three-tier paywall (Screen 9, separate route)

Replaces `/credits` for new-user funnel traffic. `/credits` keeps existing pack list for repeat purchases.

```
┌──────────────────────────────────────────────────────┐
│  Your reading is ready                               │  ← unblurred headline insight
│  Your dominant aura is Violet — and it sits in       │     from §5.x reveal copy
│  your celestial layer.                               │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ blurred  │  │ blurred  │  │ blurred  │           │  ← 3 cropped sections of the
│  │ result   │  │ result   │  │ result   │           │     blurred result, hinting
│  └──────────┘  └──────────┘  └──────────┘           │     at the full image
│                                                      │
│  Choose how you want to unlock it:                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │  ← TIER 1 (decoy / anchor)
│  │  This reading only                           │   │
│  │  $9.99  one-time                             │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │  ← TIER 2 (highlighted, target)
│  │  ⭐ This reading + 2 more — 20% off           │   │     "Most popular"
│  │  $24   ($8 each, save $5.97)                 │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │  ← TIER 3 (volume anchor)
│  │  This reading + 5 more — 35% off              │   │
│  │  $39   ($6.50 each, save $20.94)             │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  💎 Trusted by 12,400+ readings generated           │  ← social proof
│  🛡 30-day satisfaction guarantee                    │  ← reassurance
│  💳 Visa · Mastercard · Apple Pay · Google Pay      │
│                                                      │
│  [ ──────  Unlock my reading  ────── ]               │  ← single CTA, opens Stripe
└──────────────────────────────────────────────────────┘
```

**Why this beats the current `/credits` table:**

- The headline insight is **unblurred and personal** — the user's own result is the headline above the price.
- 3 blurred crops of the user's actual image as visual anchor (not generic samples).
- **Anchor + decoy pattern** (Superwall million-dollar-app pattern #1): tier 1 makes tier 2 look like the obvious choice; tier 3 makes tier 2 look modest.
- **Value-stack** (pattern #2) implicit in the "+ N more" framing.
- **Social-proof line** (pattern #3) directly above the buy button.
- **Soft commitment** (pattern #4): no subscription, no auto-renewal — just a one-time purchase. This is the lowest-risk variant of the category playbook (we explicitly opt out of fleeceware patterns; see §11).

### 6.2 What we are NOT doing (and why)

Per founder direction + DECISIONS.md style, we explicitly opt out of:

- **Auto-renewing subscriptions disguised as trials.** Documented across the App Store as "fleeceware" (Avast/Bitdefender/Kaspersky reports). Effective but reputationally costly and chargeback-prone on web (where Stripe sides with the consumer).
- **Fake countdown timers that reset.** Documented as net-negative long-term across RevenueCat / Superwall research.
- **Fake real-time social-proof popups** ("Sarah from Texas just bought…"). User-hostile and high-risk.
- **Roach-motel cancellation.** Single most-complained-about pattern in the category.

We are using the **legitimate** category patterns — anchored pricing, value stack, real social proof, blurred reveal, exit-intent downsell — and skipping the dishonest ones. This is a deliberate competitive differentiation: we can compete on funnel mechanics without inheriting the App Store reputation tax.

### 6.3 Exit-intent downsell

When user attempts to dismiss the paywall (back button, tab close attempt, or 60s of inactivity on the paywall), a one-time sheet appears:

```
┌────────────────────────────────────────────┐
│  Wait — your reading is sitting right here.│
│                                            │
│  Try it for $1.                            │
│  Single-issue, one-time. No subscription.  │
│                                            │
│  [   Unlock for $1   ]   [ No thanks ]     │
└────────────────────────────────────────────┘
```

This is shown **at most once per pendingReadingToken** (stored in localStorage keyed on token). Re-attempting checkout doesn't re-show it.

**Mechanics of the $1 trial:**

- Stripe Checkout Session with `line_items: [{ price: PRICE_ID_DOLLAR_TRIAL, quantity: 1 }]`.
- One credit lands in the user's account.
- This becomes their first purchase. The webhook materializes the account exactly as a normal purchase.
- The $1 credit pack is **NOT** advertised on the main paywall — only as the exit downsell. This is a price-discrimination tactic: users who would pay $9.99 do so; users who would have bounced are recovered at $1.

### 6.4 Post-payment unblur sequence

After Stripe webhook confirms payment:

1. The frontend (paywall page) is polling `pendingReadings/{token}.status` via Firestore listener. When `status === "claimed"`, it transitions.
2. The blurred image fades out over 0.6s.
3. The full unblurred image fades in over 0.6s with a subtle scale-up from 0.98 → 1.00.
4. A confetti burst (single short animation, no looping, mute by default) fires once.
5. The headline updates: "Here's your full reading" + [download / save to dashboard buttons].
6. A magic link email is dispatched to the email captured at Screen 9 with subject *"Your reading is saved — open your library"*.

If the user lingers on this screen, after 8s a soft prompt slides up from the bottom: *"Want this saved? Set a password and we'll keep it in your library."* Tap → 1-field password setup → user is fully signed in → `/dashboard`.

---

## 7. Animations, micro-interactions, and copy systems

### 7.1 Per-screen transitions

- **Quiz screen → next quiz screen:** old screen slides up + fades out (200ms ease-out), new screen slides up + fades in (250ms ease-out, 50ms delay). Single direction (always up). No back-direction animation; back button instantly switches without animation to keep users moving forward.
- **Tap on option:** option pill scales 1.00 → 0.97 → 1.02 over 200ms (haptic feedback on iOS Safari via `navigator.vibrate(8)` if supported), then fills with white + advances.
- **Affirmation card:** appears centered, fades in over 300ms, holds 1.5s, fades out over 300ms while next screen prepares.
- **Progress bar:** fills the increment over 400ms with a slight overshoot (`cubic-bezier(.34,1.56,.64,1)`).

### 7.2 Loader screen specifics

- **Full-bleed dark background** with a centered minimal spinner (rotating 1px ring, 32px diameter).
- **Progress bar** at top continues filling from quiz state (4/8 → 8/8 across the loader steps).
- **Loader steps** appear one at a time, current step bold + white, completed steps fade to 30% opacity, upcoming steps invisible. Each step shows a small `✓` when done.
- **Sub-message rotation:** every 4s a small italic line cycles below the steps. Pool: *"This usually takes 12–18 seconds."*, *"We use the highest-fidelity model for this."*, *"Hand-tuning your reading."*, *"Almost there."*
- **Server-side actual generation** runs in parallel. **Loader shows minimum 12s** even if generation finishes earlier — anticipation matters more than speed (Noom's documented learning). If generation finishes after 12s, loader continues honestly until done.
- **Hidden requirement:** if generation fails server-side, loader pauses on the current step, shows a soft retry message: *"Hmm — that didn't render cleanly. Trying once more."* and silently retries once. Second failure: *"We couldn't read that photo. Try a different one."* with a back button.

### 7.3 Reveal screen specifics

- **The blurred image is the centerpiece.** Sized to occupy roughly 70% of viewport height on mobile, with the headline insight + email field below.
- **Blur strength:** Sharp `blur(35)` is the default; for hairstyle/color (which are visual-grid outputs), use `blur(45)` because individual cell content is more recognizable through light blur.
- **Subtle "shimmer" overlay** on the blurred image — a CSS gradient that slowly animates left-to-right (3s loop), suggesting the image is "loading in" even though it's static. Increases perceived value of unlocking.
- **Headline insight typography:** large serif italic, single line preferred, two lines maximum.
- **Email field:** inline below the headline. Single field, autocomplete=email, autoFocus on mount. Submit on Enter or button tap.
- **Below the email field:** small grey copy *"We'll send your reading here too. No spam."*
- **Submit transitions** to the paywall route in the same window (no new tab, no modal — full-screen route change).

### 7.4 Paywall transitions

- **Tier cards:** on hover (desktop) or tap-and-hold (mobile), card scales to 1.02 with a subtle shadow lift. Tap-release selects the tier (radio behavior).
- **Selected tier** gets a white inner ring + filled "MOST POPULAR" tag.
- **Unlock button** is sticky to the bottom on mobile (`position: sticky; bottom: 0`) with a subtle gradient fade behind it so it never feels like the user is missing it.
- **On Unlock click:** button shrinks to spinner, embedded Stripe Checkout opens in a modal (existing `<EmbeddedCheckoutModal>` pattern from `app/credits/page.tsx`).

### 7.5 Copy systems shared across all 11 readings

The **reveal headline** is the most important copy in the funnel. It must be unique, personal, and create curiosity. Two paths to generate it:

- **Path A (preferred):** A small post-generation server step uses GPT-4o-mini to read the generated reading text/structure and output a 1-2 sentence "headline insight" string. Cost ~$0.0002/reading. Adds ~1.5s to total generation time.
- **Path B (fallback if Path A fails or is skipped for cost):** Use a per-reading static headline pool (5-10 variants per reading) with a randomly selected one. Less personal but always works.

Per-reading headline pools (Path B):

```ts
const HEADLINE_FALLBACKS: Record<string, string[]> = {
  "palm-reading": [
    "Your dominant line tells a story most palms don't.",
    "One of your mounts is more pronounced than 80% of palms we read.",
    "Your hand reads in a less-common configuration.",
    "Your fate line says something specific about timing.",
    "Three of your four major lines share a pattern.",
  ],
  "face-reading": [
    "Your face reads in the top 12% for clarity of features.",
    "One of your Twelve Palaces is unusually expressive.",
    "Your dominant Officer is more prominent than most.",
    "Your face shape sits in a Mian Xiang archetype.",
    "Two of your features echo each other strongly.",
  ],
  // ... [all 11 specified inline]
};
```

(Full pools are defined in `lib/quiz/registry.ts`.)

### 7.6 Trust micro-copy library (used on paywall + reveal)

- "Trusted by **{count}**+ readings generated" — `count` updated weekly from Firestore aggregation; display at least the order of magnitude that's true. Start at 12,400.
- "30-day satisfaction guarantee — refund within 30 days, no questions asked"
- "Secure checkout via Stripe · Apple Pay · Google Pay"
- "We never share your photo. Used only for your reading. Auto-deleted from temp storage after 24h."

---

## 8. Backend, data model, and Stripe

### 8.1 New Cloud Functions

| Function | Purpose | Auth | Trigger |
|---|---|---|---|
| `generateForToolUnauth` | Run a generation against `pendingReadings/{token}` for a non-authed user. | None (rate-limited by IP). | Callable from `/quiz/<slug>` after upload. |
| `captureQuizEmail` | Idempotent email + attribution capture against `pendingReadings/{token}`. | None. | Callable from reveal screen after email submit. |
| `createQuizCheckoutSession` | Like existing `createCheckoutSession` but: (a) takes `pendingReadingToken` instead of authed userId, (b) uses captured email as customer email, (c) embeds metadata for webhook claim. | None. | Callable from paywall after tier select. |
| `cleanupExpiredPendingReadings` | Scheduled. Deletes `pendingReadings` docs + `pending/<token>/` Storage paths past `expiresAt`. | None. | Cloud Scheduler, every 6h. |

The **existing** `generateForTool`, `createCheckoutSession`, `stripeWebhook`, `ensureUserCredits` all stay — they handle the existing-user path (returning users hitting `/dashboard` → `/credits`).

### 8.2 Modifications to existing functions

| Function | Change |
|---|---|
| `stripeWebhook` (`functions/src/index.ts`) | Add a branch: if `session.metadata.pendingReadingToken` present, run the **claim-and-materialize** flow (look up pending reading, find/create Firebase Auth user keyed on email, materialize `users/{uid}` + `userCredits/{uid}`, claim the pending reading, move output, fire `Purchase` CAPI). |

### 8.3 Storage rules changes

```
match /pending/{token}/{file=**} {
  // Anyone can write to a pending path during the unauth quiz flow
  // (size + content-type constraints prevent abuse).
  allow create: if request.resource.size < 10 * 1024 * 1024
                && request.resource.contentType.matches('image/.*');
  // Blurred output is publicly readable
  allow read: if file == 'blurred.jpg';
  // Full output requires the pendingReading to be claimed by the requester
  allow read: if file == 'output.png'
              && request.auth != null
              && firestore.get(/databases/(default)/documents/pendingReadings/$(token))
                          .data.claimedByUid == request.auth.uid;
  // No update or delete by clients.
  allow update, delete: if false;
}
```

### 8.4 Firestore rules changes

```
match /pendingReadings/{token} {
  // Public create from the quiz (Cloud Function only, enforced by the function not writing direct from client)
  allow read, write: if false;  // all access via Cloud Functions
}
```

### 8.5 Stripe — new prices

Add three new prices in Stripe matching the new tier structure (the pack mapping is identical to current packs but with new metadata):

| Price ID label | Amount | Description | Used on |
|---|---|---|---|
| `price_quiz_single_999` | $9.99 | Anchor tier on paywall | Paywall tier 1 |
| `price_quiz_trio_2400` | $24.00 | Highlighted target tier | Paywall tier 2 |
| `price_quiz_set_3900` | $39.00 | Volume anchor tier | Paywall tier 3 |
| `price_quiz_dollar_trial_100` | $1.00 | Exit-intent downsell only | Exit drawer |

Pricing **identical to current `/credits`** for tiers 1-3 (so existing-user pricing isn't disrupted). The $1 trial is genuinely new.

### 8.6 Email capture — privacy + GDPR

Email captured at Screen 9 is **stored on `pendingReadings/{token}` regardless of purchase outcome.** This is technically email collection from non-authed users, with these safeguards:

- Email is auto-deleted with the pending reading at 24h TTL if no purchase happens.
- The submit field has a checkbox copy (NOT pre-checked): *"OK to send marketing emails. Required: only your reading + receipt."* — required emails fire either way; marketing only if checked.
- Privacy policy updated with a "What happens to my email if I don't pay?" section.

### 8.7 Account materialization on Stripe webhook

```ts
// Inside stripeWebhook, on checkout.session.completed:
const token = session.metadata?.pendingReadingToken;
if (token) {
  const pending = await db.collection('pendingReadings').doc(token).get();
  if (!pending.exists) return; // expired? log + fallback
  const email = pending.data()!.email;
  // 1. Find or create Firebase Auth user
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    userRecord = await admin.auth().createUser({ email, emailVerified: false });
  }
  const uid = userRecord.uid;
  // 2. Materialize users/{uid}
  await db.collection('users').doc(uid).set({
    email,
    attribution: pending.data()!.attribution || {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sourceFlow: 'quiz',
    sourceQuizSlug: pending.data()!.toolId,
  }, { merge: true });
  // 3. Materialize userCredits/{uid}
  // (use existing helpers; subtract the 1 credit consumed by the
  // pending generation so the balance reflects "credits LEFT" cleanly)
  // 4. Move pending output to user's permanent storage
  await bucket.file(pending.data()!.outputStoragePath)
    .move(`users/${uid}/generations/${generationId}.png`);
  // 5. Mark pending claimed
  await pending.ref.update({ claimedByUid: uid, claimedAt: ts, status: 'claimed' });
  // 6. Send magic-link email
  const link = await admin.auth().generateSignInWithEmailLink(email, {
    url: `https://storyincolor.com/dashboard`, handleCodeInApp: true,
  });
  await sendMagicLinkEmail({ email, link });
  // 7. Fire Purchase CAPI/MP with the shared fbEventId from pending
  await dispatchServerConversion({
    name: 'Purchase',
    eventId: pending.data()!.fbEventId || `srv-purchase-${session.id}`,
    customData: { /* ... */ },
  }, { uid, email, /* attribution */ });
}
```

---

## 9. Analytics + success criteria

### 9.1 New events

In addition to existing events in `lib/analytics/events.ts`:

| Event | Fires on | Properties |
|---|---|---|
| `QuizStarted` | Screen 1 mount | `slug`, `referrer`, `utm_*` |
| `QuizQuestionAnswered` | Each option select | `slug`, `questionId`, `optionId`, `screenIndex` |
| `QuizPhotoUploaded` | Upload submit | `slug`, `pendingReadingToken`, `fileSize` |
| `QuizGenerationStarted` | Server, after upload | `slug`, `pendingReadingToken` |
| `QuizGenerationCompleted` | Server, after generation | `slug`, `pendingReadingToken`, `durationMs` |
| `QuizRevealShown` | Reveal screen mount | `slug`, `pendingReadingToken` |
| `QuizEmailCaptured` | Email submit | `slug`, `pendingReadingToken`, `email_hash` |
| `QuizPaywallShown` | Paywall screen mount | `slug`, `pendingReadingToken` |
| `QuizPaywallTierSelected` | Tier card click | `slug`, `pendingReadingToken`, `tierId` |
| `QuizExitIntent` | Exit-intent drawer shown | `slug`, `pendingReadingToken` |
| `QuizPurchase` | Stripe webhook completion | `slug`, `pendingReadingToken`, `tierId`, `revenue` (this maps to existing Pixel `Purchase`) |

All Pixel/CAPI dedup uses a single `fbEventId` minted at `QuizStarted` and threaded through to `QuizPurchase`.

### 9.2 Funnel chart (admin dashboard)

Extend `getAdminDashboardData` to surface the quiz funnel as a parallel view to the existing reg-to-purchase funnel:

```
QuizStarted    → 1000  (100%)
PhotoUploaded  →   650  (65%)   ← Drop A: did the quiz scare them
RevealShown    →   620  (62%)   ← Drop B: generation failures
EmailCaptured  →   430  (43%)   ← Drop C: email reluctance
PaywallShown   →   430  (43%)
TierSelected   →   180  (18%)   ← Drop D: price reaction
Purchase       →    95  (9.5%)  ← Drop E: payment friction
```

Per-slug breakdown of the same.

### 9.3 Success criteria — what counts as "this worked"

The astrology baseline was **0 purchases from 32 registrations.** Even a small absolute number of purchases is a directional win.

| Metric | 7-day target | 14-day target | Decision tree |
|---|---|---|---|
| Quiz completion rate (Started → Photo Uploaded) | ≥ 50% | ≥ 60% | <40% → quiz too long, cut to 5 questions |
| Reveal → Email capture rate | ≥ 60% | ≥ 70% | <50% → email field UX problem |
| Email capture → Paywall view | ≥ 95% (auto-advance) | same | <90% → JS error somewhere |
| Paywall → Purchase | ≥ 5% | ≥ 8% | <3% → tier structure wrong; try $1 trial as primary |
| Cost-per-Purchase from ads | ≤ $25 | ≤ $15 | >$30 → roll back; pivot to quiz approach 2.0 |

**Headline lift target:** if cost-per-Purchase comes in below $25 within 14 days, the pivot is validated. Below $15 = clear win, scale.

### 9.4 Rollback criteria

If after 14 days at 1+ active ad set:

- Cost-per-Purchase > $30, OR
- Quiz completion rate < 30%, OR
- Major bug rate > 5% of sessions (Sentry / Clarity errors)

→ **Roll back the ad routing.** Quiz funnel code stays in place (no data loss; we learned). Ads point back to `/readings/<slug>`. Diagnose, iterate, re-launch.

---

## 10. Implementation plan + sequencing

### 10.1 Phase 0 — preparation (0.5 day)

Before writing any quiz code:

- [ ] Create new branch `quiz-funnel-pivot` off main.
- [ ] Add new Firestore collection `pendingReadings` with TTL policy on `expiresAt` (Firebase console).
- [ ] Add Stripe price `price_quiz_dollar_trial_100` ($1.00, one-time).
- [ ] Decide on shared image assets for Identity A (4 mood photos) — generate via the existing `scripts/generate-sample.mjs` pattern, save under `public/images/quiz/mood-{warm|contemplative|playful|grounded}.webp`.

### 10.2 Phase 1 — backend (1 day)

- [ ] `lib/quiz/types.ts` — schema definitions.
- [ ] `lib/quiz/shared.ts` — shared questions A, C, Aspiration.
- [ ] `lib/quiz/registry.ts` — all 11 `QuizConfig` objects (per-reading content from §5).
- [ ] `functions/src/generate-for-tool-unauth.ts` — new callable.
- [ ] `functions/src/quiz-checkout.ts` — `createQuizCheckoutSession` + email capture callable.
- [ ] `functions/src/cleanup-pending-readings.ts` — scheduled cleanup.
- [ ] `functions/src/index.ts` — register the new callables; extend `stripeWebhook` with the claim-and-materialize branch.
- [ ] `functions/src/quiz-shared.ts` — IP rate-limiter helper (using Firestore counter doc per IP-hash).
- [ ] Storage rules + Firestore rules updated.
- [ ] Deploy to staging Firebase project; smoke-test the unauth generate path with curl.

### 10.3 Phase 2 — frontend (1.5 days)

- [ ] `components/quiz/primitives/*` — base UI components.
- [ ] `components/quiz/screens/*` — all 8 screens.
- [ ] `components/quiz/QuizFlow.tsx` — orchestrator.
- [ ] `components/quiz/hooks/useQuizState.ts` — in-memory state + localStorage persistence.
- [ ] `components/quiz/hooks/useQuizAnalytics.ts` — fires the new events.
- [ ] `app/quiz/[slug]/page.tsx` — entry route, loads QuizConfig, renders QuizFlow.
- [ ] `app/quiz/[slug]/result/[token]/page.tsx` — reveal + paywall.
- [ ] `app/quiz/[slug]/result/[token]/unlocked/page.tsx` — post-payment view.
- [ ] Wire to existing `<EmbeddedCheckoutModal>`.

### 10.4 Phase 3 — analytics + admin (0.5 day)

- [ ] `lib/analytics/events.ts` — add the 11 new event helpers.
- [ ] `functions/src/admin-dashboard.ts` (or wherever `getAdminDashboardData` lives) — add quiz funnel breakdown.
- [ ] Verify all events flow to Pixel + GA4 + Clarity smart-event.

### 10.5 Phase 4 — ads + go-live (0.5 day)

- [ ] Update all ad creatives' `link_data.link` from `/readings/<slug>` to `/quiz/<slug>` (3 active beauty/hair v2 ads to start; once validated, all astro ads when re-activated).
- [ ] Update all astro ad-set ads similarly when their parent ad set re-activates.
- [ ] Final smoke test in production: incognito → click ad → complete quiz → upload → see blurred result → enter email → see paywall → use Stripe test card → verify Purchase event fires + account materialized + magic-link email arrives.
- [ ] Flip `production` flag if any.
- [ ] Watch for the first 24h.

### 10.6 Phase 5 — iteration (post-launch, ongoing)

Based on the funnel data:

- A/B test: 6-question quiz vs 8-question quiz.
- Per-reading headline insight quality (Path A GPT-4o-mini vs Path B static pools).
- Mid-quiz affirmation copy variants.
- Loader step copy variants.
- A/B test: blur strength (sharp 35 vs sharp 45) — recoverable signal at the reveal screen.
- A/B test: email capture timing (reveal screen vs mid-quiz Q3 vs after upload).
- **"Send me my reading later" checkbox at the reveal screen** — for users who decline the paywall but consent to receive the reading by email after a delay. Recovers list-quality from non-converters; gives a re-engagement hook 24-48h later. Trivial UI work. Worth shipping in v2.1.5 once the v1 quiz funnel proves out.
- Three-tier sub variant test (add a 3-month plan between monthly + annual, mirroring Nebula's structure) — only if monthly-to-annual conversion is materially weaker than the broader-category pattern.
- **Identity-hook ad creative test** — Nebula's highest-volume ads (per the 308k-ad LinkedIn analysis) never mention the brand name; they lead with hooks like *"Signs your starseed is awakening"*. Test ad creatives that lead with the *insight tease* rather than the *product name*. Example for our hairstyle reading: *"Three cuts that read strongest on your face shape — and one is unexpected."* No "StoryInColor" in the headline. Brand reveal happens on the post-click landing page (the quiz). This is a paid-social creative pattern, not a code change; queue it for the next ad-creative refresh cycle.

### 10.7 Total estimated effort

**4 working days** for one engineer to ship Phases 0-4 end-to-end at production-ready quality. Could compress to 3 days if some quality polish is deferred (e.g., the exit-intent drawer ships in week 2, magic-link email simplification ships later).

### 10.8 What we are NOT building in v1

- **Account-finalization flow.** Magic link → dashboard works fine. "Set a password" prompt is a v2 polish.
- **Returning-user "skip the quiz" detection.** If a user with an existing email comes back through the quiz, they go through it again. The pendingReading doc just doesn't materialize a duplicate account at webhook time (existing user found by email lookup).
- **Multi-reading bundle pricing.** Tiers stay at the same prices as current packs.
- **Quiz answer → prompt enrichment.** The quiz answers are captured in `pendingReadings.quizAnswers` for analytics + future use, but the OpenAI prompt is unchanged in v1. (Future: enrich the prompt with quiz answers — "User picked 'right-handed', 'curious about love'" → prompt the model to lean into those.)
- **Shareable result cards.** Existing share-link code on `result-view.tsx` already handles authed users; the unblurred unlocked-quiz page uses the same flow.

---

## 11. Risks + open questions

### 11.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Generation cost spike** — unauth users abuse the free `generateForToolUnauth` path. | Medium | High ($0.06-$0.25/call × 1000s of calls) | IP rate limit (5/IP/24h); `pendingReadings.ipHash` for tracing; require minimum 4 quiz answers before allowing generation; CloudFlare WAF rules if it gets bad. |
| **Email scraping** — bots fill the email field with garbage to flood `pendingReadings`. | Low-Medium | Low | Don't render the email field server-side; require client JS; honeypot field; rate-limit `captureQuizEmail` per IP. |
| **Stripe webhook delays** — payment succeeds but webhook takes 5+ seconds, user sees blurred result longer than expected. | Medium | Medium | Existing pattern: client polls `pendingReadings/{token}.status` via Firestore listener and transitions when `claimed`. Spinner with reassuring copy during the wait. |
| **Account materialization conflicts** — user A's email matches user B's existing account. | Low | High (account hijack risk) | Email lookup is canonical; if existing user is found, the purchase associates with that user (correct behavior). Existing user gets the new credit + new pending reading claimed. They're notified by email. |
| **Magic link delivery failures** — user pays but doesn't receive the email. | Medium | Medium | UI on the unlocked page shows "Open in dashboard" button that triggers a re-send, plus a fallback "I have a password" link to standard `/login`. |
| **Quiz fatigue** — 8 screens too many, completion drops below 40%. | Low-Medium | Medium | Easy v2 fix: cut to 6 screens (drop Identity B + C, keep only A). |
| **Ad-creative-mismatch** — the new transactional ads now lead to a quiz, not a marketing page. Click-through expectations might shift. | Low | Low | Test by comparing CTR on the new URL vs old URL within first 48h. |

### 11.2 Open questions for the founder

These are decisions the spec needs but the founder should make:

1. **$1 trial — primary tier or exit-intent only?** Spec defaults to exit-intent only (preserve $9.99 anchor for users who'd pay it). Reasonable alternative: make $1 the headline tier and convert volume aggressively. Decide before launch.
2. **Magic-link first-sign-in vs "set password" required?** Spec defaults to magic-link (lowest friction). Alternative: force password setup at first dashboard load. Decide before launch.
3. **Quiz completion as a CAPI event?** Spec captures it as `QuizPhotoUploaded` for analytics only. Could mirror to Meta as a custom event (`QuizCompleted`) and re-train the optimization toward quiz-completers if registration-completers prove insufficient signal. Defer until 7-day data is in.
4. **Refund policy enforcement.** Spec advertises "30-day satisfaction guarantee, no questions asked" on the paywall. Currently there is no automated refund flow in `functions/src/credit-ledger.ts` for purchases (only for failed generations). Founder must decide: manual handling (founder approves each via Stripe dashboard), or build automated self-service refund in v2.
5. **Headline insight — Path A (GPT-4o-mini personalization) or Path B (static pools)?** Path A is ~$0.0002/reading and 1.5s slower; Path B is free + instant but less personal. Spec defaults to Path B for v1 simplicity. Recommend Path A for v2 once funnel is proven.
6. **Coloring-page promotion in the quiz funnel?** Spec excludes coloring page entirely from the paid funnel (DECISIONS.md compliance). Could revisit if cost-per-purchase struggles — coloring page as a free hook before quiz is unconventional but possible. Default: leave excluded.

### 11.3 What this spec does not address

- **SEO impact** of new `/quiz/<slug>` routes — they're added to robots.txt as `Disallow: /quiz/` since they're paid funnel surfaces, not search surfaces. Existing `/readings/<slug>` SEO is untouched.
- **A11y review.** Each screen needs aria labels, keyboard nav, focus management. Standard practice; should not block ship.
- **Internationalization.** All copy is English-only in v1. The audience is US/UK English-speaking; expansion is a separate workstream.
- **Dark/light mode toggle.** Quiz uses dark theme only, matching the brand cinematic aesthetic. No light-mode parity in v1.

---

## 12. Appendix A — competitor source material

(Compiled from a comprehensive 2026-05-04 research pass — see also Appendix E below for the full extracted verbatim copy library, and the master source list at the end of this section.)

### Primary sources

- **Nebula** (~$700K/mo iOS, OBRIO) — onboarding analyzed via [Adapty paywall library](https://adapty.io/paywall-library/nebula-horoscope-astrology/) and [Retention.blog](https://www.retention.blog/p/whats-your-sign-part-2). 30-screen quiz, mid-quiz affirmations, palm scan as commitment, blurred reveal, multi-tier paywall with €1 / €5 / €9 / €13.67 trial price discrimination, exit-intent €1 downsell.
- **Umax** (men's face-rating) — [ScreensDesign breakdown](https://screensdesign.com/showcase/umax-become-hot). Two separate selfie uploads (front + side) as commitment device. Blurred scores with friend-invite-to-unlock fallback.
- **Noom** — [Lazer 14 product lessons](https://www.lazertechnologies.com/insight/14-product-lessons-from-nooms-online-quiz). Loading bars with data visualizations cited as +10-20% conversion lift.
- **BetterMe** — [Adapty paywall library](https://adapty.io/paywall-library/betterme/). Dozens of separate funnels per persona.
- **FunnelFox 2026 patterns** — [311-funnel analysis](https://blog.funnelfox.com/web2app-funnel-patterns-2026/). Documents "20-60 screens" as the sweet-spot range.
- **Stormy AI playbook** — [Quiz funnel playbook](https://stormy.ai/blog/perspective-quiz-funnel-playbook-2026). Quizzes 47.3% conversion vs 2.8% for static forms; +60% web-to-app lift.
- **Superwall — 5 paywall patterns of $1M+/mo apps** — [source](https://superwall.com/blog/5-paywall-patterns-used-by-million-dollar-apps/). Anchor & Decoy, Value Stack, Social Proof, Soft Commitment, Now-or-Never.
- **GlamAI / FaceApp paywall pattern** — [FunnelFox AI paywall optimization](https://blog.funnelfox.com/ai-paywall-optimization/). Blurred hero image with "Unlock your photos" CTA documented as the dominant AI-photo paywall pattern.

### Psychology research

- **Forer/Barnum effect** — [Wikipedia](https://en.wikipedia.org/wiki/Barnum_effect). Forer 1948 study: generic personality blurb rated 4.30/5.00 for accuracy when framed as personalized.
- **Information-gap theory (curiosity gap)** — Loewenstein 1994. [Summary](https://impulsebuyingpsychology.com/curiosity-gap/). Knowing the answer exists about you specifically creates dopaminergic drive to resolve.
- **Female mystical-content engagement** — [Refinery29](https://www.refinery29.com/en-us/2018/01/186791/millennials-astrology-spirituality-magick-popularity), [Stylist UK](https://www.stylist.co.uk/astrology/millennial-women-horoscopes/188250). Self-authority and anxiety-regulation framings dominate.

### Anti-patterns documented

- **App Store fleeceware** — [Avast](https://press.avast.com/free-trial-for-only-3432-per-year-avast-discovers-new-fleeceware-apps-on-the-google-play-and-apple-app-stores), [Bitdefender](https://www.bitdefender.com/en-us/blog/hotforsecurity/fleeceware-25-play-store-apps-that-empty-your-pockets), [Kaspersky](https://usa.kaspersky.com/blog/beware-of-fleeceware/18904/). Hidden auto-renewal + roach-motel cancel + 3-day-trial-then-$40-week is the dominant App Store pattern. We explicitly opt out.
- **Dark patterns** — [Deceptive.design](https://www.deceptive.design/), [Hall of Shame](https://hallofshame.design/). EU Commission 2022: 97% of popular apps use ≥1 dark pattern. We use the legitimate subset (anchored pricing, value stack, exit-intent), skip the user-hostile ones (fake countdowns, fake social proof, hidden auto-renewal, roach-motel cancel).

---

## 13. Appendix B — worked TypeScript example for one reading

This is a complete, copy-pasteable `QuizConfig` for the **Aura Reading** flow, showing exactly how the data shape from §4.4 instantiates. All 11 readings live in `lib/quiz/registry.ts` in this same shape.

```ts
// lib/quiz/registry.ts — partial (aura-reading example)
import type { QuizConfig } from "./types";
import { sharedIdentityA, sharedIdentityC, sharedAspirationGenericMystical } from "./shared";

export const auraReadingQuiz: QuizConfig = {
  toolId: "aura-reading",
  slug: "aura-reading",

  hook: {
    id: "aura-hook",
    prompt: "What pulls you toward aura work today?",
    layout: "pill",
    options: [
      { id: "curious-colors",   label: "Curious what colors I carry", emoji: "🌈" },
      { id: "energy-chakras",   label: "Working on energy / chakras", emoji: "🧘" },
      { id: "exploring",        label: "Just exploring",              emoji: "🌀" },
      { id: "experienced",      label: "I've done aura readings before", emoji: "💫" },
    ],
    affirmationAfter: "Got it. We'll keep this in mind.",
  },

  identityA: sharedIdentityA,

  identityB: {
    id: "aura-instinct-color",
    prompt: "Which color are you instinctively drawn to today?",
    subPrompt: "Trust the first one your eyes land on.",
    layout: "image-grid",
    options: [
      { id: "red",    label: "Red",    imageSrc: "/images/quiz/swatches/red.webp" },
      { id: "orange", label: "Orange", imageSrc: "/images/quiz/swatches/orange.webp" },
      { id: "yellow", label: "Yellow", imageSrc: "/images/quiz/swatches/yellow.webp" },
      { id: "green",  label: "Green",  imageSrc: "/images/quiz/swatches/green.webp" },
      { id: "blue",   label: "Blue",   imageSrc: "/images/quiz/swatches/blue.webp" },
      { id: "violet", label: "Violet", imageSrc: "/images/quiz/swatches/violet.webp" },
    ],
    affirmationAfter: "That answer puts you in a less-common group.",
  },

  identityC: sharedIdentityC,

  aspiration: {
    id: "aura-aspiration",
    prompt: "What part of aura reading interests you most?",
    layout: "pill",
    options: [
      { id: "dominant-colors", label: "My dominant colors",        emoji: "🎨" },
      { id: "seven-layers",    label: "The seven layers",          emoji: "🌀" },
      { id: "chakra-map",      label: "My chakra connection",      emoji: "🕉" },
      { id: "blocks",          label: "What's blocking my energy", emoji: "🪞" },
    ],
  },

  specific: {
    id: "aura-active-chakra",
    prompt: "What chakra would you guess feels most active for you right now?",
    subPrompt: "First instinct is fine — there's no wrong answer.",
    layout: "pill",
    options: [
      { id: "root",          label: "Root",          emoji: "🔴" },
      { id: "sacral",        label: "Sacral",        emoji: "🟠" },
      { id: "solar-plexus",  label: "Solar plexus",  emoji: "🟡" },
      { id: "heart",         label: "Heart",         emoji: "💚" },
      { id: "throat",        label: "Throat",        emoji: "💙" },
      { id: "third-eye",     label: "Third eye",     emoji: "💜" },
      { id: "crown",         label: "Crown",         emoji: "🤍" },
    ],
    affirmationAfter: "Locked in. The reading will lean here.",
  },

  uploadHint: "A relaxed selfie against a plain light background. Soft even light gives the cleanest read.",
  uploadInputAccept: "image/jpeg,image/png,image/webp",

  loaderSteps: [
    { label: "Sensing your dominant frequency…",      durationMs: 2400 },
    { label: "Reading the seven auric layers…",        durationMs: 2400 },
    { label: "Mapping your chakra connections…",        durationMs: 2400 },
    { label: "Composing your halo…",                    durationMs: 2400 },
    { label: "Almost there…",                           durationMs: 2400 },
  ],

  reveal: {
    headlineInsight: "Your dominant aura is **{color}** — and it sits in your **{layer}** layer.",
    blurStrength: 35,
    unlockCtaLabel: "Reveal my aura reading",
  },
};
```

The shared questions live in `lib/quiz/shared.ts`:

```ts
// lib/quiz/shared.ts
export const sharedIdentityA: Question = {
  id: "shared-mood",
  prompt: "Which of these feels most like you right now?",
  layout: "image-grid",
  options: [
    { id: "warm",          label: "Warm",          imageSrc: "/images/quiz/mood/warm.webp" },
    { id: "contemplative", label: "Contemplative", imageSrc: "/images/quiz/mood/contemplative.webp" },
    { id: "playful",       label: "Playful",       imageSrc: "/images/quiz/mood/playful.webp" },
    { id: "grounded",      label: "Grounded",      imageSrc: "/images/quiz/mood/grounded.webp" },
  ],
  affirmationAfter: "That tracks.",
};

export const sharedIdentityC: Question = {
  id: "shared-self-discovery",
  prompt: "Where are you with self-discovery these days?",
  layout: "emoji-grid",
  options: [
    { id: "starting",     label: "Just starting",            emoji: "🌱" },
    { id: "longtime",     label: "Always have been into it", emoji: "🌿" },
    { id: "deep",         label: "Deep in it",                emoji: "🌳" },
    { id: "not-sure",     label: "Honestly not sure",         emoji: "🤔" },
  ],
};

// Per-reading variants of "what are you hoping to learn?" — see registry.ts
```

The full registry exports the same shape for all 11 readings. Adding a new reading is a single ~60-line config object — no new code.

---

## 14. Appendix C — copy library

> **Universal copy principle (added v2.1):** **Abstract for strategy, concrete for paywall.** Internal positioning may use the three-layer narrative ("Artifact / Profile / Practice", "self-discovery membership"); user-facing surfaces — especially the paywall — use concrete tangible benefits ("Unlock today's reading. Get 3 new visual readings each month."). Never put strategic narrative into paywall bullet points; users at the paywall are staring at a blurred image and want to know what they get for $14.99, not what business we think we're in. See §17.0 for the full principle.

### 14.1 Email captured at Screen 9 — UI text

> **Source:** "Where should we send your results?" is the canonical quiz-funnel phrasing per quiz-funnel-builder literature (RightMessage, ConvertFlow, Involve.me). "See my reading" submit button mirrors verbatim Noom ("See my results") and verbatim BetterMe ("Get My Plan"). The reassurance line "We don't mean to pry" is verbatim Noom from sensitive-input screens.

Above the field:
> **Where should we send your reading?**

Sub-text:
> We'll save it to your library here too. We don't share your email with anyone.

Field placeholder: `name@example.com`

Submit button: **See my reading**

Below the field, opt-in checkbox (NOT pre-checked):
> Email me about new readings and updates. (Optional — your reading will arrive either way.)

### 14.2 Magic-link email — sent on first purchase

**Subject:** Your reading is saved — open your library

**Body (HTML):**
- Header: "Your reading is ready. Open your library to keep it forever."
- Single-button CTA: "Open my library" → magic-link URL → `/dashboard`
- Below button: "This link signs you in instantly — no password needed. You can set one any time in settings."
- Footer: standard transactional footer (matches existing email-service.ts dark editorial palette).

### 14.3 Exit-intent drawer copy

**Title:** Wait — your reading is sitting right here.

**Body:** Try it for $1. Single-issue, one-time. No subscription, nothing renews.

**Primary CTA:** Unlock for $1
**Secondary CTA:** No thanks

### 14.4 Failure-recovery copy

When the OpenAI generation fails (already in `generate-for-tool.ts`, mirrored for the unauth path):

**First retry (silent):**
> Hmm — that didn't render cleanly. Trying once more.

**Second failure:**
> We couldn't read that photo. Try a different one — front-facing, soft daylight, no heavy filter.

Buttons: **Upload a different photo** | **Use a stock sample**

(The "stock sample" option is NEW: it lets the user proceed with a sample photo to see the funnel through to the paywall. They get a generic reading rather than a personalized one. Optional; defer to v2 if this complicates Phase 1.)

### 14.5 Unblurred reveal screen copy

**Headline:** Here's your full reading.

**Sub-text:** Saved to your library — re-open any time.

**Buttons:**
- Primary: **Open my library** → `/dashboard`
- Secondary: **Download** → triggers PNG download
- Tertiary: **Share** → existing share-link flow

**Soft-prompt slide-up after 8s:**
> Want this saved across devices? Set a password and we'll keep your library accessible from anywhere.

[Set password] [Maybe later]

### 14.6 Loader sub-message rotation pool

These rotate every 4 seconds during the loader. Same pool used across all readings:

- "Hand-tuning your reading."
- "This usually takes 12–18 seconds."
- "We use the highest-fidelity model for this."
- "Almost there."
- "Your reading is being composed by GPT image-2."
- "Drawing the contour line-art."
- "Editorial-quality output — slower than fast, faster than studio."
- "Your photo never leaves our servers unencrypted."

### 14.7 Reading-specific reveal-headline fallback pools

(Path B, used if Path A GPT-4o-mini personalization is skipped.)

```ts
// lib/quiz/reveal-headlines.ts
export const HEADLINE_FALLBACKS: Record<string, string[]> = {
  "palm-reading": [
    "Your dominant line tells a story most palms don't.",
    "One of your mounts is more pronounced than 80% of palms we read.",
    "Your hand reads in a less-common configuration.",
    "Your fate line says something specific about timing.",
    "Three of your four major lines share a pattern.",
  ],
  "face-reading": [
    "Your face reads in the top 12% for clarity of features.",
    "One of your Twelve Palaces is unusually expressive.",
    "Your dominant Officer is more prominent than most.",
    "Your face shape sits in a Mian Xiang archetype that's less common.",
    "Two of your features echo each other strongly.",
  ],
  "beauty-report": [
    "Your overall score is in the upper third of photos we've analyzed.",
    "One of your six sub-scores is in the top 10%.",
    "Your bone structure reads more strongly than your other features.",
    "Your skin and smile sub-scores point in the same direction — and it's a strength.",
    "Your face reads better in this light than most in similar lighting.",
  ],
  "aura-reading": [
    "Your dominant aura is rare for someone who picked this color.",
    "Your seven layers don't follow the typical sequence.",
    "Your chakra map suggests one strong center and one quieter one.",
    "Your aura colors echo your chosen color — that's not coincidence.",
    "Your reading sits in a less-common configuration.",
  ],
  "iridology": [
    "Your iris zones suggest a less-common wellness profile.",
    "One zone in your iris stands out.",
    "Your collarette is more defined than most.",
    "Your iris pattern reads in a configuration we don't see often.",
    "Your reading speaks to something specific about your energy.",
  ],
  "handwriting": [
    "Your handwriting archetype fits under 8% of writers cleanly.",
    "Your slant and pressure tell a consistent story.",
    "Your signature character is more pronounced than your daily writing.",
    "Three of your traits all point to the same archetype.",
    "Your baseline trend is unusually steady.",
  ],
  "style-audit": [
    "Your archetype is one of the rarer four.",
    "Your palette undertone is more decisive than most.",
    "Your silhouette and palette agree — and that's a strength.",
    "Your closet ratio fits a specific style logic.",
    "Your archetype has clear dress codes that suit you.",
  ],
  "hairstyle-analysis": [
    "Three of the eight cuts read strongly on your face shape — and one is unexpected.",
    "Your face shape opens up cuts most people can't pull off.",
    "Your strongest fit is one most people don't try first.",
    "Two of the eight options are strong; the rest split.",
    "Your face geometry suits cuts in a specific style family.",
  ],
  "color-analysis": [
    "Your undertone reads cleaner than most — and three palettes really suit you.",
    "Your best palette is one most people don't guess for themselves.",
    "Your skin tone, hair, and eyes agree on undertone — that's an advantage.",
    "Two of the eight palettes light you up; six don't.",
    "Your undertone places you in a clear seasonal family.",
  ],
  "skincare-glow": [
    "One zone of your face is doing more work than the others — and we have a routine for it.",
    "Your T-zone and cheeks read differently — and it shapes your routine.",
    "Your texture suggests one specific category of treatment.",
    "Your under-eye reads softly — that's a less-common starting point.",
    "Your skin sits in a routine archetype we have a clear framework for.",
  ],
};
```

---

## 15. Appendix D — pre-launch checklist

To be checked off before flipping the first ad URL to `/quiz/<slug>`:

### Backend
- [ ] `pendingReadings` Firestore collection created with TTL on `expiresAt`
- [ ] `pending/` Storage path rules deployed
- [ ] `generateForToolUnauth` deployed and smoke-tested with `firebase functions:shell`
- [ ] `captureQuizEmail` deployed
- [ ] `createQuizCheckoutSession` deployed
- [ ] `cleanupExpiredPendingReadings` deployed + scheduled
- [ ] `stripeWebhook` extended with claim-and-materialize branch and tested with Stripe test events
- [ ] IP rate-limit working (verified by hitting the unauth endpoint 6× in rapid succession from same IP — 6th request returns 429)

### Stripe
- [ ] `price_quiz_dollar_trial_100` created in Stripe production ($1.00 one-time)
- [ ] Existing `price_quiz_single_999`, `price_quiz_trio_2400`, `price_quiz_set_3900` verified active
- [ ] Webhook endpoint receiving events from production Stripe (verified in Stripe dashboard)

### Frontend
- [ ] `/quiz/[slug]` route renders for all 11 readings without errors
- [ ] All Identity A mood photos exist at `/public/images/quiz/mood/*.webp`
- [ ] All Identity B per-reading swatches/images exist where required
- [ ] Animations smooth on iPhone SE 2 (slowest mass-market device)
- [ ] `localStorage` quiz state persistence working — refresh mid-quiz returns to current screen
- [ ] Email field opens iOS keyboard with `inputmode="email"`
- [ ] Camera capture works on iOS Safari + Chrome Android
- [ ] Embedded Stripe Checkout opens cleanly within paywall route
- [ ] Post-purchase unblur transition smooth, no flash-of-blurred-image after `claimed`

### Analytics
- [ ] All new events in §9.1 fire in Pixel + GA4 + Clarity (verify via Pixel Helper + GA4 DebugView + Clarity Recordings)
- [ ] Shared `fbEventId` flows from `QuizStarted` → `QuizPurchase` (verify in Meta Events Manager → Test Events with deduplicated marker)
- [ ] Admin dashboard quiz funnel renders for staging data

### Ads
- [ ] At least one ad creative's `link_data.link` updated to `/quiz/<slug>?utm_*`
- [ ] Verified the new URL preserves all existing UTM params end-to-end into `pendingReadings.attribution`

### Legal / Privacy
- [ ] Privacy policy section "What happens to my email if I don't pay?" published
- [ ] Email opt-in checkbox is NOT pre-checked
- [ ] DECISIONS.md updated with the quiz-funnel pivot record

### Smoke test (final)
- [ ] Incognito browser → click ad → land on `/quiz/<slug>` → complete all 8 screens → see blurred reveal → submit email → see paywall → use Stripe test card 4242 4242 4242 4242 → see unblurred reveal → click "Open my library" → magic link arrives in test inbox → click → land in `/dashboard` with the saved reading + 0 credits remaining (1 was used by the pending generation)
- [ ] Same test with a fresh email but where Firebase Auth user with that email already exists → existing user is found, existing `users/{uid}` updated, reading materialized into their library
- [ ] Exit-intent flow: complete quiz, get to paywall, attempt to dismiss → exit drawer appears → click $1 → paywall recomputes with single tier at $1 → completes test purchase

---

---

## 16. Appendix E — verified competitor copy library

This appendix captures the verbatim wording I borrowed from category-leading apps. **Anything in quotation marks is verbatim from the cited source.** Anything else is my paraphrase of structure/pattern.

### 16.1 Nebula (astrology) — the canonical reference

**Funnel structure (verified via FunnelFox 2026 web2app teardown + ScreensDesign):**
- 27-30 quiz screens (some web variants reach 50+)
- Progress bar showing "27 steps"
- Categories: birth date/time/place, "what are you looking for guidance on (love, career, work, etc.)", eye color, image-interpretation prompts, metaphysics, higher purpose, death/mortality, relationship status. Last screens: birth date entry → palm scan ("a meaningful action that's hard to mentally undo")
- Multi-trial-price WTP segmentation: "€1 / €5 / €9 / €13.67"
- Exit-intent: hidden €1 trial appears when user attempts to dismiss paywall

**Verbatim Nebula affirmations (from FunnelFox):**
- "You carry something rare within you"
- "Awaken the mission your soul carries"
- "Embrace your potential"

**Verbatim Nebula rarity copy (from FunnelFox):**
- "Only 3% of users have Starseed marks" (reveal screen, immediately before paywall — used to make user feel different/special)

**Verbatim Nebula in-app reading copy (from Mindbodygreen review):**
- "unlock my cosmic path"
- "you radiate lunar energy"
- "expect emotional shifts this month"
- "reveal your truth"
- Tab labels: "Horoscopes, Psychics, Compatibility, Chatroom, and Readings"
- Compatibility categories: "love, sex, family, and friendship"
- Energy life-area set: "career, love life, health, and family"

**Verbatim Nebula web landing (asknebula.com):**
- Headline: "Start your self-discovery journey today by completing our quiz and receiving a tailored plan just for you"
- Trust metrics: "20 million happy users", "93% accuracy rating", "4.7/5 stars satisfaction"
- Quiz invitation: "Take a short quiz to help us suggest advisors who fit your journey, or skip it and explore our psychic website on your own."

### 16.2 Noom (wellness) — the canonical reference for long-form quiz

**Funnel structure (verified via The Behavioral Scientist + RevenueCat full teardown):**
- 47 question screens documented in order
- Mid-quiz: "Behavioral Profile slider quiz" with 10 statement-pair sliders
- Email gate after quiz: "See my results"
- Paywall mechanic: "Pay what you want" trial with cost-transparency framing

**Full Noom question sequence (verbatim, from The Behavioral Scientist):**
1. "What is your weight loss goal?" — option includes "I haven't decided yet"
2. "Sex and hormones impact how our bodies metabolize food. Which sex best describes you?"
3. "What gender do you identify with?"
4. "What's your current weight?" — reassurance: "We don't mean to pry, we just need to know."
5. "Your daily schedule and routines can affect your weight. How would you describe your lifestyle?"
6. "Which of the below best describes your current status? Are you at risk of any of the following?"
7. "Do you have an active diagnosis of an eating disorder?"
8. "As a man in your 30s, environment can play a major role…" (note: question text dynamically inserts age + gender)
9. "What's the ideal weight that you want to reach?"
10. "Which of the below best describes your current priorities?"
11. "What area do you want to focus on in your plan?"
12. "Having something to look forward to can be a big motivator… Do you have an important event coming up?"
13. "What is your main reason for wanting to lose weight? Please choose what is most important."
… (full list available in source)

**Verbatim Noom mid-quiz reassurance (from Retention.blog teardown):**
- After weight reveal: "Thank you for sharing. That's an important (and hard) first step"
- After health-conditions multi-select: "We're really glad you shared. Noom's mission is helping people get healthier"
- Under sensitive fields: "We don't mean to pry, we just need to know"

**Verbatim Noom social proof (from RevenueCat):**
- "We've helped 3,627,436 people lose weight" — note hyper-precise number is part of the lift mechanic
- "at least 2%" weight loss embedded result-floor guarantee

**Verbatim Noom email gate CTA:**
- "See my results"

### 16.3 Umax (face rating) — the canonical reference for the AI-photo paywall

**Funnel structure (verified via ScreensDesign + Superwall + Adapty):**
- 6 onboarding screens, soft paywall (no free trial)
- Order: gender → social proof → front selfie → side selfie → blurred result → paywall OR "Invite 3 Friends" viral unlock
- Result rating system: FIFA/Madden-style player cards with 6 factors
- Scoring categories include: "Jawline", "Masculinity" (verified Superwall); industry-reported additional categories: skin, eyes, potential, overall

**Verbatim Umax trust copy (from ScreensDesign):**
- "Trusted by 1,000,000+ people" — sandwiched between gender selection and selfie capture (positioned to build trust right before the high-friction selfie ask)

**Verbatim Umax IAP names (from Adapty paywall library):**
- "You as a 10/10" — $6.99 one-time IAP. **The product is named as the desired outcome** — this is a copy mechanic worth stealing.
- "Weekly Premium" $3.99-9.99
- "Monthly Premium" $9.99-24.99
- "Supercharge" $3.99
- "LEVEL UP" — premium carousel name

### 16.4 LooksMax AI / PSL (looksmaxxing) — secondary reveal-blur reference

**Funnel structure (verified via ScreensDesign showcases):**
- Onboarding opens with "carousel of sample AI-generated ratings"
- Front + side photo upload (commitment device)
- Invite code screen + "Invite Friends" growth lever
- **Apple in-app review prompt at ~00:18** (controversial pattern — surfaces before paywall)
- Primary paywall: previews rating categories before triggering native StoreKit subscription. 3-day free trial → weekly subscription
- **Secondary FOMO paywall (verbatim ScreensDesign):** results blurred behind paywall with "a live counter of 'people just revealed their results.'"
- Secondary monetization: one-time payment for "AI hairstyle transformations" for users who won't subscribe

### 16.5 BetterMe — wellness quiz reference (web-quiz public)

**Funnel structure (from AppFuel + live quiz walk):**
- 26 questions split across Profile / Activity / Lifestyle / Nutrition
- Interactive 3D avatar for selecting target body areas
- No required email to access app
- Comprehensive product tour AFTER paywall
- Outcome promise: "Get visible results in 4 weeks"

**Verbatim BetterMe live quiz (verified via quiz.betterme.world):**
- Header on calisthenics quiz: "CALISTHENICS WORKOUT PLAN ACCORDING TO YOUR AGE"
- Subhead: "1-MINUTE QUIZ"
- Age options: "Age: 18-29", "Age: 30-39", "Age: 40-49", "Age: 50+"
- Consent: "By choosing your age and continuing you agree to our Terms of Service | Privacy Policy"

**Verbatim BetterMe primary CTA:**
- "Get My Plan"

### 16.6 Flo (period tracking) — the "every answer gets a reassurance" pattern

**Verified pattern (from Retention.blog Flo deep-dive):**
- 70 onboarding screens (up to 400 with goal-branching)
- Three top-level goals branching the entire flow: "period tracking, conception planning, or pregnancy monitoring"
- Universal reassurance pattern: every answer gets a follow-up explaining "this is normal and they're healthy" + a relevant Flo benefit insertion

**Verbatim Flo trust copy:**
- "90% of users say Flo accurately predicts the start of their period"

**Verbatim Flo trial mechanic (from Medium teardown):**
- "£1" trial vs "£14.61" — extreme price contrast as anchoring

### 16.7 Zoe (gut microbiome) — mid-quiz reveal pattern

**Verified pattern (from Medium teardown):**
- 15-20 questions
- Mid-quiz **insight reveals as teaser stats**: "11% chance that I had a friendly parasite correlated with less body fat" — drops mid-stream to keep user invested
- Email gate: required "in order to see the results of the quiz"

### 16.8 Curology (skincare intake) — eligibility-gated quiz

**Verbatim Curology live signup (from app.curology.com):**
- Headline: "Get a personalized formula from a licensed dermatology provider"
- Section header: "First, let's see if you're eligible for Curology."
- Offer: "Try Curology FREE* for 30 days when you subscribe + get 2 FREE gifts—just cover $5.45 S&H"
- Consent: "I agree to the Terms of Service, Privacy Policy and Telehealth Consent."
- CTA: "Next" / "Already have a Curology account? Log in"

### 16.9 HairHunt (AI hairstyle try-on) — relevant to our hairstyle reading

**Verbatim from App Store description:**
- The quiz "unlock[s] a custom set of hairstyles carefully selected for your unique facial structure, proportions, and hair characteristics"

**The framing borrow:** the quiz becomes "the key that unlocks your personalized set" rather than "data collection." We can apply this to all 11 of our readings.

### 16.10 FaceApp — the soft-paywall reference

**Verbatim FaceApp marketing copy:**
- "It makes every photo 100% perfect to stop your followers mid-scroll"
- "create a seamless and photorealistic edit in ONE TAP"

**Verified pattern:**
- Only 2 onboarding steps (skips quiz entirely)
- Soft paywall at ~00:14 — 7-day free trial, single annual plan
- Paywall background: dynamic before/after video

**Note:** FaceApp's funnel is a counter-example — minimal quiz, lean on result-preview transformation. Worth knowing as the alternative path if our 8-screen quiz proves too long.

### 16.11 Cal AI — modern viral quiz-onboarding reference

**Verified pattern (from ScreensDesign):**
- Lengthy quiz onboarding (00:15-02:30)
- Weight loss speed selector at 01:05 with **instant feedback animation**
- 3-day free trial → yearly subscription paywall at 03:25
- Daily targets shown post-quiz: calories, protein, carbs, fats

### 16.12 Apphud paywall study — verbatim CTA library

Cross-app analysis of best-performing paywalls. **Verbatim CTAs documented:**

- "Start free trial"
- "Start N days free trial"
- "Subscribe now"
- "Free trial, then $X.XX per/period"
- "Free trial and subscribe"
- "Start free trial and plan"
- "Activate trial subscription"
- "Try N days free"
- "Continue"

**Verbatim headlines:**
- "Go Premium"
- "Get your personal plan now"
- "Choose your personal plan"
- "Get unlimited access"
- "Unlimited access to all features"

**Verbatim badges:**
- "Best Value"
- "Popular"
- "Most Popular"

### 16.13 What we could NOT verify (transparency)

Per the research agent:

1. **Verbatim Nebula full 27-30 screen quiz in order** — multiple teardowns describe structure but no public source transcribes all of them. To capture this, walk the live `appnebula.co` quiz with screenshots.
2. **Verbatim Umax + LooksMax quiz/reveal text** — in screenshots only, not transcribed by any aggregator.
3. **"Mapping facial geometry / Analyzing 47 facial points" loader copy** — these phrasings circulate as folk examples but were not attributable to a specific app in any teardown. Treat as conventional pattern; do NOT cite a specific app.
4. **Co-Star push-notification taxonomy** — famous in tech press but no consolidated public source.
5. **Faceify, GlamAI, Mona AI, Stylebook AI** — lesser-documented; would require live walks.

**Recommended pre-launch action:** founder or designer should walk the **live Nebula web quiz** (appnebula.co) with screenshots — that is the highest-value research action available, and the spec's per-reading questions in §5 should be cross-referenced against any newly-captured Nebula-style wording before going to production.

### 16.14 Master source list

**Quiz funnel teardowns:**
- The Behavioral Scientist — Noom Product Critique: Onboarding (https://www.thebehavioralscientist.com/articles/noom-product-critique-onboarding)
- RevenueCat — Inside Noom's Web-to-App Onboarding Funnel (https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel/)
- Retention.blog — The Longest Onboarding Ever (Noom) (https://www.retention.blog/p/the-longest-onboarding-ever)
- Retention.blog — Flo (https://www.retention.blog/p/flo-is-an-amazing-success-story)
- Retention.blog — What's your sign? (Nebula) Part 2 (https://www.retention.blog/p/whats-your-sign-part-2)
- Growthwaves — The 113-screen onboarding that doesn't feel long (https://growthwaves.substack.com/p/the-113-screen-onboarding-that-doesnt)
- Medium — Flo & Zoe web2app teardown (https://medium.com/design-bootcamp/how-flo-and-zoe-use-a-web-to-app-to-boost-their-conversion-6f424171b1b7)
- Tearthemdown — Headspace teardown (https://tearthemdown.medium.com/product-teardown-headspace-user-onboarding-personalisation-b6effd0df1d7)

**Funnel pattern + research:**
- FunnelFox — How top apps do web2app in 2026 (https://blog.funnelfox.com/web2app-funnel-patterns-2026/)
- FunnelFox — Quiz Funnels 101 (https://blog.funnelfox.com/quiz-funnel-guide/)
- FunnelFox — Web2App Quizzes for Subscription Apps (https://blog.funnelfox.com/web2app-quizzes-as-profit-engine/)
- FunnelFox — Effective paywall screen designs (https://blog.funnelfox.com/effective-paywall-screen-designs-mobile-apps/)
- FunnelFox — AI Paywall Optimization (https://blog.funnelfox.com/ai-paywall-optimization/)
- Stormy AI — Quiz funnel playbook (https://stormy.ai/blog/perspective-quiz-funnel-playbook-2026)
- Apphud — Best-performing paywalls (https://apphud.com/blog/best-performing-paywallls)
- Superwall — 5 Paywall Patterns Used By Million-Dollar Apps (https://superwall.com/blog/5-paywall-patterns-used-by-million-dollar-apps/)
- Superwall — How to Design a Viral App in 2025 Part 2 (Umax) (https://superwall.com/blog/part-2-how-to-design-a-viral-app-in-2025/)

**Adapty paywall library (specific apps):**
- Nebula (https://adapty.io/paywall-library/nebula-horoscope-astrology/)
- Co-Star (https://adapty.io/paywall-library/co-star-personalized-astrology/)
- FaceApp (https://adapty.io/paywall-library/faceapp-perfect-face-editor/)
- Umax (https://adapty.io/paywall-library/umax-become-hot/)

**ScreensDesign showcases (visual flow references):**
- Nebula, Umax, LooksMax AI, Co-Star, The Pattern, FaceApp, BetterMe, Flo, Cal AI

**Live quiz pages (walk these for any future reference):**
- BetterMe calisthenics quiz (https://quiz.betterme.world/first-page-generated?flow=2209)
- Curology signup quiz (https://app.curology.com/sign-up/get-started/skin/quiz-ps)
- AskNebula homepage (https://www.asknebula.com/)
- Stage AppNebula funnel (https://stage-appnebula.asknebula.com/)

**Psychology research:**
- Forer/Barnum effect — Wikipedia (https://en.wikipedia.org/wiki/Barnum_effect). Forer 1948: 4.30/5.00 perceived accuracy on generic blurb framed as personalized.
- Information-gap theory (curiosity gap) — Loewenstein 1994 (https://impulsebuyingpsychology.com/curiosity-gap/).

**Anti-patterns documented (we explicitly opt out):**
- Avast — Free trial for $3,432/year fleeceware (https://press.avast.com/free-trial-for-only-3432-per-year-avast-discovers-new-fleeceware-apps-on-the-google-play-and-apple-app-stores)
- Bitdefender — Fleeceware: 25 Play Store apps (https://www.bitdefender.com/en-us/blog/hotforsecurity/fleeceware-25-play-store-apps-that-empty-your-pockets)
- Kaspersky — Fleeceware (https://usa.kaspersky.com/blog/beware-of-fleeceware/18904/)
- Deceptive.design (https://www.deceptive.design/)
- Hall of Shame (https://hallofshame.design/)

---

---

## 17. Pricing strategy v2 — hybrid subscription + credit packs + daily reflection

> **Status:** v2.1 recommendation, supersedes the §6.1 paywall economics.
> **Source:** Deep 2026-05-04 competitor pricing research (full data in §18) + 2026-05-04 strategic positioning revision (the three-layer framing below).
> **Decision needed before launch:** founder must approve this structure, or pick the §17.11 pack-only fallback.

### 17.0 The strategic frame: what business are we in?

Before the price points, the positioning. The structural question is not "packs vs subscription." It is:

```
A. Personalized artifact business
   "Upload a photo, get a beautiful one-off reading."

B. Ongoing identity / self-discovery business
   "We keep giving you personalized reflections about yourself."
```

**v1** was mostly business A. The product was a one-time output you bought, downloaded, and walked away from.

**v2 (and v2.1) is decisively business B.** This is not just a pricing change — it's a product change. The subscription only earns its keep if it's positioned as "a personal reading practice that evolves with you," not "3 readings per month plus some text."

The product, in v2.1, has three layers:

| Layer | What it is | What the user pays for |
|---|---|---|
| **The Artifact** | The reading itself — a personalized editorial spread you can unlock now. | $11.99 one-time, or included in subscription. |
| **The Profile** | A persistent self-knowledge profile we build from your quiz answers + readings + preferences. Lives in `userProfiles/{uid}`. The user can see and edit it. | Subscription only. |
| **The Practice** | Ongoing monthly readings (in different lenses: face, palm, aura, beauty, style…) + daily reflections drawn from the Profile. | Subscription only. |

The subscription value proposition is **not** "3 readings per month for $14.99." It is:

> **Build and maintain your personal reading profile. Get new visual readings each month. Receive daily reflections drawn from your profile. Keep everything in your library.**

This positioning unlocks two things our category competitors leverage and we currently can't:

1. **A reason for the user to come back daily.** Without the Profile + Reflection layer, our product ends at "reading downloaded → goodbye." Even with subscription pricing, that's a churn machine.
2. **A reason for the user not to feel they're paying for repetition.** "I only need my palm read once" is a real objection at the trial paywall. The frame "build a profile, try a new lens each month" reframes the spend from repetition to exploration.

**Caveat the v2 spec previously overstated:** the daily content layer closes the **frequency gap** (we now have a reason to engage daily) but does NOT close the **depth gap** (Nebula's daily content is driven by genuinely changing planetary transits; ours is drawn from a relatively static face/palm/iris). We must be honest about this in copy. The Daily Reflection is positioned as *"a small daily reflection drawn from your reading profile,"* not as a fresh-analysis-every-day. This avoids overclaiming and makes the content feel editorial rather than fake-diagnostic.

**Validation data point.** A 2026 LinkedIn analysis of 308,000+ Nebula Meta ads found **76.4% of all ads route to the `appnebula.co` web quiz funnel rather than the App Store listing.** The category leader has effectively decided that the quiz funnel IS the primary acquisition surface — the app listing is secondary. This validates our pivot direction at the strongest possible scale: 300k+ ads, $700K+/mo revenue, A/B-tested at industrial scale, all converging on the same conclusion. Source: [LinkedIn analysis of Nebula Meta ad operations](https://www.linkedin.com/pulse/) (2026).

**Critical copy principle (abstract for strategy, concrete for paywall).** The three-layer framing (Artifact / Profile / Practice) is the **strategic** narrative — it tells engineering, marketing, and ourselves what business we're in. It is NOT the user-facing copy.

User-facing copy on the paywall and elsewhere stays **concrete and tangible**:

> ✅ **Concrete (paywall use):**
> "Unlock today's reading. Get 3 new visual readings each month. Receive Daily Reflections based on your Reading Profile. Keep everything in your private library."
>
> ❌ **Abstract (strategy doc only — never paywall):**
> "Build your evolving self-discovery practice."

The user arriving at the paywall is staring at a blurred image. They're not in the mood for narrative philosophy; they want to know what they get for $14.99. Concrete benefits ladder them in. The abstract narrative is for landing-page hero copy and for our own positioning.

This principle is enforced in §17.3 (paywall ASCII copy uses concrete bullets) and §17.4 (tier rationale uses concrete benefit framing).

### 17.1 The diagnosis: yes, you are underpriced — but not the way you assumed

Founder's gut: *"My offering is on the lighter side because I'm only delivering one picture back with information."*

Research finding: **partially true, but it's not the leverage point.**

The "lightness" comparison breaks into two clusters:

**Cluster A — competitors who deliver "ongoing content" subscriptions** (Nebula $7.99/wk, Co-Star $9/mo, Sanctuary $14.99/mo, The Pattern $14.99/mo, Calm/Headspace $7–$17/mo). They include daily horoscopes, push notifications, chat, content libraries. **Versus this cluster, our single editorial reading IS lighter.** A user paying $7.99/wk to Nebula gets daily content; a user paying $9.99 once to us gets one image and never hears from us again. Real gap.

**Cluster B — competitors who deliver "one-shot AI photo readings" matching our delivery shape** (Truity $19–$29 per personality report, Umax $3.99–$9.99/wk for one face scan/week, LooksMax $9.99/wk on iOS, Faceify $5–10/wk, FaceApp Pro $7.49/mo, Gradient $14.99/mo, Reface $6.99/wk). **Versus this cluster, our $9.99 single is at the cheap end and our $39 6-pack ($6.50/reading) is below the floor of every named competitor.**

**Conclusion: we are simultaneously light vs subscription content products AND underpriced vs the photo-reading peer group. Both are fixable.**

### 17.2 Why credit packs alone cap LTV

The Adapty 2026 industry data is explicit:

- Weekly subscription plans now generate **55.5% of all app revenue** in this category.
- Adding a free trial to a weekly plan moves average LTV from $7.40 → $54.50 (a **636% increase**).
- The lifestyle AI category specifically grew **691% YoY** in 2025, dominated by subscription operators.

The math on our current model:
- Best-case pack buyer: $39 (6-pack) → $39 LTV. Done.
- Worst-case (and most common): $9.99 single → $9.99 LTV. Done.
- Even if every pack buyer returned to buy a second pack — which they don't — peak LTV is ~$50.

A subscriber at $14.99/mo with category-median lifestyle-app retention (~3 months) = $44.97 LTV. A subscriber who renews to annual at $89.99 = ~$90 LTV in year one. The math isn't close.

**This is independent of the funnel pivot.** Even with an optimized quiz funnel landing at the existing pack paywall, we're capping our own ceiling. Subscription is the delta.

### 17.3 The recommended paywall (v2.1)

Replaces §6.1's three-tier pack paywall. Same blurred reveal + headline insight above; tier section below.

**Key copy principle (v2.1 revision):** every tier card leads its benefit list with **"Unlock today's reading"** because that's what the user is staring at — a blurred result they came to see. Don't make them infer that the subscription unlocks the thing they're looking at. The subscription benefits THEN position the Profile + Practice layers.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Your reading is ready                                               │ ← unblurred headline
│  Your dominant aura is Violet — and it sits in your celestial layer. │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │ ← 3 cropped blurred
│  │ blurred  │  │ blurred  │  │ blurred  │                           │   sections of result
│  └──────────┘  └──────────┘  └──────────┘                           │
│                                                                      │
│  Choose how you want to continue:                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │ ← TIER 1 ★ TARGET
│  │  ⭐ Monthly Reading Plan — Most popular                        │   │
│  │  $14.99/mo  — 7-day free trial                                │   │
│  │  ✓ Unlock today's reading                                     │   │
│  │  ✓ Get 3 new visual readings each month                       │   │
│  │  ✓ Receive Daily Reflections based on your Reading Profile    │   │
│  │  ✓ Keep everything in your private library                    │   │
│  │  Cancel anytime. Renews monthly.                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │ ← TIER 2 (volume)
│  │  Annual Reading Plan — Save 50%                                │   │
│  │  $89.99/yr  ($7.50/mo effective)                              │   │
│  │  ✓ Unlock today's reading                                     │   │
│  │  ✓ Get 4 new visual readings each month                       │   │
│  │  ✓ Receive Daily Reflections based on your Reading Profile    │   │
│  │  ✓ Keep everything in your private library                    │   │
│  │  ✓ Early access to new reading types                          │   │
│  │  Cancel anytime. Renews yearly. (Up to 40 readings/yr.)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  💎 Trusted by 12,400+ readings generated                           │
│  🛡 30-day satisfaction guarantee                                    │
│  💳 Visa · Mastercard · Apple Pay · Google Pay                      │
│                                                                      │
│  [ ──────  Start 7-day free trial  ────── ]                          │
│                                                                      │
│  Not ready for a plan? Just unlock this reading for $11.99 →         │ ← escape hatch
└──────────────────────────────────────────────────────────────────────┘
```

**Visual hierarchy notes:**

- **Single reading is now a text link at the bottom** — not a card. This is a deliberate de-emphasis: the agent's strategic feedback was right that subscription should be the hero, single should be the honest fallback.
- **Two card tiers, not three.** Removing the third card (single as a card) tightens the choice architecture: subscription vs subscription. The single is recovered via the bottom link for users who refuse subscription.
- **Annual leads with "Everything in Monthly"** — a value-stack pattern. Users don't have to re-read benefits; they read "+4 readings/mo + early access" and the math is obvious.
- **CTA verb is "Start 7-day free trial"** — not "Unlock my reading." The user's intent shifts: they came for the reading, but they're now committing to a trial. Honesty in CTA verbs reduces post-purchase regret + chargebacks.

### 17.4 Tier-by-tier rationale (v2.1)

#### Monthly Reading Plan — $14.99/mo (7-day free trial) ★ HERO

- **The hero tier.** Visual-priority badge "Most popular," colored ring, top of the action zone, leads the choice architecture.
- **Positioning copy (verbatim for paywall — concrete, not abstract):**
  - "Unlock today's reading"
  - "Get 3 new visual readings each month"
  - "Receive Daily Reflections based on your Reading Profile"
  - "Keep everything in your private library"
- **What's actually included (the engineering side):**
  - **3 readings every month, any of our 11 categories.** Per-month allowance, granted on subscription anniversary date. Server-enforced cap.
  - **Daily Reflection** — a 100-word personalized editorial reflection drawn from the user's Reading Profile (see §17.6). Email + web push delivery. Cost ~$0.04/user/year.
  - **Reading Profile** — the persistent self-knowledge profile (archetypes, quiz history, tone preferences) maintained across the user's life on the platform. New in v2.1; see §17.6.
  - **Library access** — already exists on `/dashboard`; positioned as a subscription benefit for the first time.
- **The "3 readings" framing matters.** The agent's strategic feedback flagged that "3 readings/month" can read like an allowance, and users may think *"I only need my palm read once."* The reframe: positioned as **"Try a new lens each month"** — variety, not repetition. The 11 readings are 11 different lenses; the value is in switching lenses, not in re-running the same one.
- **7-day free trial, NOT $1 trial, NOT 3-day:**
  - Card-required with clear renewal disclosure on the paywall: *"You won't be charged for 7 days. We'll send a reminder 2 days before."*
  - Adapty data: Health & Fitness apps with 5–9 day trials achieve **39.9% trial-to-paid median, 68.3% top decile.**
- **Why $14.99/mo:**
  - Sits between Co-Star Plus ($9/mo) and Sanctuary+ ($14.99/mo) — directly anchored by closest-comparable subscription competitors.
  - With 3 readings included, effective per-reading price is $5 — beats the legacy 6-pack ($6.50) and feels obviously discounted vs the $11.99 single one-time.
  - Higher would compress vs The Pattern ($14.99) and BetterMe ($19.99); lower would erode the annual tier's discount math.

#### Annual Reading Plan — $89.99/yr ($7.50/mo effective)

- **The volume anchor.** Makes monthly look like reasonable middle ground.
- **Positioning copy (verbatim for paywall — concrete, not abstract):**
  - "Unlock today's reading"
  - "Get 4 new visual readings each month"
  - "Receive Daily Reflections based on your Reading Profile"
  - "Keep everything in your private library"
  - "Early access to new reading types"
  - Fine print only: "Cancel anytime. Renews yearly. (Up to 40 readings/yr.)"
- **Lead with monthly rhythm, not annual count.** v2 originally led with "40 readings/year" — the agent's feedback was right that this reads as "credit warehouse" rather than "ongoing rhythm." 4 readings/month is the same number, framed as practice.
- **Effective $7.50/mo** beats Calm annual ($6.67/mo), Nebula weekly ($7.99/wk → $34/mo), Sanctuary ($14.99/mo). Strongest single-monthly-cost anchor we have.
- **"Save 50%" framing** — exactly half the $14.99/mo × 12 = $179.88. Mathematically clean.
- **Cancel anytime** — refund-prorated, automated via Stripe billing portal. Annual lock-in is the upside; don't fight churn here.

#### Single Reading — $11.99 one-time (escape hatch)

- **Demoted from a card to a text link** at the bottom of the paywall in v2.1. Per the agent's feedback: subscription is the hero; single is the honest fallback.
- **Positioning:** "Not ready for a plan? Just unlock this reading for $11.99 →"
- **Why we still keep it:** Truity proves single-purchase mystical/personality buyers exist and stick. Removing this entirely loses the gift-buyer / one-time-curious / strict-no-subscription segments. The Reddit operator consensus: "always offer a one-time floor; you'll lose 5–15% of revenue if you don't."
- **Up from $9.99** to anchor subscription tiers as obviously better value.

#### Credit top-up packs (subscriber-only)

- **Removed from the primary paywall.** Not visible to non-subscribers.
- Available **inside `/dashboard`** for subscribers who exhaust their monthly allowance:
  - 5 readings = $39 ($7.80/reading)
  - 12 readings = $79 ($6.58/reading)
- Mirrors **Midjourney's GPU-time-then-Relax model** and **ChatGPT Plus's rate-limited-then-API-credits** model. Proven and intuitive.
- Non-subscribers cannot top up; they buy a single reading or subscribe.

### 17.5 The Daily Reflection — drawn from your Reading Profile

> **Naming note (v2.1):** v2 originally called this the "Daily Whisper." That name was rejected because StoryInColor's catalog spans beyond mystical readings — beauty, hairstyle, skincare, color, style. "Whisper" reads as overtly mystical. **Renamed to "Daily Reflection"** for user-facing copy. "Whisper" is retained as the internal/code-level name (`whispers/{date}`, `dispatchDailyWhispers`) and may surface as a subtle brand flourish (e.g. tagline copy like *"a small reflection — sometimes a whisper, sometimes a note"*) but never as the primary product label.

**What it is.** A short (80–120 word) piece of editorial content delivered daily to subscribers, drawn from their Reading Profile (see §17.6). Tone matches the brand voice (cinematic, editorial, Vogue/GQ-ish, never overly mystical for non-mystical readings).

**The honesty caveat (v2.1):** The Daily Reflection closes the *frequency gap* (subscribers now hear from us daily) but does NOT close the *depth gap* (Nebula's daily content reflects genuinely changing planetary transits; ours is drawn from a relatively static face/palm/iris/etc.). User-facing copy MUST reflect this honestly:

> *"A small daily reflection drawn from your reading profile. Designed to help you notice patterns in how you see yourself."*

NOT:
> *"A new analysis of your face every day."* (overclaims; users will catch on within a week and feel cheated)

**Source material per Reflection.** The generation prompt pulls from:
- The user's stored Reading Profile (archetypes, quiz answers, recent readings, preferred tone)
- Their most recent reading category (so the Reflection echoes the lens they last used)
- Optional ambient context: day-of-week, season — for grounding without overclaiming

**Example Daily Reflection for an aura-reading subscriber whose Profile holds {moodInstinct: "violet", activeChakra: "third-eye", aspiration: "blocks"}:**

> *"Today is a quiet violet day. The third-eye doesn't need to see further — it needs to see closer. The block you've been carrying isn't external; it's the way you frame what you already know. Notice what you turn away from in conversation today. That's where it lives."*

**Example Daily Reflection for a hairstyle-analysis subscriber whose Profile holds {currentLength: "shoulder", texture: "wavy", aspiration: "considering big change"}:**

> *"Shoulder-length is the most reversible decision in your wardrobe — which is why you've stayed there. There's nothing wrong with reversibility. But notice today how often the women you envy are the ones who picked something. The lob you've been considering would be a quiet pick, not a loud one."*

The tonal range is wide on purpose — mystical for mystical readings, editorial-fashion for style readings, clinical-elegant for skincare. The Profile carries a `preferredTone` field so the Reflection generator stays aligned per user.

**Why this works.**

1. **Reason to stay subscribed.** Even one daily message transforms the offering from "buy one and never see us again" to "they think about me daily." This is the #1 churn-reducer in adjacent verticals (Nebula, Co-Star, Calm, Headspace).
2. **Retention engine.** Daily push + email re-opens the app/site, exposes the user to "your reading profile is X% complete" nudges, surfaces new reading categories, and naturally suggests when to spend a monthly allowance.
3. **Effectively zero marginal cost.** GPT-4o-mini at $0.15/M input + $0.60/M output → ~200 tokens output × ~$0.0001 per Reflection → ~$0.04/user/year.
4. **Scalable across all 11 readings.** One prompt template, 11 reading-specific variants tuned per category tone.

**Closes the lightness gap — but not all of it.** Honest framing in the spec:
- **Frequency gap closed:** subscribers now hear from us daily, on parity with Nebula/Co-Star/Sanctuary.
- **Depth gap NOT fully closed:** their content evolves with planetary transits / chart data; ours evolves with the user's reading profile growth (new readings added → new Profile facets → new Reflection texture). This is a slower kind of evolution, but real.

**Implementation outline.**

- New scheduled Cloud Function `dispatchDailyReflections` (internal name: `dispatchDailyWhispers`) runs daily at 7am user-local time.
- Reads each subscriber's `userProfiles/{uid}` (the Reading Profile, see §17.6) + last reading category from `users/{uid}/generations/`.
- Calls GPT-4o-mini with a per-reading-category Reflection prompt template + Profile data.
- Writes to `users/{uid}/reflections/{date}` (internally still `whispers/{date}` if simpler) and dispatches via:
  - **Email** (using existing `email-service.ts`) — daily digest at 7am user-local.
  - **Web push** (FCM, opt-in with a soft prompt on `/dashboard` at first visit post-subscribe).
- User can disable in `/dashboard/settings → Notifications`. They can also pick frequency (daily / 3× per week / weekly).

**v2.1 implementation effort:** add to Phase 1 backend (~0.5 day extra). One Cloud Function + one Firestore collection + Reading Profile generator (which is the bigger lift; see §17.6).

### 17.6 The Reading Profile — the structural layer the subscription is building (NEW v2.1)

This is the **single most important addition in v2.1.** Without it, the subscription positioning collapses back to "credit bundle with daily text." With it, the subscription has a real reason to exist: *"You are paying us to maintain a portrait of you, and to show you new lenses on it monthly."*

**What it is.** A persistent, editable, growing data structure per user that captures everything we know about them through their interactions with the product. The user can view it, edit it, and (over time) feel ownership of it. The Daily Reflection draws from it. New readings deepen it. Future personalization features (personalized cover image, smart category recommendations, tonal A/B routing) all read from it.

**Data model.**

```ts
// Firestore: userProfiles/{uid}
{
  uid: string;
  createdAt: Timestamp;
  lastUpdatedAt: Timestamp;

  // === Identity ===
  displayName?: string;
  preferredTone?: "mystical" | "editorial" | "minimal" | "playful";   // user-editable
  primaryReadingCategory?: string;                                      // most-frequented

  // === Quiz history ===
  // Captured at quiz completion in the funnel; appended to over time as
  // the user does more quizzes.
  quizAnswers: {
    [questionId: string]: {
      optionId: string;
      answeredAt: Timestamp;
      readingContext: string;   // which reading the quiz was for
    };
  };

  // === Reading history ===
  readings: Array<{
    generationId: string;
    toolId: string;
    completedAt: Timestamp;
    headlineInsight?: string;   // generated at reveal time
    userTaggedAs?: string[];    // user-applied tags ("favorite", "shared", etc)
  }>;

  // === Derived archetypes ===
  // Computed by a periodic background job that summarizes the above.
  // Refreshed weekly for active subscribers.
  archetypes: {
    // examples - per-reading summary
    palm?: { dominantLine: string; archetypeLabel: string; rarityNote: string };
    face?: { mostExpressivePalace: string; archetypeLabel: string };
    aura?: { dominantColor: string; activeChakra: string; archetypeLabel: string };
    style?: { archetypeLabel: string; undertone: string; closetRatio: string };
    // ... per-reading summaries
  };

  // === Aspirations (cross-cutting) ===
  // The "what are you hoping to learn" answers across multiple readings
  // build a richer picture than any single quiz would.
  aspirations: string[];   // e.g. ["love-clarity", "bone-structure-honesty"]

  // === Reflection delivery preferences ===
  reflections: {
    enabled: boolean;
    cadence: "daily" | "thrice-weekly" | "weekly";
    deliveryChannels: ("email" | "push")[];
    preferredHourLocal: number;   // 0-23; default 7
    timezone: string;
  };

  // === Subscription bridge ===
  // Linked to userCredits/{uid}.subscription
  subscriptionStatus: "none" | "trialing" | "active" | "canceled" | "past_due";
}
```

**Where it gets populated.**

- **At quiz completion** (still unauth at this point, in `pendingReadings/{token}`): quiz answers + a draft Profile are stitched into the pending reading.
- **At subscription purchase** (Stripe webhook → account materialization): the draft Profile from `pendingReadings` is migrated to `userProfiles/{uid}` and seeded with the first reading.
- **At each subsequent reading**: the `readings[]` array is appended; archetype summaries are recomputed (or marked stale).
- **Via user-edit UI** in `/dashboard/profile`: user can edit `displayName`, `preferredTone`, `aspirations[]`, `reflections.*`. This is the surface that makes the Profile feel like *theirs*.

**Where it is read from.**

- **Daily Reflection generator** (§17.5): primary consumer.
- **Quiz-flow personalization** (future): if a returning subscriber re-enters the quiz funnel for a new reading, prefill their previous answers from the Profile.
- **Recommendations** (future): "You've done palm + aura. Have you tried face reading? Based on your profile, you'd find it…"
- **Library page** (`/dashboard`): displays the Profile prominently; treat the Profile page as a first-class destination.

**What the Profile UI looks like (sketch).**

```
┌─────────────────────────────────────────────────────────┐
│  Your Reading Profile                                   │
│                                                         │
│  ┌─ Identity ─────────────────────────────────────┐     │
│  │  You're drawn to violet, with a third-eye      │     │
│  │  active chakra. Your aspirations cluster       │     │
│  │  around clarity and self-knowledge.            │     │
│  │  [edit]                                        │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌─ Lenses you've explored ─────────────────────┐       │
│  │  ✓ Aura (Mar 12) — violet dominant            │       │
│  │  ✓ Palm (Mar 18) — heart line dominant        │       │
│  │  ✓ Face (Mar 24) — career palace prominent    │       │
│  │  ✓ Hairstyle (Apr 02) — three strong cuts     │       │
│  │  ○ Beauty Report — try this lens →             │       │
│  │  ○ Iridology — try this lens →                 │       │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌─ Daily Reflections ────────────────────────────┐     │
│  │  Cadence: Daily 7am                            │     │
│  │  Tone: Editorial                               │     │
│  │  Delivery: Email + Push                        │     │
│  │  [edit]                                        │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

This is the surface that makes a $14.99/mo subscription feel like *"I'm building something with this product"* rather than *"I'm renting credits."*

**Engineering effort for the Reading Profile.**

- New `userProfiles/{uid}` Firestore collection + rules (clients read own only) — 0.25 day
- Population logic at quiz completion + Stripe webhook — 0.25 day
- Update logic at each reading completion (append to `readings[]`, mark archetypes stale) — 0.25 day
- Periodic archetype-summary background job (Cloud Function on Pub/Sub schedule, runs weekly per active subscriber) — 0.5 day
- `/dashboard/profile` UI surface — 0.5 day
- Reflection generator reads Profile (was reading from `pendingReadings` in v2; now reads from Profile) — 0.25 day

**Total Reading Profile addition: ~2 days of engineering on top of v2's 6-day estimate. v2.1 total estimate: ~8 working days.**

The v1 pack-only path (§17.11) does NOT include the Reading Profile — it's a subscription-only feature.

### 17.7 Subscription mechanics: how it interacts with the existing credit ledger

The hybrid sub + credit model means we need credits to remain the universal spend mechanic but be granted from multiple sources.

**Data model changes.**

```ts
// userCredits/{uid} — extend existing schema
{
  balance: number;                      // unchanged
  used: number;                         // unchanged
  // NEW fields:
  subscription?: {
    status: "active" | "canceled" | "past_due" | "trialing";
    plan: "monthly" | "annual";
    stripeSubscriptionId: string;
    currentPeriodStart: Timestamp;
    currentPeriodEnd: Timestamp;
    monthlyAllowance: number;            // 3 for monthly, 40/12 ≈ 3.33 for annual (rounded up)
    monthlyAllowanceUsed: number;        // resets monthly on period roll
    canceledAt?: Timestamp;
  };
  topUpCredits: number;                  // separate balance for purchased top-ups
}
```

**Spend rules.** When a subscriber generates a reading:
1. If `subscription.status === "active" || "trialing"` AND `monthlyAllowanceUsed < monthlyAllowance` → consume one allowance unit. Subtract from `monthlyAllowanceUsed`, no balance change.
2. Else → consume from `topUpCredits` (1 credit per reading).
3. Else → block, prompt to top up or wait until next allowance grant.

**Allowance refresh.** Stripe webhook on `invoice.paid` resets `monthlyAllowanceUsed = 0` and updates `currentPeriodStart/End`. Annual plan grants are per-month within the annual term: 40 readings / 12 months = 3.33, rounded up to 4 readings/month, 40 total.

**One-time-purchase users.** Stay on the existing `balance + used` flow — no subscription field, just topUpCredits or balance from the legacy single/trio/set packs. Existing code path unchanged.

**Cancel flow.** Stripe customer portal handles it. On cancellation:
- `subscription.status = "canceled"` immediately, `subscription.canceledAt = now`.
- Allowance remains usable until `currentPeriodEnd` (paid through period).
- After period end, `subscription.status` cleared, monthly allowance gone, `topUpCredits` retained.

**Refund flow.** Manual via Stripe dashboard for v1. Self-service refund flow is a v2 add.

### 17.8 Trial mechanics — the 7-day rules

**Card required at trial signup** (Stripe `subscription_data.trial_period_days: 7` + payment method on file).

**Two reminder emails:**
- Day 5 — *"Your trial ends in 2 days. We'll charge $14.99 on [date]. Cancel anytime."*
- Day 7 morning of charge — *"Charging $14.99 today. Manage your plan: [link]"*

**Trial users get the full monthly allowance immediately** (3 readings during trial). This is deliberate: a trialist who burns through their 3 readings and feels they got value will renew. A trialist who never uses anything because the app hides allowance behind a trial-state flag will cancel.

**Cancel during trial = no charge, immediate end of access.** Allowance stays usable until trial period ends (some operators clip on cancel; we don't — feels cleaner, lower complaint rate).

### 17.9 What the founder must decide before launch

| Decision | Default recommendation | Founder note |
|---|---|---|
| Sub or pack-only or hybrid? | **Hybrid (recommended)** | Subscriptions cap LTV at ~$45–80, packs cap at ~$50. Pure pack = leave money on the table. Pure sub = lose Truity-style impulse buyers. Hybrid is best EV. |
| **Three-layer positioning (v2.1)?** | **Yes — Artifact / Profile / Practice** | This is the strategic frame that justifies the subscription. Without it, sub feels like a credit bundle. With it, sub feels like a self-discovery membership. |
| **Reading Profile as a first-class product?** | **Yes — ship in v2.1 launch** | The single highest-leverage addition. ~2 days extra engineering. Makes the subscription feel earned. |
| Monthly tier price | **$14.99/mo with 7-day trial** | Researched against Co-Star ($9), Sanctuary+ ($14.99), Pattern ($14.99). |
| Annual tier price | **$89.99/yr** | $7.50 effective monthly beats Calm/Nebula. **Lead with "4 readings/month," not "40/year."** |
| Single-reading price | **$11.99 one-time, demoted to bottom text link** | Up from $9.99. Truity proves $19–$29 is plausible if needed v3. |
| Daily Reflection layer | **Yes — ship in v2.1 launch** | $0.04/user/year cost. Frame as "drawn from your profile," NOT "new analysis daily." Closes frequency gap; honest about depth gap. |
| Daily Reflection user-facing name | **"Daily Reflection"** | Universal across all 11 readings (mystical + beauty + style). "Whisper" retained as internal name + occasional brand flourish. |
| Trial length | **7 days, card required, clear disclosure** | Avoids fleeceware territory. Industry sweet spot. |
| Top-up packs subscriber-only | **Yes** | Single is the non-subscriber escape hatch; top-ups are subscriber overflow. |
| $1 exit-intent downsell | **Drop in v2.1** | Conflicts with sub-as-target tier. Replace with "Not ready for a plan? Just unlock this reading for $11.99 →" exit messaging. |
| Subscription benefit framing | **Outcomes, not allowances** | "Build your private reading profile. Try a new lens each month." NOT "3 readings + daily text." |
| International tiered pricing | **Defer to v3** | Adds complexity. Phase 2 once we have base data. |

### 17.10 Backwards compatibility for existing users

All current `/credits` page packs ($9.99 / $24 / $39) remain available to **existing signed-in users.** Hitting `/credits` directly continues to work with the current pack list (returning users keep their habit).

**Quiz funnel users see only the v2 paywall** with the new tier structure.

**Migration:** none required for the existing `userCredits` schema — new fields are additive. Existing users keep their current `balance` and continue to spend it. New subscribers get the new `subscription` object alongside.

### 17.11 Conversion + LTV targets (revised)

Updates to §9.3 success criteria:

| Metric | 7-day target | 14-day target | 30-day target |
|---|---|---|---|
| Quiz completion (Started → Photo Uploaded) | ≥ 50% | ≥ 60% | ≥ 60% |
| Email capture rate | ≥ 60% | ≥ 70% | ≥ 70% |
| Paywall → any-tier purchase | ≥ 6% | ≥ 9% | ≥ 12% |
| **Subscription rate (target tier among purchasers)** | ≥ 40% | ≥ 50% | ≥ 60% |
| **Trial → paid conversion** | n/a | n/a | ≥ 30% |
| Cost-per-Purchase from ads | ≤ $25 | ≤ $18 | ≤ $12 |
| Blended LTV per converted user | ≥ $20 | ≥ $35 | ≥ $50 |

**Lift target:** if LTV/CAC > 3:1 within 30 days at the new pricing, scale ads aggressively. If 1:1 < LTV/CAC < 3:1, optimize. If <1:1 after 30 days, roll back to v1 pricing or the pack-only fallback.

### 17.12 The pack-only fallback (if subscription is rejected)

If founder decides not to ship subscriptions in v1:

- Single $9.99 → **$14.99** (raise; signal premium positioning)
- Trio $24 → **$34.99** (3 readings @ $11.66/each)
- Set-of-six $39 → **$69.99** (6 readings @ $11.66/each)
- **NEW: Annual unlimited pack — $129 one-time** (12-month access to unlimited readings, no auto-renew). This is a one-time purchase priced at the annual sub equivalent; eliminates churn anxiety.

Pack-only ceilings LTV at the annual unlimited tier ($129). Subscription with renewals beats this on month 13. But pack-only is operationally simpler: no Stripe subscription billing, no allowance enforcement, no trial mechanics, no daily whisper system. **About 1 day less engineering than the hybrid sub + pack model.**

Recommended only if subscription billing complexity is a no-go for v1 launch.

### 17.13 The fleeceware trap — why we are NOT doing the dominant App Store pattern

For completeness, the dominant pattern in the App Store mystical/AI-photo space is **$1 trial → $9.99/wk** (Umax, LooksMax, FaceApp variations). Adapty data shows highest LTV ($54.50, +636% vs no trial). Why we explicitly opt out:

1. **Reputational risk on web.** App Store reviews are siloed; web operators get reviewed on Trustpilot, Reddit, Twitter. The "$200/year hidden in $3.99/wk" framing is the #1 complaint thread in r/scams about this category.
2. **Stripe sides with the consumer on chargebacks.** Apple shields fleeceware operators from chargebacks; Stripe doesn't. Auto-renew weekly subscriptions to web customers face 5–15% chargeback rates per Stripe's own data, which trips Stripe's fraud-prevention thresholds and risks account suspension.
3. **EU/UK/CA regulators are actively suing in 2025–2026** for hidden auto-renewal patterns. The risk window is closing.
4. **DECISIONS.md and founder direction explicitly reject this pattern.** Locked-in.

Our 7-day trial + clear renewal disclosure is a deliberate differentiation — we'll convert at lower rates than fleeceware operators but with materially lower chargeback / churn / regulator / reputation risk.

### 17.14 Engineering effort delta vs v1

Compared to the v1 (pack-only) implementation plan in §10:

- **+1 day** for subscription handling (Stripe subscription + customer portal + allowance enforcement)
- **+0.5 day** for Daily Reflection Cloud Function + email/push integration
- **+2 days** for Reading Profile (collection + population logic + archetype summaries + `/dashboard/profile` UI) — **NEW in v2.1**
- **+0.25 day** for paywall UI changes (sub tiers + trial messaging)
- **+0.25 day** for `userCredits` schema changes + migration + tests

**Total v2.1 effort: ~8 working days** (vs v1's 4 days, vs v2's 6 days). The Reading Profile is the biggest single engineering addition v2 → v2.1. Pack-only fallback in §17.12 stays at 4 days (no Profile, no subscription, no Reflection).

### 17.15 DECISIONS.md updates required

Once founder approves §17, the following changes need to land in `DECISIONS.md`:

**Remove from "Explicitly rejected":**

> "Subscription tiers (`The Subscriber`, `The Editor`). Not at this stage. Pay-as-you-go only."

**Add a new "Pricing (v2 — 2026-05-04)" section with these entries:**

- **Hybrid pricing model.** Single $11.99 one-time + Monthly $14.99 subscription (3 readings + daily content) + Annual $89.99 subscription (40 readings + daily content) + top-up packs for subscribers. Pure pay-as-you-go retired for new acquisitions; existing `/credits` packs remain for returning users.
- **Daily personalized "whisper"** — 100-word editorial content delivered to subscribers. ~$0.04/user/year cost via GPT-4o-mini. Closes the lightness gap vs Nebula/Co-Star/Sanctuary.
- **7-day free trial on the monthly tier** with card required + clear renewal disclosure. Explicitly NOT the App Store fleeceware pattern ($1-trial-to-weekly-$40+).

---

## 18. Appendix F — competitor pricing research

(Full data from the 2026-05-04 deep research pass. Cited per-row.)

### 18.1 Mystical / spiritual / astrology

| App | Pricing | What user gets |
|---|---|---|
| **Nebula (OBRIO)** | $7.99/wk (3-day trial), $24.99/mo, $29.99/3-mo; psychic chat add-ons starting $9.99 + per-min after | Daily horoscopes, compatibility, then psychic chat as paid add-on. Active users 2× YoY. |
| **Co-Star** | Free core; "Co-Star Plus" ~$9/mo; in-app purchases $8.99–$11.99 | Free chart, paid features include full chart of others, Eros couple report, Void question answers |
| **CHANI** | $11.99/mo or $107.99/yr (25% off); 14-day free trial | Premium positioned as "best value." Subscription frames product as ongoing astrology guide / self-discovery tool — closest tonal match to our "self-discovery membership" positioning. |
| **The Pattern** | Go Deeper+ from $14.99/mo (quarterly + annual available) | Deeper personality readouts, compatibility, Connect+ relationship features |
| **Sanctuary** | First reading $4.99 (5 min); Sanctuary+ $14.99/mo; psychic chat $2.99–$10.99/min | Sub gives 5-min reading + content + horoscopes + compatibility; pay-per-min live readings on top |
| **AstroLine** | $9.99–$49.99 subscription tiers; psychic chat per-min on top | Premium charts/transit; live psychics charged separately |
| **Astrotalk** | Wallet recharge model. Per-min ₹10–₹250+ ($0.12–$3.00+); US ~30% more | Astrologer chat/call by minute; 30-min sessions $5–$50 |
| **Yodha** | Subscription, weekly available; price varies by country | Palm + face reading + horoscope content |
| **Palmistry HD / Palm Reader apps** | Most weekly subs $3.99–$7.99; free with ads + paywall after first scan | One scan reveal, then paywalls additional content |
| **Starcrossed** | Started $6.99 readings; now annual; reached $70K MRR in 90 days | Birth chart sharing, soulmate matching, personalized horoscopes |
| **Labyrinthos / Golden Thread Tarot** | Free app; **$9.99 unlimited readings unlock**; $0.99 = 33 credits; decks $4.99 | Unlimited tarot readings, learning content, deck cosmetics |

**Pattern:** Subscription dominant. Most under $15/mo. Heavy add-on monetization (psychic chat) for high-LTV users. Labyrinthos is the unusual one — a one-time $9.99 lifetime unlock, comparable to our model.

### 18.2 AI face / beauty / looksmaxxing — your closest pattern

| App | Pricing | What user gets |
|---|---|---|
| **Umax (Become Hot)** | $3.99/wk; tiered $9.99/mo Basic / $19.99/mo Premium; ARR $6M in 3.5 months | One scan/week, daily nudges. Additional scans $3.99 each. |
| **LooksMax AI** | iOS: $9.99/wk or $29.99/mo; Android: $3.99/wk | Full analysis, plan, AI hairstyle simulator |
| **PSL: Looksmax & Ascend** | Yearly + Lifetime tiers; no free trial | Locked-result paywall |
| **Faceify** | Subscription; trial then paid (specific weekly not public) | Face rating, advice |
| **FaceApp Pro** | $7.49/mo currently; historic $3.99/mo, $19.99/yr; $4.99/wk tested | All filters, age/gender swap, beauty mods |
| **Gradient (You Look Like)** | $14.99/mo, $57.99/yr, or $195.99 lifetime; historic $4.99/wk | Celebrity look-alike, face rating, beauty filters |
| **Reface** | $6.99/wk, $9.99/mo (via $119.99/yr), $29.99/yr promo, $44.99 lifetime | Face swap, premium effects |
| **GlamAI** | $7.99–$13.99/wk; pay or "invite 3 friends" to unlock | AI photo/video editor, beauty effects |
| **LOOX (Face Shape & AI Hair)** | 3-day trial → $34 charge | Hairstyle/makeup suggestions |

**Pattern:** Weekly subscription dominant. $3.99–$13.99/wk range. Multi-tier (Basic/Premium) common at the higher end. Lifetime tier offered as "save vs subscription" anchor.

### 18.3 Hairstyle / color / style

| App | Pricing | What user gets |
|---|---|---|
| **HairHunt** | $9.95/mo with 40 credits/mo; per-credit pack for occasional users; 1 free hairstyle gen | AI hairstyle try-on, 360° preview |
| **Style DNA** | $19.99/mo; or $14.99 one-time per guide | Color analysis, 5 daily looks, AI stylist chat |
| **Stylebook** | $4.99 one-time, lifetime | Manual closet manager (no AI) |
| **Dressika** | $5/wk OR $13/yr | Color analysis, makeup |
| **Vivaldi Color Analysis** | $8.99/mo, unlimited season scans | Color analysis |
| **Personal Color Analysis app** | Credit packs only — 1 credit standard / 4 credits pro; no sub | Pay-per-analysis |
| **Colorwise** | One-time IAP for lifetime | Color analysis |
| **YouCam / ModiFace** | Freemium with sub paywall (YouCam); B2B SDK (ModiFace) | Hair color try-on, mostly paywalled |

**Pattern:** Mixed. Subscription leaders ($9.95–$19.99/mo); credit-pack outliers; lifetime-IAP outliers ($4.99 Stylebook). HairHunt's hybrid (subscription with monthly credit grants) is the closest analog to our recommended v2 structure.

### 18.4 Skincare / wellness intake

| Service | Pricing | What user gets |
|---|---|---|
| **Curology** | First box ~free ($5.45 shipping); ~$46/mo ongoing | Custom Rx skincare, derm provider |
| **Function of Beauty** | $39.99 first set, $49.99 refills; subscription delivery 1–3mo | Custom shampoo/conditioner |
| **Hims (hair)** | $22/mo finasteride; $35/mo combo spray | Telehealth + Rx hair loss |
| **Keeps** | $20/mo finasteride, $30/mo combo | Same |

**Pattern:** Higher-AOV monthly subscriptions ($20–$50/mo) tied to physical product fulfillment. Not directly comparable to digital-only readings, but useful for the "ongoing relationship" framing.

### 18.5 Personality / wellness quiz funnels

| App | Pricing | What user gets |
|---|---|---|
| **BetterMe** | $19.99/mo, $39.99/quarterly, $59.99/yr; weekly also exists | Personalized fitness/wellness coaching |
| **Noom** | $17.42–$64.50/mo depending on commitment; $169 for 4-month plan; pay-what-you-can $0.50–$18.37 trial | Behavioral weight-loss coaching |
| **16Personalities** | Premium Career Suite **$29 one-time** | Reports + tools (no subscription pressure) |
| **Truity** | **$19–$29 one-time per premium report (NOT subscription)** | 15–25 page PDF reports |
| **Calm** | $16.99/mo, $79.99/yr, $399.99 lifetime | Meditation, sleep, music |
| **Headspace** | $12.99/mo, $69.99/yr | Meditation library |

**Pattern:** Quiz funnels lead to subscription overwhelmingly. **Truity ($29 one-time per report) is the proof point that one-time per artifact CAN work** — but it requires the artifact to be durable (multi-page PDF) and the audience to be highly task-focused (career assessments). Our editorial PNG + guide is closer to durable artifact than to subscription content; we have arguments for either.

### 18.6 Per-reading psychic services

| Service | Pricing |
|---|---|
| **Keen** | $1/5min intro; $1.99–$15+/min after; avg $3.50/min |
| **Kasamba** | First 3 min free; then $1.99–$30/min |
| **Mysticsense** | First 5 min free; $0.99–$10+/min |
| **PsychicSource** | Intro <$0.66/min for new users |

**Pattern:** Pay-per-time for live human psychics. Non-comparable mechanically (no AI, real humans), but the willingness-to-pay data is useful: a typical Keen session at $3.50/min × 15 min = $52.50 — and these users come back. Our $14.99/mo is a fraction of one Keen session.

### 18.7 Hybrid generative AI references

| App | Pricing | What user gets |
|---|---|---|
| **Photo AI (Pieter Levels)** | $19/mo Starter (1 model, 50 credits) → $49 Pro → $99 Premium → $199 Ultra (50 models). Annual = ~6 months free | AI photo generation, training, video |
| **Midjourney** | $10/mo Basic, $30/mo Standard, $60/mo Pro, $120/mo Mega | AI image gen, Relax mode unlimited on $30+ |
| **ChatGPT Plus** | $20/mo flat | GPT access with limits |

**Pattern:** Subscription with credit/quota allocation per tier. Heavy users overflow to slower mode or buy more. **This is the model we're recommending — proven across the entire generative-AI category.**

### 18.8 The dominant pattern (Adapty 2026, 16,000 apps, $3B revenue)

- **Weekly plans = 55.5% of all app revenue.**
- Adding a free trial to a weekly plan: LTV $7.40 → $54.50 (+636%).
- **Lifestyle AI category grew 691% YoY in 2025**, dominated by subscription operators.
- Web2app ad spend on Meta grew **77% YoY 2024 → 2025.**
- Apple Pay default-selected on checkout = **+20% conversion.**
- Three-tier paywalls with anchored "Most Popular" middle outperform two-tier by 17–40%.
- Health & Fitness apps with 5–9 day trials: median 39.9% trial-to-paid, top decile 68.3%.

### 18.9 Operator-voice quotes (from the research)

**On Umax:**
- A reviewer on Looksmax.org described the app as "completely trash" because of one scan per week.
- Founder Blake Anderson: *"$6 million ARR in 3.5 months."*

**On weekly subscription LTV (Adapty):**
- *"Weekly plans now generate 55.5% of all app revenue."*
- *"Weekly + free trial = 1.5× average LTV of all other configurations."*

**On indie hacker pricing:**
- Indie Hackers post on Bannerbear: founder raised price from $9/mo → $49/mo after validation, only then revenue scaled.
- *"80% of in-app purchases are made on the 1st paywall."*

**On credit-vs-subscription:**
- A developer who switched to credits: *"users preferred to use it when ramping up, not commit to a sub."*
- Counter: *"The best part about subscriptions is that people who pay once keep paying."*

**On Photo AI / Pieter Levels:**
- Higher pricing *"filters for more committed users."*
- Premium tier ($99/mo) is the "Most Popular" — middle-anchor proof.

**On Starcrossed:**
- Founder Neda Farr: started at *"Personalized readings for $6.99,"* reached $70K MRR in 90 days, then moved to annual access.

### 18.10 Master pricing source list

- [Nebula Astrology App Review (Lunar Guide)](https://www.lunarguideapp.com/blog/nebula-astrology-app-review-2026)
- [AskNebula FAQ](https://www.asknebula.com/faq)
- [Co-Star Personalized Astrology App Store](https://apps.apple.com/us/app/co-star-personalized-astrology/id1264782561)
- [The Pattern App Pricing](https://thepattern.zendesk.com/hc/en-us/articles/360055659311-What-does-the-Go-Deeper-Subscription-include)
- [Sanctuary Psychic Reading Reviews 2025](https://www.mysticmag.com/reviews/sanctuary/)
- [Astroline App Review (Bitget)](https://www.bitget.com/academy/astroline-review)
- [Astrotalk Pricing](https://astrotalk.com/pricing)
- [Yodha Terms of Use](https://yodha.app/terms/en/)
- [Labyrinthos Tarot App Review (Bustle)](https://www.bustle.com/life/labyrinthos-tarot-reading-app-review)
- [Umax Become Hot App Store](https://apps.apple.com/us/app/umax-become-hot/id6471026798)
- [The AI App Doing $6M With 1 Employee](https://www.getrecall.ai/summary/entrepreneurship-1/the-ai-app-doing-dollar6m-with-1-employee)
- [LooksMax AI Review (AIChief)](https://aichief.com/ai-lifestyle-tools/looksmax-ai/)
- [PSL ScreensDesign](https://screensdesign.com/showcase/psl-looksmax-ascend)
- [FaceApp Pricing Guide 2025](https://alternatives.co/software/faceapp/pricing/)
- [Gradient App Store](https://apps.apple.com/us/app/gradient-celebrity-look-like/id1466097469)
- [Reface Subscription Policy](https://reface.ai/subscription)
- [GlamAI Pricing](https://glam.ai/pricing)
- [How GlamAI Hit $1M ARR Using Adapty](https://adapty.io/case-studies/glam-ai/)
- [HairHunt App Store](https://apps.apple.com/us/app/ai-hairstyle-try-on-hairhunt/id6746489390)
- [Style DNA AI](https://styledna.ai/)
- [Stylebook FAQ](https://www.stylebookapp.com/faq.html)
- [Best Color Analysis Apps 2026](https://colormineai.com/apps/)
- [Curology Pricing](https://support.curology.com/en_us/pricing-and-products-BJOLQnd2O)
- [Function of Beauty FAQ](https://functionofbeauty.com/pages/faq)
- [Hims vs Keeps for Hair Loss 2025](https://www.hims.com/blog/hims-vs-keeps)
- [BetterMe Subscription Terms](https://betterme.world/en/subscription-terms)
- [Noom Plan Pricing](https://www.noom.com/support/faqs/subscription-and-billing/2025/10/noom-plan-pricing-and-what-to-expect/)
- [16Personalities Premium](https://www.16personalities.com/premium/career-suite)
- [Truity Pricing (Soultrace review)](https://soultrace.app/en/blog/truity-personality-test)
- [Calm vs Headspace Pricing](https://www.choosingtherapy.com/headspace-review/)
- [Keen Psychics Pricing](https://topmystics.com/reviews/keen/)
- [Kasamba Free Psychic Trial](https://www.kasamba.com/lp/display/free-psychic-trial/)
- [Mysticsense Reviews 2025](https://www.newswire.com/news/mysticsense-reviews-2025-honest-complaints-pricing-details-and-is-22643556)
- [RevenueCat State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025/)
- [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions/)
- [Adapty High-Performing Paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/)
- [Web2App Funnel Trends (FunnelFox)](https://blog.funnelfox.com/web-funnels-insights-and-trends/)
- [Beyond the App Store: Web2App Funnels (Qonversion)](https://qonversion.io/blog/beyond-the-app-store-how-web2app-funnels-are-reshaping-mobile-monetization)
- [Photo AI Pricing](https://photoai.com/pricing)
- [Pieter Levels Photo AI Case Study (Indie Hackers)](https://www.indiehackers.com/post/photo-ai-by-pieter-levels-complete-deep-dive-case-study-0-to-132k-mrr-in-18-months-3a9a2b1579)
- [Midjourney Plans Comparison](https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans)
- [Starcrossed $70K MRR Case Study](https://www.socialgrowthengineers.com/this-random-girl-built-a-70k-mrr-astrology-app-in-90-days)
- [Subscriptions vs One-Time Payments (Indie Hackers)](https://www.indiehackers.com/post/subscriptions-vs-one-time-payments-a-developers-honest-take-f153e48960)
- [Credits vs Subscription Pricing (Indie Hackers)](https://www.indiehackers.com/post/credits-vs-subscription-pricing-thoughts-85d8545cf8)
- [How to Spot Fleeceware Apps (Clario)](https://clario.co/blog/how-to-spot-fleeceware-apps/)
- [11 App Pricing Models for 2026 (FunnelFox)](https://blog.funnelfox.com/app-pricing-models-guide/)
- [Apphud Paywall Design Guide](https://apphud.com/blog/design-high-converting-subscription-app-paywalls)

---

---

## 19. Parallel deployment & rollout strategy

> **The constraint:** the existing storyincolor.com site and its current ad campaigns must continue running uninterrupted while the quiz funnel is built, deployed, tested, and rolled out. No disruption to existing users, no disruption to existing ads, no disruption to existing data flows. The pivot ships in parallel and only takes over traffic when the founder explicitly approves the ad URL switch.

### 19.1 Why this is structurally cheap to do safely

The codebase has three properties that make parallel rollout almost free:

1. **Static export.** `out/` is one big directory pushed to GitHub Pages. Adding new routes (`/quiz/[slug]`, `/quiz/[slug]/result/[token]/*`, `/dashboard/profile`) means more files in `out/`. Existing `/readings/<slug>`, `/credits`, `/login`, `/dashboard`, `/admin` re-export byte-for-byte identically — nothing about the existing site changes from the user's perspective when we deploy.
2. **Cloud Functions are independent.** Adding `generateForToolUnauth`, `captureQuizEmail`, `createQuizCheckoutSession`, `cleanupExpiredPendingReadings`, `dispatchDailyReflections`, `buildReadingProfile` is **purely additive** — they coexist alongside `generateForTool`, `stripeWebhook`, `ensureUserCredits` without touching them.
3. **Ads are the only traffic-routing decision.** As long as ad `link_data.link` keeps pointing at `/readings/<slug>?utm_*`, no paid traffic enters the new funnel. The new pages exist; nobody finds them. Switching ads to `/quiz/<slug>` is a single API call per ad — instantly reversible.

### 19.2 Per-system change classification

For each system the pivot touches, classify the change as **additive** (zero risk to existing flow), **conditional** (risk gated behind a feature flag or metadata branch), or **breaking** (would disrupt existing behavior).

| System | Change type | Disruption risk | Mitigation |
|---|---|---|---|
| Frontend routes (`/quiz/*`) | **Additive** | None | New files in `out/`. Existing routes untouched. |
| Cloud Functions (5 new) | **Additive** | None | New callable endpoints. Existing functions untouched. |
| `stripeWebhook` (modified) | **Conditional** | Low | New code wrapped in `if (session.metadata.pendingReadingToken) { … }`. Existing one-time-payment branch unchanged. |
| `userCredits/{uid}` schema | **Additive** | None | New optional fields (`subscription`, `topUpCredits`, `monthlyAllowanceUsed`). Existing reads/writes use defaults. |
| `userProfiles/{uid}` collection | **Additive** | None | New collection. Existing users have no document; fine. |
| `pendingReadings/{token}` collection | **Additive** | None | Brand-new collection with TTL policy. |
| Storage `pending/{token}/` paths | **Additive** | None | New path prefix. Storage rules add new `match` block; existing `match` blocks untouched. |
| Firestore rules | **Additive** | None | New `match` blocks for new collections. Existing rules unchanged. |
| Stripe products/prices | **Additive** | None | New prices for sub tiers + $1 trial. Existing $9.99/$24/$39 prices stay active for `/credits`. |
| Stripe subscription event handling | **Additive** | Low | New webhook event types (`customer.subscription.created`, `invoice.paid`, etc.). Existing `checkout.session.completed` branch untouched for non-pendingToken sessions. |
| Email service | **Additive** | None | New magic-link template + Daily Reflection digest. Existing welcome/contact emails untouched. |
| Ads | **Conditional, reversible** | Founder-controlled | URL switch is a single API call per ad. Reverting is a single API call. |
| Existing pages (`/readings/*`, `/credits`, `/login`, `/dashboard`) | **Untouched** | Zero | No code changes. |

**The only conditional-branch risk is `stripeWebhook`.** Mitigation: a thorough integration test against Stripe test events for both the existing one-time-payment path AND the new subscription path before any production deploy.

### 19.3 The four-phase rollout

#### Phase A — Build everything, route nobody to it (Days 1–6)

Implementation per §10 happens. Code lands in production deploys (GitHub Pages + `firebase deploy --only functions`) but **no ad URLs change.** The new routes exist; the new Cloud Functions are deployed; the new collections exist; the new Stripe prices exist. Only people who type `/quiz/hairstyle` directly into a browser can reach the new flow.

This phase is identical to current dev velocity. Each merge-and-deploy is non-disruptive because the new surfaces aren't routable from anywhere user-facing.

**Self-check before exiting Phase A:**
- [ ] All existing Cypress/manual tests against `/readings/*`, `/credits`, `/login`, `/dashboard` pass identically.
- [ ] Stripe webhook receives one fake `checkout.session.completed` for the existing pack flow → credits land correctly. Existing flow unchanged.
- [ ] `firebase functions:log` shows zero unexpected errors after 24h of post-deploy traffic.

#### Phase B — Internal smoke test in production (Day 6)

Founder + Claude (via browser MCP) walk through the new funnel end-to-end **in production**:
- Click ad-equivalent URL → land on `/quiz/hairstyle` → complete 8 screens → upload sample selfie → see blurred reveal → enter test email → see paywall → use Stripe test card 4242 4242 4242 4242 → complete trial signup → receive magic link → click → land on `/dashboard` → see reading + Reading Profile → receive first Daily Reflection email next morning.

This catches integration bugs that don't show in unit tests. Specifically test:
- Existing `/readings/palm-reading` direct navigation: still works.
- Existing `/credits` page: still loads, packs still purchasable.
- Existing signed-in user opens `/dashboard`: their previous readings still render.

**Self-check before exiting Phase B:**
- [ ] Quiz funnel completes end-to-end with a Stripe test card.
- [ ] Account is materialized at the webhook; `users/{uid}` and `userCredits/{uid}` and `userProfiles/{uid}` all created.
- [ ] Existing `/credits` flow still works for an existing user (manual smoke test with founder's account).
- [ ] No errors in `firebase functions:log` over the test session.

#### Phase C — Soft launch on one ad creative (Days 7–10)

Switch a SINGLE ad's `link_data.link` to `/quiz/hairstyle?utm_*`. Recommended target: **ad `120243525857100694`** (the `storyincolor — beauty/hair v1 — hairstyle` ad in the active beauty/hair v2 ad set). All other 13+ ads continue pointing at `/readings/<slug>`.

For 3–5 days, the only paid traffic entering the new funnel is one ad's worth (~$2–$3/day at current $7/day budget split across 3 ads). Both old and new funnels run simultaneously; we collect comparable cost-per-purchase data.

**Decision gates after 5 days:**
- Cost-per-purchase on quiz funnel < cost-per-purchase on `/readings` flow (currently effectively infinite, so any purchase is a win) → expand to next ad.
- Funnel completion rates per §9.3 / §17.10 targets met → expand.
- Major bug rate > 5% of sessions → roll back the ad URL change (no code rollback needed).

#### Phase D — Gradual rollout per reading (Days 10–21)

Once hairstyle proves out: switch the `color` and `beauty` ads in the same ad set. Then the broader astro ad set's ads if/when that ad set re-activates. The framework is already parameterized per-reading; no additional engineering needed — just config-driven content from `lib/quiz/registry.ts` per slug.

**Decision gates per reading:**
- 7-day funnel data shows the per-reading conversion rate is within 30% of hairstyle's → keep.
- Conversion rate is < 30% of hairstyle's → diagnose specific quiz friction (likely Identity B / Specific question copy needs revision per §5).

### 19.4 Kill-switch controls (instant rollback at any point)

Every system component has a defined revert path:

| If something breaks in… | Revert by… | Time to restore old behavior |
|---|---|---|
| New ad routing | Updating `link_data.link` back to `/readings/<slug>` via Meta API | < 1 minute |
| `generateForToolUnauth` (cost spike, abuse) | Setting Cloud Functions env var `STORYINCOLOR_QUIZ_FUNNEL_ENABLED=false` — function returns 503 | < 5 minutes (no redeploy) |
| `stripeWebhook` subscription branch | If new branch causes errors on existing one-time payments, the `if (session.metadata.pendingReadingToken)` guard means: just disable the feature flag; existing branch unaffected | < 5 minutes |
| Frontend `/quiz/*` route renders broken | Static-export is atomic; redeploy previous `out/` from the served-repo's git history | < 10 minutes |
| Stripe subscription billing issue | Cancel the relevant Stripe subscriptions via dashboard; refund manually | Per case |
| Daily Reflection sends bad copy | Disable scheduled function via `firebase functions:delete dispatchDailyReflections` (keeps code; just stops scheduling) | < 5 minutes |

The **`STORYINCOLOR_QUIZ_FUNNEL_ENABLED` env var** is the master kill switch — adding this to the spec for explicit implementation. When `false`:
- `generateForToolUnauth` returns 503 immediately.
- `captureQuizEmail` returns 503.
- `createQuizCheckoutSession` returns 503.
- The frontend `/quiz/*` routes render an "out for maintenance" page rather than the funnel.
- Daily Reflection scheduled function exits early.

Existing flows (`generateForTool`, `createCheckoutSession`, the existing `stripeWebhook` non-token branch) are entirely unaffected by this flag.

### 19.5 Existing ads — what changes when

| Ad set | Status today | Phase A (build) | Phase B (smoke) | Phase C (one-ad switch) | Phase D (full rollout) |
|---|---|---|---|---|---|
| Beauty/hair v2 (`120243525783370694`) | Active, $7/day | No change | No change | hairstyle ad → `/quiz/hairstyle`; color + beauty stay on `/readings/*` | All 3 ads → `/quiz/<slug>` |
| Astro ad set (`120243296306620694`) | Paused | No change | No change | No change (still paused) | When re-activated: ads → `/quiz/<slug>` |

Existing organic SEO traffic to `/readings/<slug>` continues to work indefinitely — those pages stay live as the SEO surface and the existing-user re-entry point.

### 19.6 The deployment cadence

Standard production deploy cadence applies:

- **Frontend:** GitHub Pages auto-deploy on push to main (existing `.github/workflows/deploy.yml`).
- **Functions:** `cd functions && npm run deploy` — runs `firebase deploy --only functions`. Required secrets must already exist via `firebase functions:secrets:set`.
- **Firestore rules / indexes / storage rules:** `firebase deploy --only firestore:rules,firestore:indexes,storage`.
- **Stripe products/prices:** managed via Stripe Dashboard or `mcp__acb0…__create_product` / `create_price` MCP (already authenticated).

Each deploy is **independently revertible.** Frontend deploy reverts via redeploying the previous `out/`. Function deploys are versioned by Firebase and revertible via `firebase functions:delete <name>` followed by re-deploy of an older codebase commit.

### 19.7 Sequence of approvals the founder gives

To give the founder an explicit set of go/no-go points:

1. **Approve §17 pricing structure (or §17.12 pack-only fallback).** [Pre-Phase 0]
2. **Approve §11.2 open questions** (magic link vs forced password, headline path A vs B, etc.). [Pre-Phase 0]
3. **Approve final spec / DECISIONS.md updates per §17.15.** [Pre-Phase 0]
4. **Approve Phase A → Phase B transition** (everything built, ready to smoke-test). [End of Day 6]
5. **Approve Phase B → Phase C transition** (smoke test passed, ready to switch one ad URL). [End of Day 7]
6. **Approve each subsequent ad URL switch in Phase D.** [Days 10–21]

No founder approval is needed for the Phase A build itself — once §17 + §11.2 are decided, engineering proceeds through Phase A autonomously.

---

## 20. Loop-driven implementation workflow

> This section describes how the entire pivot is to be implemented using Claude Code's `/loop` feature, designed for autonomous iteration until done-done-and-tested-and-deployed-and-verified.

### 20.1 What "done" means

The loop has a single binary success criterion: **all items in §20.3 (Definition of Done) are checked off, AND the §20.5 end-to-end browser verification passes for at least 1 of the 11 readings.** Until both are true, the loop continues iterating.

### 20.2 How to invoke the loop

The repo includes `.claude/loop.md` which is the entry-point prompt. Invocation modes:

| Command | Behavior |
|---|---|
| `/loop` | Dynamic mode — Claude self-paces (1–60 min between iterations). Reads `.claude/loop.md` as the per-iteration instruction. Use this for active development hours. |
| `/loop 15m` | Fixed cron — Claude iterates every 15 minutes. Use during heavy work windows. |
| `/loop 1h` | Fixed cron — hourly. Use overnight or during meetings. |
| `/loop 30m work on the quiz pivot per QUIZ-PIVOT-SPEC.md` | Fixed cron + custom prompt. Use to override `.claude/loop.md` for one-off scopes. |

**Termination:** press `Esc` to stop a waiting loop. The loop never stops itself — it just exhausts work and chooses long delays. Hard expiry: 7 days after creation, the loop auto-deletes.

### 20.3 Definition of Done (the loop's success criterion)

The loop iterates until all of these are checked:

#### Phase 0 — Preparation
- [ ] `pendingReadings` Firestore collection created with TTL on `expiresAt`
- [ ] `userProfiles` Firestore collection rules deployed (clients read own only)
- [ ] Stripe products + prices created: `quiz_single_999_v2` ($11.99), `quiz_monthly_1499_v2` ($14.99/mo recurring), `quiz_annual_8999_v2` ($89.99/yr recurring), `quiz_dollar_trial_100` ($1.00 one-time)
- [ ] Quiz mood images generated and committed under `public/images/quiz/mood/{warm,contemplative,playful,grounded}.webp`
- [ ] Quiz swatch images generated and committed under `public/images/quiz/swatches/*.webp`

#### Phase 1 — Backend
- [ ] `lib/quiz/types.ts` exists and exports `QuizConfig`, `Question`, `QuestionOption`, `LoaderStep`, `RevealConfig`
- [ ] `lib/quiz/shared.ts` exports `sharedIdentityA`, `sharedIdentityC`, shared aspiration questions
- [ ] `lib/quiz/registry.ts` exports `QuizConfig` for all 11 readings (matching §5)
- [ ] `functions/src/generate-for-tool-unauth.ts` deployed; smoke-tested with `firebase functions:shell`
- [ ] `functions/src/quiz-checkout.ts` deployed (`captureQuizEmail`, `createQuizCheckoutSession`)
- [ ] `functions/src/cleanup-pending-readings.ts` deployed and scheduled
- [ ] `functions/src/daily-reflections.ts` deployed and scheduled
- [ ] `functions/src/reading-profile.ts` deployed (profile builder + archetype summarizer)
- [ ] `functions/src/index.ts` `stripeWebhook` extended with subscription event handlers
- [ ] IP rate-limiter functioning (verified by hitting unauth endpoint 6× from one IP — 6th returns 429)
- [ ] Storage rules + Firestore rules deployed and verified

#### Phase 2 — Frontend
- [ ] `components/quiz/primitives/*` — `OptionCard`, `ImageOptionCard`, `ProgressBar`, `Affirmation`, `BlurredImage`
- [ ] `components/quiz/screens/*` — all 8 screens implemented
- [ ] `components/quiz/QuizFlow.tsx` orchestrates the screen sequence
- [ ] `components/quiz/hooks/useQuizState.ts` persists state in localStorage
- [ ] `components/quiz/hooks/useQuizAnalytics.ts` fires the new events
- [ ] `app/quiz/[slug]/page.tsx` loads `QuizConfig` by slug, renders `QuizFlow`
- [ ] `app/quiz/[slug]/result/[token]/page.tsx` renders blurred reveal + paywall
- [ ] `app/quiz/[slug]/result/[token]/unlocked/page.tsx` renders post-payment view
- [ ] `app/dashboard/profile/page.tsx` renders Reading Profile
- [ ] All routes export under static export without errors (`npm run build` exits 0)

#### Phase 3 — Analytics + admin
- [ ] `lib/analytics/events.ts` includes the 11 new event helpers
- [ ] Admin dashboard quiz funnel renders
- [ ] All events flow to Pixel + GA4 + Clarity (verified via Pixel Helper + Test Events)
- [ ] Shared `fbEventId` flows from `QuizStarted` → `QuizPurchase` (verify dedup in Meta Test Events)

#### Phase 4 — Smoke test (covered in §20.5)
- [ ] End-to-end browser verification passes for hairstyle reading

#### Phase 5 — Soft launch
- [ ] One ad's `link_data.link` updated to `/quiz/hairstyle?utm_*` after founder Phase B → C approval

### 20.4 Per-iteration checklist (run every iteration)

The loop's per-iteration prompt instructs the AI to:

1. **Pick the next unchecked item** from §20.3 in dependency order.
2. **Run the per-task work** — write the code, run the local test, deploy if needed.
3. **Run the verification gate** for that item:
   - Code change → `npm run build` (root) AND `cd functions && npm run build` — both must exit 0.
   - Cloud Function deploy → `firebase functions:list` shows the function in healthy state.
   - Firestore/Storage rules deploy → `firebase deploy --only firestore:rules,storage` exits 0.
   - Frontend route → `npm run build` produces the route in `out/quiz/...`.
   - Static type check → `npx tsc --noEmit` exits 0 (root) and `cd functions && npx tsc --noEmit` exits 0.
4. **If all gates pass:** check the box in §20.3, commit (with a clear message), proceed to the next item.
5. **If a gate fails:** read the error, fix the minimum, re-run. Do NOT check the box. The next loop iteration picks the same item up where it left off.
6. **After EVERY iteration:** check `firebase functions:log --limit 20` for unexpected errors. Read Pixel/GA4 dashboards if relevant. Note anything unexpected in §20.6 (Iteration Log).
7. **At the end of every Phase (1, 2, 3, 4):** run the §20.5 browser verification.
8. **At each Phase boundary:** stop and surface a "Phase X complete — please review and approve" message to the founder. Wait for founder confirmation before continuing past Phase A → B and B → C boundaries (per §19.7). Do NOT wait for founder approval within phases — power through.

### 20.5 End-to-end browser verification (run at end of each phase)

The loop uses **Claude in Chrome MCP** (or `mcp__chrome-devtools__*` if Chrome MCP unavailable) to perform a full end-to-end test using a freshly-created test account. **This is the gate that determines "tested and verified" status.**

#### Test scenario: complete the hairstyle quiz funnel as a new user

```
1. Open Chrome at https://storyincolor.com/quiz/hairstyle?utm_source=loop-test&utm_medium=manual
2. Verify: 8-screen quiz appears, progress bar at 0/8.
3. Tap each option in sequence (Hook → Identity A → Identity B → Identity C → Aspiration → Specific).
4. Verify: progress bar advances, affirmation cards appear between screens.
5. On the upload screen: upload a stock test photo (e.g., a sample face from public/images/tools/face-reading-input.webp).
6. Verify: loader screen appears, runs ≥12s, with rotating sub-messages.
7. Verify: blurred reveal screen appears with headline insight, blurred result, email field.
8. Type a unique test email (e.g., `loop-test-{timestamp}@storyincolor.dev`).
9. Tap "See my reading" → paywall screen renders with two tier cards + bottom escape link.
10. Tap "Start 7-day free trial" on the Monthly Plan → Stripe Embedded Checkout opens.
11. Use Stripe test card 4242 4242 4242 4242, any future expiry, any 3-digit CVC.
12. Complete checkout → verify post-payment unblur transition fires.
13. Verify magic-link email arrives at the test inbox (or the email service log shows dispatch).
14. Click magic link → land on /dashboard.
15. Verify: the reading appears in the user's library; Reading Profile is populated.
16. Wait until next 7am UTC (or trigger the function manually) → verify the Daily Reflection email is dispatched.
17. Cancel the test subscription via Stripe billing portal → verify access continues until period end.
```

The AI runs this scenario via browser automation and **screenshots key states** (paywall, post-payment unblur, dashboard with new reading) for the iteration log.

#### Existing-flow regression check (run alongside)

```
1. Open Chrome at https://storyincolor.com/readings/palm-reading
2. Verify: marketing page renders normally for signed-out user.
3. Open https://storyincolor.com/credits while signed in (existing test account)
4. Verify: existing pack list still renders; Stripe Embedded Checkout still works for $9.99 single pack purchase.
5. Verify: the purchase lands credit in `userCredits/{uid}`.
6. Open /dashboard for an existing user.
7. Verify: their previous readings still render in the library.
```

**Both scenarios must pass.** If the existing-flow regression check fails, that's a Phase 0 violation and the loop stops to surface a "regression detected" alert to the founder.

### 20.6 Iteration log

The loop writes a brief entry per iteration to `IMPLEMENTATION-LOG.md` (created on first iteration if missing) with format:

```
## Iter N — YYYY-MM-DD HH:MM UTC

**Phase:** [0 | 1 | 2 | 3 | 4 | 5]
**Item attempted:** [exact §20.3 item text]
**Result:** [✅ passed / ❌ failed / ⚠️ partial]
**Gate output:**
  - npm run build: [exit code, key errors]
  - tsc --noEmit: [exit code]
  - tests: [pass/fail counts]
**Action:** [what was committed, deployed, configured]
**Next:** [next §20.3 item to attempt]
**Notes:** [anything unexpected]
```

This log is for the founder to skim at any time and understand what's been happening.

### 20.7 When the loop should stop and surface to the founder

**Auto-stop and surface to founder** when:
- A phase is complete (A, B, C boundary) — per §19.7 founder approval.
- The end-to-end browser test fails 3 iterations in a row on the same step.
- A regression in the existing flow is detected (per §20.5's regression-check scenario).
- A Stripe webhook event handling error is logged.
- An unrecoverable error blocks all forward progress (e.g., quota exhaustion, API key issue).

**Continue without surfacing** when:
- An iteration fails on a gate (build, type check, test) — fix and re-run.
- A code change requires a redeploy — deploy and continue.
- A test photo / asset is missing — generate it and continue.
- A copy string needs picking from §14 (copy library) or §17 (pricing) — pick the default and continue.

### 20.8 Cost ceilings

To prevent runaway token usage:

- **Hard stop after 50 iterations** in a single loop session (configurable). The loop should print "Iteration cap reached. Surfacing to founder for review." and exit.
- **Hard stop if `firebase functions:log` shows >$5 of unexpected OpenAI spend** in any single hour (the unauth generate path is rate-limited, but if rate limit is misconfigured this catches it).

### 20.9 Acceptance — when the loop has succeeded

The loop has succeeded when:
1. All §20.3 boxes are checked.
2. The §20.5 end-to-end browser test passes for at least one reading (default: hairstyle).
3. The §20.5 existing-flow regression test passes.
4. `IMPLEMENTATION-LOG.md` shows a final iteration with status ✅ for all relevant items.
5. The founder has approved Phase A→B and B→C transitions per §19.7.

The loop's last action is to write `IMPLEMENTATION-LOG.md` with a final summary entry titled "Pivot complete — ready for Phase D rollout per §19.3."

After this, additional ad URL switches per Phase D are founder-driven (one approval per ad per §19.7) — the loop's job is done.

---

*End of spec v2.1.x. Document is implementation-ready. Per §17.15, founder must approve the v2.1 pricing structure (or pick the §17.12 pack-only fallback) before Phase 0 begins. Per §20.2, the loop is invoked via `/loop` reading `.claude/loop.md` as the per-iteration instruction.*
