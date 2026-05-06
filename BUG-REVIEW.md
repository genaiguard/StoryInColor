# Face Rating (PIVOT-2) — Pre-deploy Bug Review

Reviewer: senior code reviewer pass, performed by reading every file referenced in the brief plus immediate dependencies. References are file:line on `main` at the time of review.

---

## Critical bugs (must fix before deploy)

### C1. Shared URL leaks `pendingToken`, enabling full-reading theft + photo deletion by anyone with the share link

- **Files:** `functions/src/face-rating-checkout.ts:269-280`, `firestore.rules:100-103`, `app/r/shared-view.tsx:36-49`, `functions/src/analyze-face-full.ts:180-237`
- **Impact:** Anyone who clicks a shared-rating link can:
  1. Read `sharedFaceReadings/{shareId}` (firestore.rules grants public read).
  2. Extract the `pendingToken` field that the create flow writes into the doc.
  3. Call `getFaceFullReport({token})` and receive the **full paid report** (because the owner is `claimed` or `inviteUnlocked`). No auth, no ownership check, only the token is required.
  4. Call `deleteFaceRatingPhoto({token})` and **erase the original owner's photos**.
  5. Call `setFaceRatingShareEnabled({token, enabled: false})` and toggle the original owner's share on/off.
- **Fix:** Do NOT store `pendingToken` on the public `sharedFaceReadings` doc. Materialize a self-contained snapshot of the publicly displayable fields only (`tierLabel`, `overallScore`, plus whatever else the share view should render). All future server-side operations should look up by `shareId` -> server-only mapping (e.g., a separate `_internal` field on the doc that is removed by a `read` rule restricted to admin, or a parallel `sharedFaceReadingsInternal/{shareId}` admin-only doc that holds the link to `pendingToken`). Then add an `request.auth.uid` check on `deleteFaceRatingPhoto` / `setFaceRatingShareEnabled` / `getFaceFullReport` so even if a token leaks, only the claimed owner can act.

### C2. `getFaceFullReport`, `deleteFaceRatingPhoto`, `setFaceRatingShareEnabled`, `getOrCreateFaceRatingInviteCode`, `getFaceRatingPaywallStatus`, `redeemFaceRatingInvite` are all UNAUTHENTICATED — anyone with the token has full ownership

- **Files:** all of `functions/src/face-rating-checkout.ts` and `functions/src/analyze-face-full.ts:180`. Verified by `grep -n "request.auth"` returning zero hits.
- **Impact:** Token = bearer credential. There is no `request.auth.uid` check anywhere. Once a token leaks (via C1, via someone sharing their result URL, via referer leakage from the result-page Stripe iframe, via DevTools console screenshots, via misconfigured analytics that capture URLs), the entire account state for that token is at the attacker's disposal: they can read the full paid analysis, delete the owner's photos, toggle share on/off, mint and read invite codes for the owner, and abuse all of that without auth.
- **Fix:** The pendingReadings doc claims a `claimedByUid` once a purchase webhook fires. Once `claimedByUid` is set, every callable above MUST require `request.auth.uid === pending.claimedByUid`. (The pre-claim flow can keep token-only auth because there's no privileged data to exfiltrate yet — only the light analysis, which the legitimate caller already has.)

### C3. `analyze-face-full.ts` operator precedence in unlock check looks correct but the surrounding logic is wrong

- **File:** `functions/src/analyze-face-full.ts:199-201`
- **Code:**
  ```ts
  const isPaid =
    pending.status === "claimed" ||
    pending.status === "ready" && pending.inviteUnlocked === true;
  ```
- **Impact:** Operator precedence is OK (`&&` binds tighter), so this evaluates as `claimed || (ready && inviteUnlocked)`. However, an `inviteUnlocked` user who completes the invite-3 path stays in status="ready" and is granted access. This is intended. Combined with C1+C2 it becomes a critical issue: an attacker doesn't need to pay or invite — they just need the leaked token and the owner's status to be `claimed` or `ready+inviteUnlocked` to get the full report.
- **Fix:** Ship C2 (require `request.auth.uid === pending.claimedByUid`) and C1 (don't leak the token). Then this expression is fine.

### C4. Storage rule does not validate token is a UUID — opens DoS / cost vector

- **File:** `storage.rules:37-44`
- **Impact:** `match /pending/{token}/{fileName}` accepts any string for `{token}` and lets anonymous clients create up to 10MB image files at any path matching `input-front.*` / `input-side.*` / `input.*`. There is no rate limit at the storage layer and no requirement that `{token}` ever became a registered `pendingReadings` doc. An attacker can fill the bucket with garbage image data at custom token paths, paying you nothing. The `pendingReadings` 24h TTL only deletes Firestore docs; the storage objects must be cleaned by `cleanupExpiredPendingReadings`.
- **Fix:** Add a regex on `{token}` in the rule to require a UUID-shape: `match /pending/{token}/{fileName} { allow create: if token.matches('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}') && ... }`. Then audit the cleanup job to ensure storage files are deleted on TTL doc removal — pendingReadings TTL only deletes the Firestore doc.

### C5. `cleanupExpiredPendingReadings` doesn't appear to handle face-rating storage paths

- **Files:** `functions/src/cleanup-pending-readings.ts` (not in changeset, but referenced).
- **Impact:** If the cleanup function only deletes legacy `pending/{token}/input.*` and `output.png` paths, the new `input-front.*` / `input-side.*` files will leak forever. Combined with C4 (no UUID-shape requirement), bucket usage grows unbounded.
- **Fix:** Verify the cleanup function deletes ALL files under `pending/{token}/` regardless of name, not a specific allowlist. (Could not confirm in this review — the file is not in the changeset and was not requested to be reviewed; flagging because the new face-rating uploads use new file names.)

---

## High-priority bugs (fix before public launch)

### H1. `redeemFaceRatingInvite` race condition double-counts redemptions

- **File:** `functions/src/face-rating-checkout.ts:425-456`
- **Impact:** The check `redeemer.creditedInviteCodes?.includes(lower)` happens OUTSIDE the transaction. Two concurrent calls with the same `(token, inviteCode)` both pass the check, then both run the transaction. `arrayUnion(lower)` is idempotent so `creditedInviteCodes` ends up correct, but **`inviteRedemptions` and `faceInviteCodes/{code}.redemptions` are both incremented twice** for the same friend. A user could double-tap the redeem call to fast-track to inviteUnlocked (3 friends → 1.5 friends in practice).
- **Fix:** Move the `creditedInviteCodes.includes(lower)` check INSIDE the transaction. Read the redeemer doc with `tx.get()`, abort if already credited.

### H2. `analyzeFaceUnauth` idempotency check is non-transactional

- **File:** `functions/src/analyze-face-unauth.ts:147-201`
- **Impact:** `existing = await pendingRef.get()` → branch on existing → `pendingRef.set(initialDoc)`. Two concurrent calls with the same token both see no existing doc, both call OpenAI, both burn the budget. Cost: 2× $0.001/Stage1 (negligible), but if the attacker batches concurrent requests the per-IP rate limit (3/24h) doesn't catch the burst because `pendingReadings` writes lag the rate-limit query. Cost cap is the global 60/day, but inside that cap an attacker can still 2x or 3x the spend.
- **Fix:** Wrap idempotency + initial doc write in a transaction. Or use `pendingRef.create()` (Firestore native CAS — fails if doc exists) and treat the failure as "already running". Then the second caller can return the in-flight result.

### H3. `analyze-face-full.ts` lazy-run race when two callers call `getFaceFullReport` simultaneously post-checkout

- **File:** `functions/src/analyze-face-full.ts:211-236`
- **Impact:** Webhook hasn't yet written `fullAnalysis`. Two clients (or the webhook itself + the polling client) call `runFaceStage2ForToken(token)` simultaneously. Both pass the `pending.fullAnalysis` cache check at line 57, both call OpenAI, both write to `fullAnalysis`. Cost: 2× $0.02-0.04 per duplicated run.
- **Fix:** Add a short-lived "stage2InProgress" flag on the pendingReadings doc, set inside a transaction. The second caller that sees the flag should poll instead of calling OpenAI again. Or: treat the webhook as the only Stage 2 trigger and let the result page strictly poll, never lazy-run.

### H4. `pending.toolId` is undefined for face-rating docs but `quiz-checkout.ts` reads it without null-check

- **Files:** `functions/src/quiz-checkout.ts:142-158`. The legacy `captureQuizEmail` callable does:
  ```ts
  const toolName = TOOL_NAME_BY_ID[pending.toolId] ?? getServerToolConfig(pending.toolId)?.outputType ?? "Reading";
  const headlineInsight = HEADLINE_FALLBACKS[pending.toolId] ?? "Your reading is ready.";
  const unlockUrl = `https://storyincolor.com/quiz/${pending.toolId}/result?token=${token}`;
  ```
- **Impact:** A face-rating token can be passed to the legacy `captureQuizEmail` callable. If the face-rating pending doc is in `status === "ready"` and has no email yet, `captureQuizEmail` will:
  1. Set the face-rating pending doc's email field.
  2. Try to send a quiz reading-ready email containing `unlockUrl = .../quiz/undefined/result?token=...`, leading to a broken email + a redirect through `LegacyQuizRedirect.tsx` which strips the path and bounces to `/face-rating?token=...`. Token query then doesn't carry through correctly to the face-rating result page.
  3. Worse, the user's NEXT step in the legitimate face-rating flow may bypass the actual face-rating email-capture call because email is already set, skipping the face-rating ready email.
- **Fix:** Both `captureQuizEmail` and `captureFaceRatingEmail` must check `pending.type` (or the absence thereof). Reject when caller's discriminator doesn't match the doc's type. Same fix needed in `getQuizPaywallStatus` and `createQuizCheckoutSession` when given a face-rating token.

### H5. `face-rating-prompts.ts` system prompt mentions tier "BelowTier" but prompt also says "Subhuman" via the surface label step — the Stage 1 enum requires "BelowTier" exactly

- **File:** `functions/src/face-rating-prompts.ts:21,49,71` and `analyze-face-unauth.ts:71-75`
- **Impact:** The schema enum is `["Chadpreet","Chad","Chadlite","High Tier Normie","Mid Tier Normie","Low Tier Normie","BelowTier"]` (note no "Subhuman"). System prompt says "use the supplied PSL terminology … BelowTier (the system maps "BelowTier" to the surface label)". This works only because `surfaceTierLabel` post-processes "BelowTier" to "Subhuman". But there is risk:
  - If OpenAI Structured Output strict mode has any decoding hiccup and returns "Subhuman" verbatim, the response will fail schema validation and be either silently dropped or thrown as an error. The catch in `analyze-face-unauth.ts` will mark status="failed" and the user sees a generic "Analysis failed" alert.
  - The Stage 2 schema has the same enum but the prompt at `face-rating-prompts.ts:135` lists "the 7 PSL labels above" — fine, model will use BelowTier.
- **Fix:** Defensively accept either "BelowTier" or "Subhuman" by widening the schema enum to include both, then normalize in `surfaceTierLabel`. (Strict mode schema cannot be `oneOf` though, so simplest is to add "Subhuman" to the enum.)

### H6. Stage 2 schema does NOT enforce minItems/maxItems — model can return 0 strengths or 100 areas

- **File:** `functions/src/face-rating-prompts.ts:208-260`
- **Impact:** Schema has no `minItems` or `maxItems` on `strengths`, `areas_for_growth`, `celebrity_archetype.matches`, or `gap_drivers`. The prompt asks for "EXACTLY 3" strengths, "3 to 5" areas, but the model can ignore that under stress. The result-view trims to 5 strengths and 6 areas (defensive), but `strengths` could come back EMPTY and the page would render an empty section without crashing. A worse failure mode: the prompt says to return empty `matches[]` if not confident, but if the model returns 50 confabulated celebrity matches the page shows 50 cards.
- **Fix:** Schema-level `minItems`/`maxItems` are NOT supported by OpenAI Structured Outputs strict mode for arrays. Compensate in code: enforce min/max in the post-parse normalization in `analyze-face-full.ts:155-161`. Currently you trim to 5/6/5 but never pad up — add a guard that fails the response if `strengths.length < 1` or `areas_for_growth.length < 1`.

### H7. Marketing email is sent BEFORE Stage 1 has actually started (off-by-one in `captureFaceRatingEmail`)

- **File:** `functions/src/face-rating-checkout.ts:81-96`
- **Impact:** Email is only sent if `!alreadyHadEmail && pending.status === "ready"`. The status flips to "ready" only after `analyzeFaceUnauth` completes successfully. Today's flow: user uploads → loader runs → status flips to "ready" → user sees preview → user submits email on email-gate → THIS callable fires → email sent. That seems correct. However, if the user navigates away before the loader finishes, `pending.status` is still "processing" and no email is ever sent — and the user has no way to receive the recovery link. Compare with the legacy quiz funnel which has the same issue per `quiz-checkout.ts:142`. The recovery-email pattern is supposed to be the abandonment hook; in practice this only catches users who stayed long enough to see the preview but bailed at the paywall.
- **Fix:** This is a product behaviour issue not a bug per se. Decision: either (a) accept the limitation, (b) trigger the email also on `processing` -> `ready` transition (e.g., from `analyze-face-unauth.ts` when status flips, IF `pending.email` is set).

### H8. `analyze-face-full.ts` line 102 uses `process.env.OPENAI_API_KEY || OPENAI_API_KEY.value()` — inconsistent with Stage 1

- **File:** `functions/src/analyze-face-full.ts:102` vs `analyze-face-unauth.ts:230`
- **Impact:** Stage 2 reads `process.env.OPENAI_API_KEY` first then the secret. Stage 1 reads only `OPENAI_API_KEY.value()`. If someone exports `OPENAI_API_KEY` as a non-secret env var (e.g., in `functions/.env`) by accident, Stage 2 will use that instead of the secret while Stage 1 uses the secret. This is a foot-gun and an inconsistency.
- **Fix:** Use `OPENAI_API_KEY.value()` only, matching Stage 1.

### H9. `face-rating-webhook-handler.ts` does NOT verify the pendingReading is a face-rating type

- **File:** `functions/src/face-rating-webhook-handler.ts:40-42`
- **Impact:** If a Stripe webhook comes in with `metadata.type === "face_rating_purchase"` but the `pendingReadingToken` happens to point at a legacy quiz doc (Stripe metadata is attacker-controllable in theory if the attacker can call the checkout creation, but they need a valid token; this is more of a defence-in-depth concern than active exploit). The handler will set `status: "claimed"`, write a face-rating purchaseEntry to `userCredits/{uid}.purchaseHistory` for a quiz pending reading, and also call `runFaceStage2ForToken` on a doc with no `frontPhotoStoragePath` — which the function returns `{ ok: false, reason: "missing-front-photo" }` for. Soft failure mode.
- **Fix:** Reject in `handleFaceRatingPurchase` if `pending.type !== "face-rating"`. Equivalently: reject in `handleQuizPurchase` if `pending.type === "face-rating"`.

### H10. The face-rating pending doc never sets `pending.type` field on the legacy quiz path — so `pending.type` is `undefined` for ALL legacy docs

- **File:** legacy `generate-for-tool-unauth.ts` doesn't set a `type` field. Face-rating sets `type: "face-rating"`. The discriminator works one-way.
- **Impact:** Code that does `if (pending.type === "face-rating")` — currently nothing does. Code that does `if (pending.type === "quiz")` — would mis-fire on legacy docs. Mostly latent until someone adds discriminator logic. But the H4/H9 fixes need this field set on ALL pending docs to be useful.
- **Fix:** Add `type: "quiz"` to the legacy unauth generate path, OR write the face-rating handlers to use `pending.frontPhotoStoragePath ? "face-rating" : "quiz"` as a structural discriminator. The structural check is more robust because the docs already differ in shape.

---

## Medium-priority improvements (nice to have)

### M1. `setFaceRatingShareEnabled` deletes the share doc on disable but the snapshot persists in clients' caches

- **File:** `functions/src/face-rating-checkout.ts:284-294`
- **Impact:** When the owner disables share, the doc is deleted, but Firestore client caches and any social-media link previews that already cached the data still display the score. Not a correctness bug; a user-expectation gap.
- **Fix:** Surface this in the share toggle UI: "Disabling share removes the page from the public web; previews already shared may persist for a few minutes."

### M2. Token validation regex allows uppercase

- **File:** `functions/src/quiz-helpers.ts:135-139` (`/^[0-9a-f]{8}-...$/i`)
- **Impact:** The regex is case-insensitive (`/i` flag). The face-rating client uses `uuidv4()` which is lowercase. Mixing case would slip through `isValidToken` but would not match Firestore doc lookups (Firestore IDs ARE case-sensitive). So a UPPERCASE token would pass validation but get a "not found" downstream. Cosmetic; doesn't enable anything malicious.
- **Fix:** Drop the `/i` flag; reject uppercase outright.

### M3. `deleteFaceRatingPhoto` doesn't update the pending doc's `frontPhotoStoragePath` field

- **File:** `functions/src/face-rating-checkout.ts:471-505`
- **Impact:** After delete, the doc still has `frontPhotoStoragePath` pointing to a now-deleted blob. Re-rate within 14 days (intended free path per spec §5.4) would attempt to download a missing blob and fail.
- **Fix:** After delete, also clear `frontPhotoStoragePath` and `sidePhotoStoragePath` on the pending doc, and set `photosDeleted: true` (already set). Then `runFaceStage2ForToken` should treat "no photo path" as a clean no-op rather than an error.

### M4. `clearFaceRatingState` runs on the full report screen but not on the email-capture/paywall navigation back to /face-rating

- **File:** `app/face-rating/result/result-view.tsx:99,134` clears state only when the user enters `phase === "full"`. If the user paid but lazy-run failed, they bounce back to `/face-rating` from "Start over" link — which still has stale localStorage including the old token that's now in `claimed` state. The next analysis re-uses the same token and `analyzeFaceUnauth` returns `alreadyExisted: true` with the OLD light analysis. User sees their old reading attached to a new photo upload.
- **Fix:** Always `clearFaceRatingState()` on entering /face-rating WHEN `searchParams.get('reset') === 'true'` or when the previous token's state is `claimed`. Or simpler: always start a new token if no upload has happened in this session.

### M5. UploadScreen accepts `existingToken` from state, but reusing a token between front and side uploads on a re-run can clash

- **File:** `components/face-rating/FaceRatingFlow.tsx:396` — `const token = existingToken || uuidv4()`
- **Impact:** If user does a full flow, navigates back to upload front photo with a new file, the token persists. Storage rule allows `create` only — `update` is `false`. So the second front-photo upload to the same `pending/{token}/input-front.jpg` path would fail with a permission error. The error surfaces inside `setErr` but the user can't do anything about it without clearing storage.
- **Fix:** When re-entering the upload screen after a previous upload, generate a NEW token (and warn the user). Or: include a UUID suffix on the filename so each upload writes a fresh path: `input-front-<uuid>.jpg`.

### M6. Stripe seed `temperature: 0` + `seed: hashSeed(token)` — token is a UUID, hashSeed produces a fixed 32-bit integer, but OpenAI's seed parameter is best-effort and not guaranteed deterministic

- **File:** `functions/src/analyze-face-unauth.ts:235`, `analyze-face-full.ts:107`
- **Impact:** The "Same input → same output" promise in the prompt is implemented via seed + temp=0. OpenAI documents seeding as "best-effort" — small drifts in score on identical reruns are still possible. If the user does a 14-day re-rate of the same face and gets a different score, they'll cite this and complain. Not a code bug; a product expectation bug if the implementation is presented as guaranteed.
- **Fix:** Either (a) hash and persist the Stage 2 result by `(photoHash, gender, goal, country)` and serve from cache on re-rate within 14 days (cheap, deterministic); or (b) update the marketing copy to "consistent" rather than "same".

### M7. `face-rating-checkout.ts` allocates invite codes with `Math.random()`

- **File:** `functions/src/face-rating-checkout.ts:206-218`
- **Impact:** `Math.random()` is non-cryptographic. Invite codes are 6 chars from a 32-char alphabet → ~30 bits → 1B possible codes. With cluster reuse predictable, an attacker could enumerate active invite codes and self-redeem them en masse (each redemption costs nothing on its own but the invite-3-friends free-unlock ladder gets gamed).
- **Fix:** Use `crypto.randomBytes(N)` and base32-encode. Same for `shareId`.

---

## Low-priority polish (defer)

### L1. `ScheduleScreen` `Math.random() > 0.55` for affirmation has 45% probability — magic number documented nowhere

- **File:** `components/face-rating/FaceRatingFlow.tsx:85`. Cosmetic.

### L2. Sub-message rotator on loader doesn't pause when the loader finishes

- **File:** `components/face-rating/FaceRatingFlow.tsx:580-585`. Memory leak on unmount is handled by the cleanup. Cosmetic.

### L3. `surfaceTierLabel` re-derives from score even when label is correctly returned

- **File:** `analyze-face-unauth.ts:71-75`, `analyze-face-full.ts:258-261`. Defensive but loses the model's actual choice. If you trust the model's calibration, you should keep its label and only override on the specific "BelowTier" case.

### L4. `app/r/page.tsx` typo in component name

- **File:** `app/r/page.tsx:12` `SharedRedingPage` → "Reding".

### L5. Result page polling has no max attempts

- **File:** `app/face-rating/result/result-view.tsx:115-148`. Polls every 3s indefinitely if Stage 2 keeps failing. After 60s without a result, show the user a "we're still working on this — refresh in a minute" message. Otherwise the spinner spins forever and the user thinks the page is broken.

### L6. `FACE_LOADER_SUBMESSAGES` includes "Your photos never leave our servers unencrypted." which is inaccurate

- **File:** `lib/face-rating/types.ts:188`. The photos go to OpenAI as base64 data URLs over TLS; OpenAI is a separate company and IS receiving the photos. Decoy copy that may invite a "this is misleading" complaint.

### L7. Face-rating webhook handler's purchaseEntry has `pricePaid: session.amount_total || 499` — fallback hardcoded

- **File:** `functions/src/face-rating-webhook-handler.ts:95`. If you raise the price in Stripe but forget to update this fallback, the userCredits ledger reports the wrong value when amount_total is null (e.g. a $0 invoice from a 100% off coupon). Use `session.amount_total ?? 0`.

### L8. `app/quiz/[slug]/page.tsx` and friends still emit `metadata.title = "Face Rating | StoryInColor"` — confusing if these legacy redirects are ever bookmarked

- Cosmetic. The redirect bounces immediately so users don't see this title.

---

## Things to manually verify in browser

1. **End-to-end happy path:** intro → ready → gender → goal → country → front-photo upload → side-photo skip → loader → reveal (light analysis visible) → email gate → captureFaceRatingEmail succeeds → paywall → Stripe checkout → return URL polls → full report renders. Verify:
   - Score is decimal (e.g., 7.4, not 7).
   - Tier label is one of the 7 PSL strings (Chadpreet … Subhuman, NOT "BelowTier").
   - Bell-curve / sub-scores grid renders with green/yellow/red coloring.
   - Celebrity matches: try with a clearly-recognizable face and verify the model returns matches; try with a non-public face and verify the matches array is empty (no fabrication).
   - Glow-up plan does NOT contain surgical recommendations (search for "rhinoplasty", "filler", "surgery", "implant").

2. **Hard paywall enforcement:** Without paying, navigate directly to `/face-rating/result?token=<your-test-token>`. Confirm only light analysis shows and the locked sections are blurred. Now manually call `getFaceFullReport({token})` from DevTools console — confirm it returns `status: "locked"` and lightAnalysis ONLY (no fullAnalysis fields).

3. **Invite-3 path:** Generate an invite URL on result page. Open it in incognito. Run a full new flow. Confirm `redeemFaceRatingInvite` fires from the loader. Check the original token in Firestore — `inviteRedemptions` should be 1. Repeat 2 more times in different browsers/IPs. After the 3rd, refresh the original result page and confirm `inviteUnlocked === true` AND the full report unlocks.

4. **Race conditions to test:**
   - Open the loader screen, then quickly open the same flow in a second tab. Both should reach the same token? (Answer: localStorage is shared per browser/origin.) The second tab's loader should see status="ready" and onReady; it should NOT trigger a duplicate Stage 1 OpenAI call. Verify in Cloud Logging that only one Stage1 call fired.
   - Pay successfully, then within 1 second of the redirect open the result page in a second tab. Both tabs poll. Verify only one Stage 2 OpenAI call fires (currently NOT enforced — see H3).

5. **Photo deletion:**
   - Click "Delete my photos" on a paid full-report page. Verify in GCS console that `pending/{token}/input-front.*` is gone.
   - Then click "Re-rate yourself". The re-rate flow should NOT crash with "missing-front-photo".

6. **Shared URL:**
   - Enable sharing on a paid result page. Open the share URL in incognito. Confirm the public view shows ONLY tier label + score, NOTHING ELSE (no photo, no archetype, no email).
   - Open DevTools, navigate to the Firestore document directly. Confirm the public doc only contains `shareId`, `tierLabel`, `overallScore`, `createdAt` — and NOT `pendingToken`. **(Currently FAILS — see C1.)**

7. **Cross-funnel token contamination:**
   - Run a legacy quiz flow to get a quiz token. Manually call `captureFaceRatingEmail({token: <quiz-token>, email})` from DevTools. Confirm it rejects with a clear error rather than corrupting the doc. **(Currently does NOT reject — see H4.)**
   - Reverse: face-rating token to `captureQuizEmail`. Same test.

8. **Stripe flows to verify:**
   - 3DS card payment: confirm the embedded checkout redirects, then the result page polls and unlocks correctly.
   - Stripe failure / abandonment: open checkout, close the iframe without paying. Confirm pending doc stays in `status === "ready"` (NOT "claimed"). Reload the result page — should see preview + paywall again, NOT a stuck "polling" state.
   - Webhook failure: simulate Stripe webhook returning 500 (point a Stripe webhook at a Cloud Function that throws). Confirm Stripe retries and the second delivery is no-op (idempotency). Use the Stripe CLI's `--print-secret` and trigger the same event id twice.

9. **OpenAI failure modes:**
   - Set `FACE_STAGE_1_MODEL` to a nonexistent model. Run the flow. Confirm the user sees a clean error and the pending doc transitions to `status: "failed"`.
   - Force a very minor face in the photo. Confirm the prompt's minor-protection clause kicks in and the user sees a graceful degradation, NOT an internal error.

10. **Static export check:**
    - Run `npm run build` from a clean state. Verify all `/face-rating`, `/face-rating/result`, `/r`, `/quiz/<each slug>`, and `/quiz/<each slug>/result`, `/quiz/<each slug>/unlocked` pages exist in `out/`.
    - Verify `out/quiz/<slug>/index.html` content is the redirect shell, not legacy quiz HTML.

---

## Overall assessment

**NOT safe to deploy as-is.** The C-level bugs are exploitable from a production URL and need fixes before going live. C1+C2 together amount to: any user who shares a result link is unintentionally publishing their full paid analysis and granting strangers permission to delete their photos. C4 is a bucket-DoS vector. C3 is conceptually about the same exploit chain.

**Recommended path:**

1. Ship fixes for C1 (drop `pendingToken` from public share doc), C2 (require `request.auth.uid === pending.claimedByUid` on every face-rating callable that reads or writes claimed-state), C4 (UUID regex on storage rule), and C5 (verify cleanup function deletes new file paths). These are 1-2 day fixes.
2. Fix H1, H4, H9, H10 — discriminator + race-condition issues. Half-day.
3. Push H6, H8, the rest of the H series can ship right after.
4. Then deploy.

The architecture (two-stage OpenAI, Structured Outputs, single SKU, deferred account creation, processedStripeEvents idempotency, share-toggle, invite-3) is sound. The implementation is functional but the auth model for the post-claim callables is too loose. Lock it down behind `request.auth.uid` checks and the rest is mostly polish.
