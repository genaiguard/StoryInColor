# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project at a glance

StoryInColor (repo name `aibooks`, deployed at https://storyincolor.com) — a static-exported Next.js marketing site plus a set of Firebase Cloud Functions that turn user-uploaded photos into editorial AI "readings" (palm, face, aura, iridology, handwriting, style, hairstyle, color, beauty, skincare, plus a coloring-book line-art generator). Users buy credits via Stripe and spend them per generation. Image generation defaults to OpenAI `gpt-image-2`; per-tool overrides live on `ServerToolConfig.model` in `functions/src/tool-prompts.ts` (today only `coloring-book` overrides back to `gpt-image-1` because the line-art conversion is sharper there). The script `scripts/generate-sample.mjs` MUST stay aligned with these per-tool model picks — if it drifts, the marketing samples on `/readings/<slug>` will look different from what signed-in users get.

There are two npm trees: the root (Next.js app) and `functions/` (Cloud Functions). They share no code — anything used on both sides (credit packages, tool list) is duplicated and must be kept in sync by hand.

## Commands

Root (Next.js app):
- `npm run dev` — Next dev server.
- `npm run build` — static export. Writes to `out/`. **`next.config.mjs` sets `output: 'export'` with `ignoreBuildErrors: false` and `ignoreDuringBuilds: false`** — TypeScript and ESLint errors fail the build. `.eslintrc.json` turns off two cosmetic rules (`@typescript-eslint/no-explicit-any`, `react/no-unescaped-entities`) that were responsible for ~95% of the legacy backlog; everything else (hooks, a11y, unused-vars, next-core-web-vitals) is enforced. The deploy workflow `.github/workflows/deploy.yml` also runs `tsc --noEmit` (root + functions) and `npm run lint` as discrete steps so regressions show clearly in the Actions tab.
- `npm run lint` — `next lint`.
- `node scripts/generate-sample.mjs <slug>` or `--all` — regenerates the marketing input/sample images in `public/images/tools/`. Runs against the live OpenAI API (~$0.40/reading), needs `OPENAI_API_KEY`. **Run locally only and commit the generated WEBPs**; the comment at the top of the script explicitly forbids running it in CI.

Functions (`cd functions`):
- `npm run build` / `npm run build:watch` — `tsc` to `functions/lib/`.
- `npm run lint` — eslint.
- `npm run serve` — builds, then `firebase emulators:start --only functions`.
- `npm run deploy` — `firebase deploy --only functions`. Secrets (Stripe, AWS SES, OpenAI) must already exist via `firebase functions:secrets:set` before deploy; see `functions/setup-email-secrets.sh` for the AWS ones.

Firebase config / rules deploys (from repo root):
- `firebase deploy --only firestore:rules,firestore:indexes,storage`
- The default project is `storyincolor-ai` (`.firebaserc`). Storage uses a named bucket `storyincolor-storage` (target alias).

Emulators are configured (`firebase.json`: auth 9099, firestore 8080, storage 9199, functions 5001) but the client provider currently does NOT connect to them — see "Local dev caveats" below.

## Architecture

### Two-surface routing per tool (SEO + auth-gated workflow)

Each reading lives at `/readings/[slug]` and is rendered by `app/readings/[slug]/page.tsx`, which mounts BOTH a marketing SEO surface (`MarketingView`) and the authenticated workflow (`ToolWorkflow`) into the same statically-exported HTML. CSS in `app/globals.css` keys off `data-tool-auth="signed-in" | "signed-out"` (set on `<html>` after Firebase hydration) to show one and hide the other. This is deliberate: Google sees the marketing copy, signed-in users see the upload UI, with a single static page per slug. Adding a new tool means appending to `lib/tools/registry.ts` (client copy + SEO) AND `functions/src/tool-prompts.ts` (prompt + cost + endpoint config) — both are required.

The result page `/readings/[slug]/result?jobId=…` polls Firestore until the job flips to `complete` or `failed`. `generateForTool` accepts a client-supplied UUID `jobId` so the client can navigate to the result page BEFORE the 30s OpenAI call returns.

### Tool registry split (security-critical)

- `lib/tools/registry.ts` — client-visible: name, copy, SEO, displayed `creditCost`. **Do not trust this on the server.**
- `functions/src/tool-prompts.ts` — server-only canonical: prompt text, real `creditCost`, OpenAI endpoint (`edits` vs `generations`), `quality`, `inputFidelity`, image size, and per-tool `preprocessing` (`exif-rotate` for top-down meals, `contrast` for handwriting, `detail` for fine-detail readings → 1536px PNG input).

`generateForTool` looks up the toolId in `tool-prompts.ts` and uses ONLY those values for cost, prompt, and OpenAI parameters. The client `creditCost` field is advisory display only.

### Credits ledger

`userCredits/{userId}` holds `balance`, `used`, `purchaseHistory[]`, `lastUpdated`. Per-event audit entries (`deduct-{jobId}`, `refund-{jobId}`) live in the subcollection `userCredits/{userId}/usageEvents/{eventId}` — this was migrated out of an in-doc array because of the 1MB document cap. Refunds are idempotent via deterministic doc IDs (`refund-{jobId}`).

Writes to `userCredits` are blocked by `firestore.rules` for all clients. The doc is written ONLY by:
1. `ensureUserCredits` callable on first sign-in (seeds 2 free credits).
2. `stripeWebhook` `checkout.session.completed` handler on credit purchase.
3. `generateForTool` transaction (deduct on start, refund on failure via `credit-ledger.ts`).

`generateForTool` also enforces `MAX_CONCURRENT_JOBS = 3` per user and validates `photoStoragePath.startsWith('users/${userId}/')` before downloading from Storage — without that check a user could submit another user's path. The job doc is created and credits deducted in a single transaction; if the same `jobId` already exists (client retry / double-fire) the function no-ops.

### Static export + GitHub Pages deploy

The site is a static export. `output: 'export'` means there are no Next API routes and no server runtime — every dynamic interaction goes through Firebase (Auth, Firestore, Storage, callable Functions). The build is deployed via `.github/workflows/deploy.yml`, which:
1. Builds with `NEXT_PUBLIC_*` env vars from GitHub secrets.
2. Pushes the contents of `out/` to a SEPARATE public repo `genaiguard/StoryInColor`, which serves `storyincolor.com` via GitHub Pages with a `CNAME`.

This means the source repo is private, the served repo is public, and `out/` in this repo is a local artifact — do not commit it. (It's gitignored.)

### Generation output URLs

`generateForTool` saves output PNGs to `users/{userId}/generations/{generationId}.png` in Storage with a `firebaseStorageDownloadTokens` metadata token, then constructs a `firebasestorage.googleapis.com/.../?alt=media&token=…` URL. These do NOT expire (unlike a 7-day signed URL). Storage rules make these files read-only for the owner — clients cannot overwrite their own generation outputs to tamper with the URL referenced by the job doc.

### Admin

Admin authorization uses a Firebase Auth **custom claim** `admin: true`. All four enforcement points (`firestore.rules`, `storage.rules` — two paths, `functions/src/index.ts:getAdminDashboardData`) check `request.auth.token.admin == true || request.auth.token.email == 'ipekcioglu@me.com'`. The email branch is a temporary stale-token fallback so an admin signed in with a token issued before the claim was set keeps working until it refreshes (~1h max). It's planned for removal in a follow-up once we're confident no one's stuck with a stale token.

The claim is set on the Firebase Auth user, NOT in committed code. There's no source-controlled `setCustomUserClaims` call in `functions/src/` — it was set once via a one-off Admin SDK script using ADC and then deleted. To verify the current claim state:

```bash
firebase auth:export /tmp/auth.json --project storyincolor-ai
python3 -c "import json;d=json.load(open('/tmp/auth.json'));[print(u.get('localId'),u.get('email'),u.get('customAttributes')) for u in d['users'] if u.get('email','').lower()=='ipekcioglu@me.com']"
```

To rotate the admin in the future:

```js
// in /tmp/set-admin.mjs, run from functions/ where firebase-admin is installed:
import admin from "firebase-admin";
admin.initializeApp({ projectId: "storyincolor-ai" });
await admin.auth().setCustomUserClaims(NEW_UID, { admin: true });
// optionally clear on the old user:
// await admin.auth().setCustomUserClaims(OLD_UID, {});
```

Then update `ADMIN_EMAILS` in `app/admin/page.tsx` (UX hint only — server enforces). No rule/function redeploy needed.

### Analytics + attribution

Five layers, all interlocking. Touch them as a system, not piecemeal — the deduplication only works when client + server agree on `event_id`.

- **Capture** (`lib/attribution/capture.ts`, `components/tracking/attribution-capture.tsx`). On every route change we read URL UTMs / `gclid` / `fbclid` / `msclkid`, infer source from `document.referrer`, and persist a `firstTouch` + `lastTouch` blob to localStorage AND a 365-day first-party cookie (`sic_attr_first`). First-touch only fires on `/`, `/readings`, or `/readings/<slug>` — legal pages and dashboard surfaces are denylisted so SEO traffic to `/privacy` doesn't poison attribution. An anonymous browser id (`sic_anon_id`) is also issued on first visit.
- **Persist** (`lib/attribution/persist.ts`). On signup completion (both email + Google paths in `app/login/page.tsx`), the browser writes `users/{uid}.profile` and `users/{uid}.attribution` to Firestore. `users/{uid}` is owner-writable per `firestore.rules:35-38`; we use `set({merge:true})` so the soft-delete `deleted` flag survives.
- **ID linking** (`components/tracking/auth-bridge.tsx`). Whenever the Firebase user changes, we push the UID into Clarity (`clarity("identify", uid, ...)`), GA4 (`gtag("config", { user_id })`), and Meta Pixel (`fbq("init", { external_id: sha256(uid) })`). Clarity hashes server-side; Pixel external_id is sha256 hex client-side; GA4 hashes internally.
- **Funnel events** (`lib/analytics/events.ts`). One typed API for every conversion. Each helper generates an `event_id` UUID and fans out to Pixel (`fbq("track", name, params, { eventID: id })`), GA4 (`gtag("event", snake_name, { event_id, ...params })`), and Clarity (`clarity("event", name)`). Events: `trackViewReading`, `trackViewReadingResult`, `trackPricingCtaClick` (Lead), `trackCompleteRegistration`, `trackInitiateCheckout`, `trackPurchase`. The InitiateCheckout `event_id` is stashed in `localStorage.sic_pending_fb_event_id` AND threaded through Stripe metadata (`fbEventId`) so the post-redirect Purchase emit on the dashboard reuses the same id.
- **Server-side conversions** (`functions/src/conversions/`). `dispatchServerConversion` posts to Meta CAPI + GA4 Measurement Protocol with the SAME `event_id` the browser used → Meta dedupes within 48h. Wired in `stripeWebhook` (Purchase), `ensureUserCredits` (CompleteRegistration), and `generateForTool` (ReadingStarted, ReadingCompleted, ReadingFailed). All five lifecycle events are mirrored.

**Master kill switch:** `STORYINCOLOR_ENABLE_SERVER_CONVERSIONS=true` env var on the Cloud Function. Unset/false → every server conversion call is a no-op. Use `META_TEST_EVENT_CODE` env var to send Meta events as test events while validating the wiring without affecting production attribution. The required Firebase secrets are `META_CAPI_TOKEN` and `GA4_MP_API_SECRET`; the env vars `META_PIXEL_ID`, `GA4_MEASUREMENT_ID` are non-secret and live in `functions/.env` (or equivalent).

**Where attribution shows up in the admin:** `/admin` lists each user with `firstTouch` + `lastTouch` blocks plus linked tracker IDs. Source filter dropdown narrows the list. The "Funnel by source" table at the top rolls up signups, activated users, paying customers, revenue, conversion rate, and activation rate per first-touch source. All computed server-side in `getAdminDashboardData`.

**Privacy policy:** kept generic on purpose. Sections 7 (cookies/tracking), 8 (third-party services list including "Analytics and performance monitoring"), and 14 (Facebook Pixel) cover the spirit of what's collected. Adding a new tracker (e.g. TikTok Pixel) probably warrants revisiting Section 14; adjusting CAPI/Clarity/GA wiring within the existing tools does not.

## Local dev caveats

- **Never run `npm run build` while `npm run dev` is up.** The production build writes to the same `.next/` directory the dev server is serving SSR chunks from, and the chunk hashes don't match. The dev server will then 500 with `ENOENT: ... _ssr_components_...` and 404 every CSS/JS asset. Recovery: stop the dev server, `rm -rf .next`, restart. If you need a build verification, stop the dev server first.
- `app/firebase/firebase-provider.tsx` has emulator connections **commented out** — local dev currently hits production Firebase. If you uncomment, also run `firebase emulators:start`.
- The two npm trees do not share a `node_modules`; install deps in both root and `functions/` when first cloning.
- Root `tsconfig.json` has `strict: false` and `noImplicitAny: false`, so a number of `any` and untyped catch blocks compile without complaint. The build itself now DOES catch type errors (`ignoreBuildErrors: false` — see Commands above), but the permissive root config keeps a lower bar than functions/. The `functions/tsconfig.json` is strict. Run `tsc --noEmit` (root) or `npm run build` inside `functions/` for the strictest possible check.
- shadcn/ui components live in `components/ui/` (config in `components.json`). Path alias `@/*` maps to repo root.
- Tailwind config: `tailwind.config.ts`. Global styles in `app/globals.css` — that file also contains the auth-gated CSS toggles for the per-tool routing pattern described above.

## When adding a new reading/tool

1. Add a `Tool` entry to `lib/tools/registry.ts` (client copy, FAQ, SEO).
2. Add a matching `ServerToolConfig` entry to `functions/src/tool-prompts.ts` keyed by the same `id`. Pick `endpoint: "edits"` if the user's photo conditions the output, `"generations"` if it's a stylized result that doesn't need the photo (e.g. `aura-reading`).
3. Drop a cover image at `public/images/tools/<slug>.webp` (and optionally `<slug>-input.webp`/`<slug>-sample.webp`). Run `node scripts/generate-sample.mjs <slug>` to generate them via the live API.
4. The dynamic route `/readings/[slug]` and its result page are generated via `generateStaticParams` from the registry — no per-page file is needed.
