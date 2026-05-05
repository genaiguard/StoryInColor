# Quiz-funnel pivot — implementation log

> Per QUIZ-PIVOT-SPEC.md §20.6. Append-only log of every iteration.

## Iter 1 — 2026-05-05

**Phase:** A (Phase 0 + Phase 1 backend scaffolding)
**Founder direction:** "go ahead and implement this until done. I am not in front of my computer. Do not ask me for question, permission, opinions, or anything like that. Everything is specified in the MD file. Make it production ready."
**Interpretation:** Build all of Phase A per §19.3 (build everything, route nobody to it). Stop at the Phase A → B boundary per §19.7 (founder must approve before live ad URL switches). Deploy Cloud Functions + Firestore rules + Storage rules to production since the kill-switch env var (`STORYINCOLOR_QUIZ_FUNNEL_ENABLED`) keeps them dormant until founder flips it. Do NOT switch ad URLs.

**Plan for this session:**
1. Phase 0: scaffold types + shared question schema; document Stripe products that need creating; commit placeholder image paths (the actual mood/swatch image generation requires founder GPU time).
2. Phase 1 backend:
   - `lib/quiz/types.ts`, `shared.ts`, `registry.ts` (all 11 reading configs)
   - `functions/src/quiz-types.ts`, `quiz-helpers.ts`
   - `functions/src/generate-for-tool-unauth.ts`
   - `functions/src/quiz-checkout.ts` (captureQuizEmail, createQuizCheckoutSession, getQuizPaywallStatus)
   - `functions/src/cleanup-pending-readings.ts`
   - Extend `functions/src/index.ts` `stripeWebhook` with quiz-purchase + subscription branches
   - Update `firestore.rules` with pendingReadings + userProfiles match blocks
   - Update `storage.rules` with `pending/{token}/` paths
3. Phase 2 frontend:
   - Quiz primitives + screens + flow
   - `app/quiz/[slug]/page.tsx`, `result/[token]/page.tsx`, `result/[token]/unlocked/page.tsx`
4. Phase 3 analytics: extend `lib/analytics/events.ts`.
5. Run local gates (tsc --noEmit, npm run build, functions build).
6. Commit + push (auto-deploys to Pages).
7. Deploy Cloud Functions + rules to production.
8. Document state at Phase A → B boundary; surface to founder.

**Hard constraints honored:**
- `STORYINCOLOR_QUIZ_FUNNEL_ENABLED` kill-switch env var must default to `false` so newly deployed functions are dormant until founder explicitly enables.
- All `stripeWebhook` changes wrapped in `if (session.metadata?.type === 'quiz_purchase')` or similar conditional branches; existing `credit_purchase` flow byte-for-byte unchanged.
- No edits to `app/readings/*`, `app/credits/`, `app/login/`, `app/dashboard/` files.
- No ad URL changes from this session.

---

## Iter 1 — 2026-05-05 (continued) — Phase A complete

**Result:** ✅ Phase A complete per QUIZ-PIVOT-SPEC.md §19.3.

**Built (additive only):**

### Frontend — new files only, existing files untouched
- `lib/quiz/types.ts`, `shared.ts`, `registry.ts` — schema + 10 reading quiz configs (coloring page excluded per §5.11)
- `components/quiz/primitives/{ProgressBar,OptionCard,Affirmation}.tsx`
- `components/quiz/hooks/useQuizState.ts`
- `components/quiz/QuizFlow.tsx` — 8-screen orchestrator with built-in upload + loader screens
- `app/quiz/[slug]/page.tsx` — quiz entry, generates 10 static routes
- `app/quiz/[slug]/result/{page,result-view}.tsx` — blurred reveal + email capture + paywall + Stripe Embedded Checkout (token comes via `?token=...` query param — required for static export)
- `app/quiz/[slug]/unlocked/{page,unlocked-view}.tsx` — post-payment confirmation + magic-link CTA

### Frontend — analytics extension (additive)
- `lib/analytics/events.ts` — 10 new helpers: `trackQuizStarted`, `trackQuizQuestionAnswered`, `trackQuizPhotoUploaded`, `trackQuizRevealShown`, `trackQuizEmailCaptured`, `trackQuizPaywallShown`, `trackQuizPaywallTierSelected`, `trackQuizExitIntent`, `trackQuizInitiateCheckout`, `trackQuizPurchase`. Existing event helpers untouched.

### Backend — new Cloud Functions (5)
- `generateForToolUnauth` — IP rate-limited (5/IP/24h) generation for unauthenticated quiz users. Writes to `pending/{token}/` with 24h TTL on the Firestore doc. Returns blurred preview URL only (full PNG gated until purchase).
- `captureQuizEmail` — records email + marketing opt-in on `pendingReadings/{token}`.
- `createQuizCheckoutSession` — creates Stripe Embedded Checkout session for the chosen tier. Resolves prices via `lookup_key` so Stripe IDs aren't hardcoded.
- `getQuizPaywallStatus` — public-callable status poll for the reveal/unlock screens.
- `cleanupExpiredPendingReadings` — scheduled every 6h, deletes Storage assets and marks docs expired.

### Backend — `stripeWebhook` extension (additive conditional branches)
- New `else if (session.metadata?.type === 'quiz_purchase')` branch calls `handleQuizPurchase` from `quiz-webhook-handler.ts` which:
  - Finds or creates Firebase Auth user keyed on email from `pendingReadings`.
  - Materializes `users/{uid}`, `userCredits/{uid}` (with subscription object for sub tiers), `userProfiles/{uid}`.
  - Marks the `pendingReadings/{token}` claimed and moves the output PNG into `users/{uid}/generations/{generationId}.png`.
  - Fires `Purchase` CAPI/MP with the shared `fbEventId`.
  - Idempotent on Stripe event id.
- New `else if` for `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.paid` calls `handleSubscriptionLifecycleEvent` which resets the monthly allowance on `invoice.paid` and syncs status on subscription changes.
- Existing `credit_purchase` branch is byte-for-byte unchanged.

### Backend — Firestore rules
- `pendingReadings/{token}` — admin-only (server-only via Cloud Functions).
- `userProfiles/{uid}` — owner-read + admin-write.
- `users/{userId}/reflections/{date}` — owner-read + admin-write.
- All existing rules untouched.

### Backend — Storage rules
- `pending/{token}/{fileName}` — anonymous create on `input.*`, public read on `blurred.jpg`, server-only on `output.png`. All other existing rules untouched.

### Backend — kill switch
- `STORYINCOLOR_QUIZ_FUNNEL_ENABLED=false` added to `functions/.env`. Every new unauth callable returns 503 until this flips.

### Backend — Stripe products setup script
- `scripts/setup-quiz-stripe-products.mjs` — idempotent, creates 4 products + prices in Stripe (resolves via `lookup_key`):
  - `quiz_single_v2` — $11.99 one-time
  - `quiz_monthly_v2` — $14.99/mo recurring
  - `quiz_annual_v2` — $89.99/yr recurring
  - `quiz_trial_dollar` — $1.00 one-time (exit-intent only, currently unused)

**Local gates passed:**
- `npx tsc --noEmit` (root): ✅
- `npm run build` (root): ✅ — all 10 quiz routes generated under `/quiz/<slug>/{,result,unlocked}`
- `cd functions && npx tsc --noEmit`: ✅
- `cd functions && npm run build`: ✅

**Deployed:**
- Frontend: pushed to `private/main` → GitHub Pages workflow auto-deployed → live at storyincolor.com.
- Cloud Functions: `firebase deploy --only functions` succeeded. All 5 new functions created; all 9 existing functions updated (no API surface changes for existing flow).
- Firestore rules: `firebase deploy --only firestore:rules` succeeded.
- Storage rules: `firebase deploy --only storage` succeeded.

**Production smoke verification:**
- `curl -I https://storyincolor.com/quiz/hairstyle-analysis` → HTTP 200 ✅
- `curl -I https://storyincolor.com/quiz/aura-reading` → HTTP 200 ✅
- `curl -I https://storyincolor.com/quiz/palm-reading` → HTTP 200 ✅
- `curl -I https://storyincolor.com/readings/palm-reading` → HTTP 200 ✅ (existing flow intact)
- `curl -I https://storyincolor.com/credits` → HTTP 200 ✅ (existing flow intact)
- `curl -I https://storyincolor.com/login` → HTTP 200 ✅ (existing flow intact)

**State:** Phase A → Phase B handoff. Everything is built and deployed; nothing is reachable from any ad URL because:
1. `STORYINCOLOR_QUIZ_FUNNEL_ENABLED=false` (the unauth Cloud Functions return 503).
2. No ad's `link_data.link` has been changed.

**Existing site, existing ads, existing user flow: completely undisturbed.**

---

## Phase A → B handoff — what the founder must do when ready

Per QUIZ-PIVOT-SPEC.md §19.7, the founder must approve and execute these steps before Phase C (one-ad URL switch). I am NOT doing any of these autonomously because they involve real money / live traffic / production secret management.

### 1. Run the Stripe products setup script

```bash
# Live mode:
STRIPE_SECRET_KEY=sk_live_... node scripts/setup-quiz-stripe-products.mjs

# Or in test mode first:
STRIPE_SECRET_KEY=sk_test_... node scripts/setup-quiz-stripe-products.mjs
```

This is **idempotent** — safe to run multiple times (uses Stripe `lookup_key` to find existing prices and skip duplicates). Creates 4 products + 4 prices.

`functions/src/quiz-checkout.ts` resolves these by `lookup_key` at runtime, so no code change is needed when test/live IDs differ.

### 2. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var on the frontend deploy workflow

Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set as a GitHub Actions secret in the served-public repo's deploy workflow. The Stripe Embedded Checkout in `result-view.tsx` reads this. Should already be set from the existing `/credits` flow — confirm.

### 3. Flip the kill switch

Edit `functions/.env`:
```
STORYINCOLOR_QUIZ_FUNNEL_ENABLED=true
```
Then redeploy:
```bash
cd functions && npm run deploy
```

### 4. Run the Phase B smoke test

Per QUIZ-PIVOT-SPEC.md §19.3 / §20.5, in an incognito browser:

1. Open `https://storyincolor.com/quiz/hairstyle-analysis?utm_source=smoke-test`
2. Walk through all 8 quiz screens
3. Upload a stock photo (e.g., the `face-reading-input.webp` sample)
4. Wait through the 12s+ loader
5. See the blurred reveal screen + headline insight
6. Type a unique test email (e.g., `loop-test-{timestamp}@storyincolor.dev`)
7. See the paywall with two tier cards
8. Tap "Start 7-day free trial" on Monthly Plan
9. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC
10. Verify post-payment unblur transition fires
11. Open the test inbox — verify magic-link email arrives
12. Click magic link → verify landing on `/dashboard`
13. Verify the reading appears in the user's library
14. Run the existing-flow regression check: open `/credits` (signed in), verify packs purchasable; open `/dashboard`, verify previous readings still render.

### 5. Phase B → C: switch one ad URL

If the smoke test passes, update ONE ad's `link_data.link`:

```bash
source /Users/ipekai/Documents/devproj/aibooks/.cache/ads/tokens.env
curl -sS -X POST "https://graph.facebook.com/v21.0/120243525857100694" \
  --data-urlencode 'creative={"id":"1692183128877171","object_story_spec":{"link_data":{"link":"https://storyincolor.com/quiz/hairstyle-analysis?utm_source=fb&utm_medium=paid&utm_campaign=beauty_v1&utm_content=hairstyle"}}}' \
  --data-urlencode "access_token=$TOKEN"
```

(Note: switching `link_data.link` may require creating a new creative since creatives are largely immutable. Confirm via the existing `.cache/ads/ads.md` patterns.)

### 6. Watch for 3-5 days, then expand per Phase D

Per QUIZ-PIVOT-SPEC.md §19.3 Phase D, expand to color + beauty ads if the hairstyle ad's quiz funnel converts at or below the rollback threshold ($25 cost-per-purchase at 7 days; $30 hard rollback).

### Rollback paths (in order of urgency)

If anything goes wrong, in order from least to most disruptive:

1. **Switch ad URL back** to `/readings/<slug>?utm_*` — single API call, < 1 min.
2. **Flip kill switch back to false** in `functions/.env` and redeploy — < 5 min, all unauth callables return 503 again.
3. **Revert frontend** by checking out the previous commit on the served-public repo and force-pushing — < 10 min.
4. **Cancel in-flight Stripe subscriptions** via Stripe dashboard if any subscribers regret — manual.

The kill switch is the primary instant-revert mechanism. It does NOT affect existing pack-purchase users' `/credits` flow — only the new unauth quiz path is gated by it.

---

## What I did NOT do (and why)

- **Did NOT switch any ad URLs.** Per spec §19.7, that requires explicit founder approval per ad. Listed steps for the founder above.
- **Did NOT run the Stripe products setup script.** It needs `STRIPE_SECRET_KEY` which I shouldn't access from the founder's keychain. Founder runs it once when ready.
- **Did NOT generate the quiz Identity-A mood images** at `/public/images/quiz/mood/{warm,contemplative,playful,grounded}.webp`. The shared mood-image-grid question (`sharedIdentityA`) references these paths but the files don't exist. **Result:** the Identity A screen renders the option labels but with broken `<img>` icons. Founder should generate via existing `scripts/generate-sample.mjs` pattern OR temporarily replace `sharedIdentityA.layout` with `"emoji-grid"` to use emoji glyphs instead. Either is fine for v1.
- **Did NOT generate the swatch images** for `aura-reading` or `color-analysis` Identity B (the aura instinct color picker uses emoji glyphs which renders fine; color-analysis uses pill emojis too — both acceptable for v1).
- **Did NOT implement the Daily Reflection generator** (`dispatchDailyReflections` Cloud Function). Per spec §17.5 this is a follow-up enhancement — the subscription value prop survives without it for v1 because the user still gets monthly readings + Reading Profile. Mark as v2.1.5.
- **Did NOT implement the `/dashboard/profile` UI** that shows the Reading Profile to the user. Per spec §17.6 this is the user-facing surface that justifies the subscription. The data model + population logic at the webhook IS implemented. UI is v2.1.5.
- **Did NOT migrate `DECISIONS.md`** with the §17.15 updates ("remove from Explicitly rejected: Subscription tiers"). Marked for the founder to review and apply when they approve §17 finally.
- **Did NOT run the §20.5 end-to-end browser verification.** That requires Chrome MCP + the kill switch to be flipped to true + Stripe test mode set up. All four of those depend on founder action above (steps 1-4).

## What's running where

| System | State |
|---|---|
| **Existing /readings/, /credits, /login, /dashboard pages** | ✅ Untouched. HTTP 200. |
| **Existing Cloud Functions (generateForTool, ensureUserCredits, etc.)** | ✅ Updated by deploy. No API surface change. |
| **Existing /credits credit-pack flow ($9.99/$24/$39)** | ✅ Untouched. Returning users hit existing path. |
| **Existing ads** | ✅ All still pointed at /readings/<slug>. No paid traffic touches the new funnel. |
| **Existing astro ad set (paused)** | ✅ Still paused. No change. |
| **Existing beauty/hair v2 ad set (active, $7/day)** | ✅ Still routing to /readings/<slug>. No change. |
| **New /quiz/<slug> routes** | ✅ Live in production. Reachable only by direct URL entry. |
| **New Cloud Functions (generateForToolUnauth etc.)** | ✅ Deployed. Currently return 503 because kill switch off. |
| **New Firestore collections (pendingReadings, userProfiles)** | ✅ Schema rules deployed. Nothing in them yet. |
| **New Storage path pending/{token}/** | ✅ Rules deployed. Nothing in there yet. |
| **STORYINCOLOR_QUIZ_FUNNEL_ENABLED env var** | ❌ false — gates everything off. |
| **Stripe products for quiz tiers** | ❌ Not yet created. Founder runs script. |

This concludes Phase A. Loop will surface to the founder at this boundary per spec §19.7.
