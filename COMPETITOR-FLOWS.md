# Face-rating funnel teardown: what the leaders actually ask, in order

**Goal:** replace generic chip questions on `storyincolor.com/face-rating` with the question/copy patterns the category actually uses to convert. All UMAX screen text below is **verbatim from a live walkthrough of `ailooksmaxing.app/webapp/`** (Blake Anderson's official UMAX web funnel — same product as the iOS app, ported to web). Other apps were sampled from a mix of: live web tools, App Store screenshot galleries + review text, ScreensDesign teardowns, and articles. Where exact verbatim wasn't recoverable for an app, that's flagged inline.

Date of capture: 2026-05-06.

---

## 1. UMAX (Blake Anderson, ailooksmaxing.app/webapp/)

The category leader. Category-defining playbook. **Walked end-to-end.**

### Screen-by-screen (verbatim)

| # | URL slug | Headline | Subhead | Type | Options |
|---|----------|----------|---------|------|---------|
| 1 | `/onboarding/gender` | **What's your gender?** | This helps us personalize your analysis. | 2-card chip + Continue | "Male — Show me the best plan." / "Female — Personalize my glow-up." |
| 2 | `/onboarding/age` | **What's your age range?** | Different ages have different optimization paths. | 4-chip + Continue | 18-24, 25-34, 35-44, 45+ |
| 3 | `/onboarding/focus` | **What do you want to improve?** | (no subhead) | 6-chip multi-select + Continue | Skin glow-up, Depuff face, Jawline definition, Hairstyle, Beard / grooming, Overall facial harmony |
| 4 | `/onboarding/self-rating` | **How attractive do you see yourself?** | Be honest. This is just for you. | 1–10 slider + Continue (anchor word changes: "Average" at 5) | n/a |
| 5 | `/onboarding/mission` | "Our mission is simple." → "To help you become…" → "**the most attractive version of yourself**." | n/a (animated reveal) | Statement + Continue | n/a |
| 6 | `/onboarding/improve-more` | **What else do you want to improve?** | (no subhead) | 6-chip multi-select + Continue | Improve body shape, Clean diet, Skincare routine, Better posture, Look taller, Sleep better |
| 7 | `/onboarding/appearance-anxiety` | **Do you worry about your appearance?** | Be honest. This helps us guide you. | 5-chip + Continue | Never, Rarely, Sometimes, Often, Almost all the time |
| 8 | `/onboarding/motivation` | **How motivated are you to change right now?** | We adjust the plan to your energy. | 5-chip + Continue | Not motivated at all, A bit motivated, Somewhat motivated, Very motivated, Extremely motivated |
| 9 | `/onboarding/science` | **Science-backed self-improvement** | "First impressions form in just 100 milliseconds. Your face is the first thing people see." + "Studies show facial symmetry and skin clarity are among the strongest predictors of perceived attractiveness." | Statement + Next | n/a |
| 10 | `/onboarding/compliments` | **How often do you receive compliments on your looks?** | From friends, family, or strangers. | 5-chip + Continue | Never, Rarely, Sometimes, Often, Very often |
| 11 | `/onboarding/week1` | **Your first week** | "Early changes start fast." / "Momentum builds." | Animated chart preview (Skin / Jawline / Symmetry / Eyes / Overall) + Continue | n/a |
| 12 | `/onboarding/week10` | **Week 10** | "Week 10 is where the glow-up becomes obvious." / "**You're not the same guy anymore.**" | Animated chart preview + Continue | n/a |
| 13 | `/onboarding/comparison` | **The difference is clear.** | Before / After cards: "No clear plan / Inconsistent routines / Low confidence" → "Clear structure / Daily momentum / Noticeable improvement" | Visual + Continue | n/a |
| 14 | `/onboarding/trajectory` | **You're building the most attractive version of yourself.** | Confidence × Looks chart, "Weeks 1-12" | Visual + **Start my plan** | n/a |
| 15 | `/onboarding/lockin` | **Time to lock in.** | Commit to becoming your best version. | **Press and hold** (3-second physical commitment ring with fingerprint icon) | n/a |
| 16 | `/rating/front` | **Front photo** | Face the camera directly. Good lighting helps. | File upload + Continue | n/a |
| 17 | `/rating/side` | **Side profile** | Turn 90 degrees to your left or right. | File upload + **Analyze my face** | n/a |
| 18 | `/rating/analyzing` | **Building your looks profile…** then "Analyzing your face data" → "3 standout traits detected" / "4 areas that could age you faster" / "1 high-priority fix flagged" → "Calculating your attractiveness baseline" | Theatrical loader (~12s) | n/a | n/a |
| 19 | `/paywall` | **Unlock Your Facial Potential** | "See your ratings" + 4 cards (Jawline / Masculinity / Skin Quality / Cheekbones) with **blurred numbers and lock icons** | **ONE-TIME · $5.99 EUR** · "One-time unlock. Save your results." + Continue | Single bundle |

### Tone

Bro-aspirational + clinical hybrid. Lines like "Show me the best plan" (chip copy as character voice), "the most attractive version of yourself," "You're not the same guy anymore." Everything is framed as a self-improvement *protocol*, never as judgment. The slider that asks "How attractive do you see yourself?" is paired with "Be honest. This is just for you." — that line repeats verbatim across two screens, working as a quiet permission slip.

### The screen doing the most psychological lifting

**`/onboarding/lockin` (#15) — "Time to lock in. Press and hold."** It is a 3-second physical commitment ritual that's the only friction-free screen in the funnel. It comes immediately *before* the photo upload. By the time the user uploads their selfie, they have already committed to "becoming your best version" with a fingerprint-shaped affordance. This is sunk-cost reinforcement engineered as theatre.

### Lock-in / commitment-escalation patterns BEFORE paywall

1. **Self-rate slider (#4)** — user supplies their own baseline, which the AI will later validate or contradict. They've now staked an opinion they want confirmed.
2. **Mission interstitial (#5)** — narrative lock: "**our mission** is to help **you become the most attractive version of yourself**." First plural-noun bridge.
3. **Appearance-anxiety question (#7)** — vulnerability disclosure, sunk-cost.
4. **Motivation question (#8)** — explicit verbal commitment ("Very motivated") that the user has to deselect to back out.
5. **Animated week 1 / week 10 / 12-week trajectory charts (#11–14)** — the user sees themselves on a curve before any photo is uploaded.
6. **Press-and-hold lock-in (#15)** — physical ritual.
7. **Theatrical loader (#18)** with specific counts ("3 standout traits detected, 4 areas that could age you faster, 1 high-priority fix flagged") — produces curiosity gap *for the user's own face* that only the paywall resolves.

### Paywall trigger + copy

Trigger: immediately after the analyzing loader resolves. Paywall headline: **"Unlock Your Facial Potential — See your ratings."** Below it: 4 sub-score cards (Jawline, Masculinity, Skin Quality, Cheekbones) with **fake-blurred numbers and lock icons** suggesting the analysis is complete, you just can't see it. **"ONE-TIME · $5.99 EUR · One-time unlock. Save your results."** + a Continue CTA. Footer fine print acknowledges auto-renewal language even though the headline says one-time — borderline dark-pattern, generates App Store complaints, but works.

### Sources

- Live walkthrough of `https://ailooksmaxing.app/webapp/onboarding/gender` and following pages, captured 2026-05-06.
- ScreensDesign teardown: <https://screensdesign.com/showcase/umax-become-hot> (mentions sequential selfie upload, "Trusted by 1,000,000+ people" social proof on iOS, "Invite 3 Friends" gate, App-Store-rating prompt before account creation — none of which appear in the *web* funnel).
- Superwall blog Part 2: <https://superwall.com/blog/part-2-how-to-design-a-viral-app-in-2025/> ("Madden-style rating screen", six-factor rating, "evil onboarding flow asks for user data upfront to build personalization before paywall").

---

## 2. LooksMax AI (Mnkybrain Labs, ID 6474518292)

Less granularly documented than UMAX but well-reviewed. iOS-only.

### Funnel structure (from ScreensDesign + App Store screenshots + reviews)

ScreensDesign documents 8 onboarding steps with these noted moments:

1. **Sample-results carousel** — "showing sample AI-generated ratings upfront" (the first frame is a teaser). This is the same hook our `IntroScreen` uses with the 7.4/10 sample card, except we use a static card; they auto-rotate.
2. **Permission warm-up** — a custom screen explaining notification value before triggering the iOS native prompt. (Higher opt-in rates.)
3. **Photo upload** — front + side photo on separate screens, identical to UMAX. Copy includes "Make sure your face is well lit" (verbatim).
4. **Rating-categories preview** — shows what categories will be rated (Masculinity, Jawline, Eyes, Cheek Bones, Hair, Skin) before any photos go through.
5. **Native App Store subscription sheet** — appears before any analysis runs. **3-day free trial → weekly subscription**, primary tier $3.99/week. This is a classic Apple-native paywall, not a custom one.
6. Analysis runs.
7. **Second paywall screen at results** with a live counter: "**X people just revealed their results**" (FOMO + dynamic social proof).
8. Results unlock.

### Tone

Clinical and sample-driven. The category preview is the standout — they show you the rubric you'll be graded on before you submit, which makes the user pre-commit to the framework.

### One screen doing the most lifting

**The category preview before native paywall.** It primes the user to *want* a number for each axis before the App Store sheet appears, so the subscription feels like the unlock for a verdict they already half-formed.

### Paywall and pricing

- Primary: **3-day free trial → $3.99/week** (Apple subscription).
- Secondary unlock at results — same subscription, different framing.
- Tertiary one-time IAPs: $4.99 hairstyle pack, $0.99–$5.99 various "Boosts," $0.99 Chad Pack.

App Store reviews flag this aggressively: *"Every single thing you need to pay for…not good at all"* and *"if the app costed $4 maybe but $4 a month everybody already has enough"*.

### Sources

- ScreensDesign: <https://screensdesign.com/showcase/looksmax-ai>
- App Store reviews: <https://apps.apple.com/us/app/looksmax-ai/id6474518292>
- Onpointfresh review: <https://onpointfresh.com/looksmaxxing-apps/> ("the onboarding is short, making it easy to get to rating")

---

## 3. LooksMax Face Rating AI / LooxUP (Apple ID 6478697267)

Smaller competitor with a distinctive angle: aggressive speed.

### Funnel structure

ScreensDesign documents this as **3 onboarding steps** total — interactive onboarding such that "new users can start using the app in just 30 seconds." Specific moments:

1. **00:13** — sample results upfront (same hook as UMAX/LooksMax AI).
2. **00:34** — rating categories preview screen.
3. **00:43** — native App Store subscription sheet.
4. **01:01** — "Make sure your face is well lit" upload instruction.

### Pricing

The reviews are loud about this: weekly $9.99, monthly $7.99, annual $29.99, with a $1.99 promo. Multiple App Store reviews complain about a small "free trial" checkbox being easy to miss — "*The packages at the start the description is written horribly and does not even make it clear it is a one time charge for a year.*" Translation: their funnel converts hard but burns NPS.

### One screen doing the most lifting

**The auto-rotating sample-results carousel on screen 1.** Three faces, three score breakdowns. By the time you land on screen 2, you've seen what you want.

### Sources

- <https://screensdesign.com/showcase/looksmax-rating-ai-face-rater>
- <https://apps.apple.com/us/app/looksmax-rating-ai-face-rater/id6478697267>
- <https://looxup.app/>

---

## 4. Mogged (Aurelian Syndicate / Metellus Productions)

Two surfaces: **moggedupapp.com** (the iOS/Android product) and a free **web-tool funnel** under `/tools/*`. The web tools are the closest 1:1 analog to `storyincolor.com/face-rating` so I treated them as the primary comparison.

### `/tools/mogger-test` — single-screen funnel (walked live)

- Eyebrow: "FREE AI TOOL"
- Headline: **"DO YOU MOG?"**
- Subhead: *"Drop a selfie. Find out where you actually land on the PSL scale — Chad, Chadlite, Normie, or LTN. **60 seconds, no signup, no cope.**"*
- Two CTAs side by side: **TAKE A SELFIE** / **UPLOAD A PHOTO**
- Microcopy under CTA: "Front-facing photo, good lighting works best. Photo isn't stored."
- Long SEO-friendly explainer below the fold (4 PSL tiers, "How it works" 3 steps, "Tips for an accurate read", "What if you don't like your result?", FAQ).

**Zero questions before upload.** No gender chip, no goal chip, no country chip. The tier vocabulary itself (Chad / Chadlite / Normie / LTN) is in the *headline subtext*, doing all the demographic-personalization work that UMAX does with chip questions.

### `/tools/psl-score`

- Headline: **"WHAT'S YOUR PSL SCORE?"**
- Subhead: *"Drop a selfie. Free AI rating across the 4 official PSL categories — Harmony, Dimorphism, Angularity, Miscellaneous — and your tier on the GigaChad → Sub3 scale. **60 seconds, no signup.**"*
- Same dual CTA: TAKE A SELFIE / UPLOAD A PHOTO.

### Tone

Aggressively no-BS, blackpill-adjacent. "60 seconds, no signup, no cope" is the controlling tagline. The web copy explicitly contrasts itself with the longer mobile funnel.

### Paywall trigger + pricing

Web tools are loss-leaders for the iOS/Android paywall. App: $6.99/scan, $79.99/year, weekly tiers around $3.99. Onboarding flow inside the iOS app is "smoother first-scan with camera handoff" (recent release notes), but the actual question set isn't documented in screenshots.

### Sources

- <https://www.moggedupapp.com/tools/mogger-test> (live walked)
- <https://www.moggedupapp.com/tools/psl-score> (live walked)
- <https://mogged.link/articles/mogged-vs-umax-vs-looksmax-ai>
- <https://mogged.link/articles/best-looksmax-ai-apps>

---

## 5. Faceify

Most "Faceify" results in the App Store are an attendance-tracking app — not the looksmaxxing product the founder mentioned. The looksmaxxing variant doesn't appear to be a meaningful market presence as of 2026-05-06 — no ScreensDesign teardown, no consistent App Store presence, no community discussion. **Skipping with low confidence; if the founder has a specific URL, request it.**

---

## 6. PSL.app

No app at the literal `psl.app` domain. The closest equivalents are a **swarm of near-identical iOS apps** — `Looksmaxxing - PSL Face Rating`, `Mogged: PSL & Looksmax Rating`, `PSL Scale - Score & Rating`, `Facemax`, `Ascendr - PSL Scale Ascender`, `PSL Max`, `Blackpill AI: Mogged & PSL` — that all share the same template:

- Front + side photo upload, often inside a guided camera UI.
- Rating across the 4 official PSL pillars (Harmony / Dimorphism / Angularity / Miscellaneous).
- Tier output on the Subhuman → GigaChad scale.
- Either a free trial → weekly subscription or per-scan IAP.

None document a long quiz-style onboarding the way UMAX does. The pattern is **upload-first, paywall-after**. Two free webapps that follow this exact pattern:

- **freepsl.com** — Single screen. Headline: **"What's Your PSL Score?"** Subhead: "Upload a clear face photo and get an AI-powered PSL rating." Microbadges: "**No signup required**" + "Privacy-focused". Drop zone, "Get My PSL Score" button, then long SEO explainer.
- **pslscale.com** — Same single-screen pattern.

These exist because the longer the funnel, the worse SEO traffic converts on cold landing.

### Sources

- <https://freepsl.com/> (live walked)
- <https://apps.apple.com/us/app/looksmaxxing-psl-face-rating/id6477295133>
- <https://apps.apple.com/us/app/mogged-psl-looksmax-rating/id6757205994>
- <https://apps.apple.com/us/app/psl-scale-score-rating/id6756228043>

---

## 7. Glam Up AI / Glow Up (female-leaning analog)

Female-leaning play. Same underlying playbook as UMAX, different vocabulary.

### Funnel structure (from release notes + reviews; not walked end-to-end)

- "Completely redesigned onboarding with personalized questions to build a custom glow-up plan."
- Specific signature screen: **"What bugs you most?"** — pick your #1 concern. Single-pick from a list of skin/hair/face issues.
- Animated **"Building Your Plan"** experience (same trick as UMAX's loader).
- Asks: beauty goals, skin concerns, age, product preferences.
- Social-proof slide before paywall.
- AI Coach uses the profile data for ongoing recommendations (post-paywall retention hook).

### Tone

Aspirational-warm, not bro-aspirational. "Glow up" replaces "looksmax", "what bugs you most" replaces "what do you want to improve". Same psychology, different register.

### Sources

- <https://apps.apple.com/pl/app/glow-up-app-ai-face-rating/id6760428987>
- <https://play.google.com/store/apps/details?id=com.humpty.glamupai>
- <https://www.glamup.ai/>

---

## 8. Other notable points of comparison

- **FaceIQ Labs** (`faceiqlabs.com`) — premium-positioned. Hard sign-up gate before any analysis (`/login?source=landing_signup` for every CTA). Headline "Your Looks. Measured. Tracked. Improved." Strong "before/after over 2.5 years" hero with a 5.1 → 7.42 case study. Different play: tracking + community ("The Loop"), not one-shot rating.
- **S Tier** (`stier-ai.com`) — "Become S Tier", 3-step pitch (Scan, Get Protocols, Track), gender + goal selection during onboarding (FAQ), hard paywall after signup. Pricing: $15/month or $39 one-time / 90 days.
- **attractivenesstest.com** — explicitly free, Google login gate, no paywall. Acts as a top-of-funnel acquisition tool.
- **Cal AI** (Blake Anderson's adjacent app) — same exact playbook, different domain. Onboarding asks 10+ lifestyle and goal questions, builds a custom plan animation, ends with a paywall. Validated by the same team that built UMAX.

---

## Synthesis

### Top 5 patterns ALL of them use that storyincolor.com/face-rating is NOT using

1. **A self-rating slider** ("How attractive do you see yourself, 1–10?"). UMAX uses it; FaceIQ uses similar self-assessment; Glow Up has "What bugs you most?". You skip this entirely. **It's the single most important commitment device in the funnel** — it makes the user stake a personal opinion they want validated, which is what makes the paid result feel high-value. (Also gives you a useful calibration prior on the server.)

2. **Animated time-projected outcome screens** ("Your first week → Week 10 → 12-week trajectory") *before* the photo upload. UMAX has 4 such screens in a row. They're not asking questions; they're rendering a future the user is now picturing themselves in. Your funnel goes intro → quiz → upload with no projected-outcome interlude.

3. **A press-and-hold / "lock in" / commitment ritual screen.** UMAX literally calls it "Time to lock in. Press and hold." with a fingerprint. Cal AI has the same. Glow Up has "Building your plan" with a long pause. The point is to make the user perform a physical commitment ritual before they upload. You skip this — you go from country chip straight to upload.

4. **A theatrical loader with specific, fake-precise per-user findings** ("3 standout traits detected, 4 areas that could age you faster, 1 high-priority fix flagged"). UMAX, LooksMax AI, Glam Up, S Tier, Cal AI all do this. Your loader (`FACE_LOADER_STEPS`) does the technical version ("Detecting your face… Extracting facial landmarks… Computing harmony…") which is good for credibility but **misses the curiosity-gap mechanic** of personal-sounding counts that only the paywall resolves.

5. **A blurred-result paywall with fake-precise scores.** Every leader does this — UMAX shows 4 cards with blurred numbers and lock icons, LooksMax AI does it twice (once after the native sheet, once at results), Mogged's mobile paywall is the same. Your reveal screen shows the light analysis in full and *then* asks for $4.99. Reversed psychology — the leaders make you pay to see *anything*. (Note: this is a strategy decision, not a copy bug. But you should know the leaders are categorically harder-paywalled than you.)

### Top 3 patterns YOU are using that NONE of them use (red flag)

1. **The "Are you ready for an honest score?" Yes / Maybe later screen.** No competitor uses a binary opt-out gate at this position in the funnel. They use *commitment escalation*, not opt-out branches. A "Maybe later" button in the second screen of an onboarding teaches users they can leave — and they will. **Recommend deleting this screen entirely.** If you keep the "honest" framing, fold it into the intro CTA microcopy ("Get my honest rating"), not a separate screen.

2. **The "Where are you?" country chip.** No one in the category asks. UMAX asks age range (which has plausible "different optimization paths" personalization meaning); Mogged and freepsl ask nothing. Country has a clinical-research feel — "we calibrate against your demographic" — but it reads as either creepy data collection or pointless overhead to a user who's here for vibes. **Recommend deleting and replacing with age range** (the UMAX question), which serves the same calibration function but feels personalization-flavored, not surveillance-flavored.

3. **A 4-option "What are you hoping to find out?" goal chip** with abstractions like "Find my strengths" / "Compare to celebrities". No competitor uses *abstract goal language* at this position. UMAX uses concrete improvement areas ("Skin glow-up, Depuff face, Jawline definition…"). Mogged uses zero questions. Glow Up uses "What bugs you most?" with specific concerns. Your "Compare to celebrities" option in particular is tone-incongruent with the rest of the funnel — the user is in PSL/Chadlite headspace, but you're offering them a feature that sounds like a Buzzfeed quiz.

### Bonus things UMAX does that you should consider

- **Chip copy as character voice.** UMAX's gender chips aren't "Male / Female" — they're "Male — Show me the best plan." / "Female — Personalize my glow-up." Each option carries a micro-promise. Yours read like radio buttons.
- **A mid-funnel mission interstitial** ("Our mission is to help you become the most attractive version of yourself") that reframes the funnel from quiz to journey. Yours has none.
- **A repeated permission slip** — "Be honest. This is just for you." appears on multiple slider/chip screens. It's a verbal contract that compounds. Your chips have generic subtitles ("Pick one — your reading will be more accurate").

---

## Recommended replacement question set, screen by screen

This is the funnel I'd ship. Each screen earns its place — either by capturing data the model needs, escalating commitment, or rendering future outcome.

| # | Screen | Type | Headline | Subhead | Options / behaviour |
|---|--------|------|----------|---------|---------------------|
| 1 | Intro | Hero | **Get your honest face rating.** | Calibrated against thousands of reference photos. PSL tier, sub-scores, archetype, glow-up plan. Same input → same output. | Sample card on left (keep). CTA: **Get my rating**. Microcopy: "60 seconds. One-time $4.99 to unlock the full report." |
| 2 | Gender | Chip | **Who are we reading?** | This calibrates the comparison group. | Male — Show me where I land. / Female — Personalize my read. / Prefer not to say. |
| 3 | Age | Chip | **What's your age range?** | Different ages read differently. | 18–24 / 25–34 / 35–44 / 45+ |
| 4 | Goal — concrete | Chip multi-select | **What do you want to know first?** | Pick what you care about. We lean your reading there. | Where I land on the PSL scale / My biggest strength / What's holding my score back / My glow-up plan |
| 5 | Self-rating slider | Slider | **How would you rate yourself right now?** | Be honest. This is just for you. We'll compare your view to ours. | 1–10 with anchor words: Subhuman / Below avg / Average / Above avg / Chadpreet |
| 6 | Mission interstitial | Statement | "Our job is simple." → "**Give you the honest read no friend will give you** — and the plan to act on it." | (no body) | Continue |
| 7 | Compliments calibrator | Chip | **How often do strangers compliment your looks?** | Helps us read against your real-world feedback. | Never / Rarely / Sometimes / Often / Very often |
| 8 | Lock-in | Press-and-hold | **Time to commit.** | Press and hold to start your reading. | 3-second hold ring, fingerprint icon. |
| 9 | Front photo | Upload | **Front photo.** | Looking at the camera. Good lighting. No filter. | (existing) |
| 10 | Side photo (optional) | Upload | **Side profile.** | 90° turn. Adds jawline + structure depth. Skippable. | (existing) |
| 11 | Loader | Theatrical | **Building your honest read…** | Rotating sub-messages: "3 standout traits detected." / "2 areas that could age your read faster." / "1 high-priority fix flagged." / "Comparing against [N] reference photos in your demographic." | (~10s minimum hold) |
| 12 | Reveal/paywall | Paywall | **Your reading is ready.** | 4 cards: Tier / Overall score / Strongest feature / Glow-up plan — all blurred with lock icons. | One-time $4.99. CTA: **Unlock my reading**. Microcopy: "One-time. No subscription. Save your results." |

That's 12 screens vs. your current 8. Three of the four added screens (self-rating slider, mission interstitial, lock-in) are the commitment-escalation moments the leaders use, and they're the difference between "quiz that ends in a pricing screen" and "ritual that ends in a verdict the user already paid for psychologically."

If you want a shorter SEO-acquisition variant of this funnel for cold traffic from PSL keyword searches, ship a **single-screen Mogged-style upload tool at `/psl-test` or similar** that bypasses everything and goes straight to upload + paywall. Use it for SEO; use the long funnel for paid social.

---

## Specific copy revisions for the 5 worst lines on storyincolor.com/face-rating

| # | Current line | Why it's bad | Replacement |
|---|---|---|---|
| 1 | **"Are you ready for an honest score? Yes / Maybe later."** (entire screen `ready`) | Teaches users they can leave. No leader uses an opt-out gate this early. Reverse-psychology framing reads as a marketing trick. | **Delete the screen.** Move "Honest means honest. We don't inflate." into the intro screen as the line above the CTA. |
| 2 | **"First, who are we reading?" + "Pick one — your reading will be more accurate."** | Generic radio-button voice. UMAX's chips carry promises in the chip copy itself. | **"Who are we reading?"** + chip copy: "Male — Show me where I land." / "Female — Personalize my read." / "Prefer not to say." Drop the subtitle. |
| 3 | **"What are you hoping to find out?"** with options "Find my strengths / See my potential / Compare to celebrities / Get a glow-up plan." | "Compare to celebrities" is tone-incongruent with PSL register; "See my potential" is empty; abstractions don't anchor the user the way concrete improvement axes do (UMAX's pattern). | **"What do you want to know first?"** with concrete options: "Where I land on the PSL scale / My biggest strength / What's holding my score back / My glow-up plan". Multi-select. |
| 4 | **"Where are you?" + "So your reading compares you against the right group."** (the country chip with 21 entries) | No competitor asks. Reads as data-collection. The 21-country list is overhead. | **Replace with age range:** "What's your age range?" + "Different ages read differently." Options: 18–24 / 25–34 / 35–44 / 45+. (UMAX's exact question.) Move country to a server-side IP heuristic if calibration actually needs it. |
| 5 | **Loader sub-messages:** "Same input → same output. No score volatility." / "We use 8 calibrated sub-scores, not just a single number." / "Your photos never leave our servers unencrypted." / "Almost there." | These are *vendor-voice* claims (Anthropic-style trust claims) instead of *user-voice* findings. They reduce curiosity rather than escalate it. | **Replace with personal-sounding fake-precise findings:** "3 standout traits detected." / "2 areas that could age your read faster." / "1 high-priority fix flagged." / "Comparing against thousands of reference photos in your demographic." / "Calculating your honest baseline." This is UMAX's exact mechanic — verbatim per the live walkthrough. |

---

## Sources

- UMAX live walkthrough — `https://ailooksmaxing.app/webapp/onboarding/gender` through `/paywall`, captured 2026-05-06.
- ScreensDesign UMAX teardown: <https://screensdesign.com/showcase/umax-become-hot>
- ScreensDesign LooksMax AI teardown: <https://screensdesign.com/showcase/looksmax-ai>
- ScreensDesign LooksMax Face Rating AI / LooxUP teardown: <https://screensdesign.com/showcase/looksmax-rating-ai-face-rater>
- Superwall Part 2 (Madden-style design + "evil onboarding" framing): <https://superwall.com/blog/part-2-how-to-design-a-viral-app-in-2025/>
- Mogged web tools: <https://www.moggedupapp.com/tools/mogger-test>, <https://www.moggedupapp.com/tools/psl-score>
- Mogged article on competitors: <https://mogged.link/articles/mogged-vs-umax-vs-looksmax-ai>
- Mogged "best looksmax AI apps": <https://mogged.link/articles/best-looksmax-ai-apps>
- FreePSL: <https://freepsl.com/>
- FaceIQ Labs: <https://www.faceiqlabs.com/>
- S Tier: <https://stier-ai.com/>
- LooksMax AI App Store reviews: <https://apps.apple.com/us/app/looksmax-ai/id6474518292>
- LooksMax Face Rating AI App Store reviews: <https://apps.apple.com/us/app/looksmax-rating-ai-face-rater/id6478697267>
- UMAX iOS App Store: <https://apps.apple.com/us/app/umax-become-hot/id6471026798>
- Glow Up App: <https://apps.apple.com/pl/app/glow-up-app-ai-face-rating/id6760428987>
- attractivenesstest.com Looksmax Report: <https://attractivenesstest.com/looksmax>

Existing source files for the funnel under teardown:

- `/Users/ipekai/Documents/devproj/aibooks/components/face-rating/FaceRatingFlow.tsx` (8-screen flow)
- `/Users/ipekai/Documents/devproj/aibooks/lib/face-rating/types.ts` (chip options, loader copy, screen sequence)
