# Loop instructions — StoryInColor quiz-funnel pivot implementation

> This is the per-iteration prompt for `/loop`. Each time the loop fires, treat this file as your instructions for ONE iteration of work toward shipping the quiz-funnel pivot.

## Goal

Implement the StoryInColor quiz-funnel pivot end-to-end as specified in `QUIZ-PIVOT-SPEC.md`. The pivot replaces the current sign-up-first credit-store funnel with a quiz → upload → blurred reveal → tiered subscription paywall. This must ship without disrupting the existing site, ads, or users (per spec §19).

## Source of truth

- **Authoritative spec:** `/Users/ipekai/Documents/devproj/aibooks/QUIZ-PIVOT-SPEC.md`
  - §17 — pricing (the v2.1 hybrid: $14.99/mo subscription hero + $89.99/yr + $11.99 single)
  - §19 — parallel deployment & rollout strategy
  - §20 — loop-driven implementation workflow (this is the operational guide for what you're doing)
  - §20.3 — Definition of Done (the checklist you're driving toward)
  - §20.4 — per-iteration checklist
  - §20.5 — end-to-end browser verification scenario
  - §20.6 — iteration log format
  - §20.7 — when to stop and surface to founder
  - §20.8 — cost/iteration ceilings
- **Architecture context:** `CLAUDE.md` at repo root
- **Brand/copy invariants:** `DECISIONS.md` at repo root
- **Pivot iteration log:** `IMPLEMENTATION-LOG.md` at repo root (create on first iteration if missing)

## Per-iteration procedure (run this every time)

### Step 1 — Read state

1. Read `IMPLEMENTATION-LOG.md`. The last entry tells you what iteration you're on and what's next.
2. Read `QUIZ-PIVOT-SPEC.md` §20.3 and find the next unchecked item, in dependency order:
   - Phase 0 items first (preparation), then Phase 1 (backend), Phase 2 (frontend), Phase 3 (analytics), Phase 4 (smoke test), Phase 5 (soft launch).
3. If §20.3 has unchecked items: pick the next one, proceed to Step 2.
4. If all §20.3 items are checked AND §20.5 browser test passes AND §20.5 regression test passes: write the final summary entry to `IMPLEMENTATION-LOG.md` titled "Pivot complete — ready for Phase D rollout per §19.3" and stop the loop with a "DONE — surfacing to founder" message.

### Step 2 — Do the work

Implement the next §20.3 item:
- Backend changes: edit files under `functions/src/`, deploy with `cd functions && npm run deploy` (NEVER skip the build step).
- Frontend changes: edit files under `app/`, `components/`, `lib/`, build with `npm run build`.
- Schema/rules changes: edit `firestore.rules`, `storage.rules`, `firestore.indexes.json`, deploy with `firebase deploy --only firestore:rules,firestore:indexes,storage`.
- Stripe products/prices: use Stripe MCP tools (`mcp__acb…__create_product`, `mcp__acb…__create_price`).
- Image assets: generate via existing `scripts/generate-sample.mjs` pattern or manual upload, commit under `public/images/quiz/`.

Follow the architectural constraints in spec §19.2:
- All changes are **additive** to existing code unless explicitly conditional.
- The `stripeWebhook` modification MUST wrap new code in `if (session.metadata.pendingReadingToken) { ... }` so the existing one-time-payment branch is byte-for-byte unchanged.
- The kill-switch env var `STORYINCOLOR_QUIZ_FUNNEL_ENABLED` must gate the new unauth Cloud Functions.

### Step 3 — Verify (the exit gates)

Run the gates per spec §20.4. **All must pass before the §20.3 box is checked:**

```bash
# Root TypeScript
npx tsc --noEmit
# Root build
npm run build
# Functions TypeScript
cd functions && npx tsc --noEmit && cd ..
# Functions build
cd functions && npm run build && cd ..
# Lint
npm run lint
```

If any gate fails: read the error, fix the minimum, re-run the failing gate. Do NOT check the box. The loop will pick up the same item on the next iteration.

**If a Cloud Function was deployed:** verify health via `firebase functions:list` and tail logs with `firebase functions:log --limit 20` for unexpected errors.

**If Stripe/Firestore/Storage was changed:** smoke-test the change via the matching `firebase functions:shell` invocation or Stripe test event before checking the box.

### Step 4 — Phase-boundary verification (when applicable)

If this iteration COMPLETES the last item of a phase (Phase 0, 1, 2, 3, 4):

1. Run the §20.5 end-to-end browser verification using **Claude in Chrome MCP** (`mcp__Claude_in_Chrome__*` tools). Required scenario:
   - Open Chrome at `https://storyincolor.com/quiz/hairstyle?utm_source=loop-test&utm_medium=manual`
   - Walk through all 8 quiz screens (tap an option on each)
   - Upload a stock test photo (use `public/images/tools/face-reading-input.webp` or generate a sample)
   - Wait for the loader (≥12s)
   - Verify blurred reveal screen appears with headline insight
   - Type a unique test email: `loop-test-{timestamp}@storyincolor.dev`
   - Verify paywall renders with both tier cards + bottom escape link
   - Tap "Start 7-day free trial"
   - Use Stripe test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC
   - Verify post-payment unblur transition fires
   - Verify magic-link email is dispatched (check email service log)
   - Click magic link → verify landing on `/dashboard`
   - Verify the reading appears in the user's library
   - Verify Reading Profile is populated at `/dashboard/profile`
   - Capture screenshots of paywall, post-payment unblur, and dashboard for the iteration log

2. Run the §20.5 existing-flow regression check:
   - Open `https://storyincolor.com/readings/palm-reading` in Chrome
   - Verify marketing page renders normally
   - Open `https://storyincolor.com/credits` (signed in with founder's existing test account)
   - Verify pack list still renders; complete a $9.99 single pack purchase with Stripe test card
   - Verify the credit lands in `userCredits/{uid}`
   - Open `/dashboard` for an existing user
   - Verify their previous readings still render

3. If both pass: check off the phase boundary, append a phase-complete entry to `IMPLEMENTATION-LOG.md`.

4. If either fails: surface to the founder with a "Phase X failed verification — needs review" message, screenshots, and the specific failure mode. Stop the loop until the founder responds.

### Step 5 — Founder approval gates

Per spec §19.7, **stop the loop and surface to the founder** at these phase boundaries:
- End of Phase A (everything built, ready to smoke-test) — wait for "go to Phase B" approval before running browser verification in production.
- End of Phase B (smoke test passed, ready to switch one ad URL) — wait for "go to Phase C" approval before changing any ad's `link_data.link`.
- Each Phase D ad URL switch — one founder approval per ad.

For all other iterations within a phase: continue without surfacing. Don't ask permission for routine work; ask permission for traffic-affecting actions.

### Step 6 — Log

Append an entry to `IMPLEMENTATION-LOG.md` per spec §20.6 format:

```markdown
## Iter N — YYYY-MM-DD HH:MM UTC

**Phase:** [0 | 1 | 2 | 3 | 4 | 5]
**Item attempted:** [exact §20.3 item text]
**Result:** [✅ passed / ❌ failed / ⚠️ partial]
**Gate output:**
  - npm run build: [exit code, key errors if any]
  - tsc --noEmit: [exit code]
  - functions build: [exit code]
**Action:** [what was committed, deployed, configured — include commit hashes]
**Next:** [next §20.3 item to attempt]
**Notes:** [anything unexpected or worth a human eye]
```

If you ran a phase-boundary verification this iteration, also include screenshot paths.

### Step 7 — Pacing

For dynamic-mode `/loop` (no fixed interval): pick the next delay based on what you saw.
- If you completed a checkable item and the gates passed: 5–15 minutes — there's clear next work.
- If you're mid-debug: 1–3 minutes — pick up fast.
- If you're waiting on Cloud Functions deploy propagation: 5 minutes.
- If you completed a phase boundary and surfaced to the founder: 60 minutes (the founder needs time to look).

For fixed-interval `/loop 15m` etc.: the interval is fixed; just do one iteration's worth of work and exit.

## Stop conditions (per spec §20.7)

**Auto-stop and surface to founder when:**
- A phase boundary is reached (A, B, C per §19.7).
- The end-to-end browser test fails 3 iterations in a row on the same step.
- The existing-flow regression check fails (this is a Phase 0 violation).
- A Stripe webhook event handling error appears in `firebase functions:log`.
- Iteration count reaches 50 in the current session (per spec §20.8).
- Unexpected OpenAI spend > $5 in any single hour (per spec §20.8 — abuse of unauth generate path).

**Continue without surfacing when:**
- A gate fails (build, type check, test): fix and re-run.
- A code change requires a redeploy: deploy and continue.
- A test asset is missing: generate it and continue.
- A copy string is unspecified: pick the spec's default (§14, §17) and continue.

## Cost/safety guards

- The unauth `generateForToolUnauth` path MUST be IP-rate-limited from day one. Verify by hitting it 6× from one IP — 6th must return 429.
- Never disable the `STORYINCOLOR_QUIZ_FUNNEL_ENABLED` kill switch from within the loop without founder approval.
- Never push to the `main` branch of the served-public repo without a founder green-light at Phase B.
- Never modify ad `link_data.link` URLs from within the loop without an explicit founder approval per spec §19.7. The loop builds and tests; the founder routes traffic.

## Done

The loop succeeds when all of:
1. All §20.3 boxes are checked.
2. §20.5 end-to-end browser test passes for at least one reading (default: hairstyle).
3. §20.5 existing-flow regression test passes.
4. Founder has approved Phase A→B and B→C transitions.
5. Final summary entry written to `IMPLEMENTATION-LOG.md` titled "Pivot complete — ready for Phase D rollout per §19.3".

After this, additional ad URL switches per Phase D are founder-driven.

## Hard rules — do not violate

- Do NOT touch existing `app/readings/[slug]/*`, `app/credits/`, `app/login/`, `app/dashboard/` files unless the change is explicitly required by the spec AND additive.
- Do NOT modify the existing `generateForTool`, `ensureUserCredits`, `createCheckoutSession` Cloud Functions; only ADD new ones and ADD a conditional branch in `stripeWebhook`.
- Do NOT alter the existing `userCredits/{uid}` schema in a non-additive way. New fields must be optional with sensible defaults.
- Do NOT skip the existing-flow regression check at phase boundaries. If founder discovers existing /credits is broken, that's a far worse outcome than missing a quiz funnel deadline.
- Do NOT commit secrets. If a Cloud Functions secret is missing, surface to the founder; don't hardcode.
- Do NOT push to the served-public repo. The GitHub Pages deploy workflow handles that automatically on push to main.
- Do NOT modify `DECISIONS.md` from within the loop without quoting the exact founder direction that authorizes the change.

If you find yourself wanting to do any of the above, stop and surface to the founder.
