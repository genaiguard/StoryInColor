# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working principle

**This file describes architecture and intent only.** Anything that is a constant, an inventory, a list, a file:line reference, a price, a model name, a port number, a count, or a "currently we…" snapshot belongs in the source — not here. If you find yourself wanting to write down a specific value, point at the file that owns it instead. Drift between this doc and the code has caused real bugs; keep the doc thin so it stays true.

## Project at a glance

StoryInColor (repo name `aibooks`, deployed at https://storyincolor.com) — a static-exported Next.js marketing site plus a set of Firebase Cloud Functions that turn user-uploaded photos into editorial AI "readings." Users buy credits via Stripe and spend them per generation. The canonical tool inventory and per-tool image-generation parameters live in `functions/src/tool-prompts.ts`; the marketing-side counterpart lives in `lib/tools/registry.ts`. The script `scripts/generate-sample.mjs` regenerates the marketing samples and MUST stay aligned with the per-tool model picks in `tool-prompts.ts` — drift means the marketing samples won't match what signed-in users get.

There are two npm trees: the root (Next.js app) and `functions/` (Cloud Functions). They share no code — anything used on both sides (credit packages, tool list) is duplicated and must be kept in sync by hand.

## Commands

Root (Next.js app):
- `npm run dev` — Next dev server.
- `npm run build` — static export. Writes to `out/`. Build fails on TS/ESLint errors (`next.config.mjs`). The deploy workflow (`.github/workflows/deploy.yml`) is the source of truth for what's enforced in CI.
- `npm run lint` — `next lint`.
- `node scripts/generate-sample.mjs <slug>` or `--all` — regenerates the marketing input/sample images. Hits the live OpenAI API and costs real money. **Run locally only and commit the generated WEBPs**; the script header forbids running it in CI.

Functions (`cd functions`):
- `npm run build` / `npm run build:watch` — `tsc` to `functions/lib/`.
- `npm run lint` — eslint.
- `npm run serve` — builds, then `firebase emulators:start --only functions`.
- `npm run deploy` — `firebase deploy --only functions`. Required secrets must already exist via `firebase functions:secrets:set` before deploy; see `functions/setup-email-secrets.sh` and the secret bindings at the top of each function file for the canonical list.

Firebase config / rules deploys (from repo root):
- `firebase deploy --only firestore:rules,firestore:indexes,storage`
- Project + bucket aliases live in `.firebaserc` and `firebase.json`.

Emulators are configured (`firebase.json`) but the client provider currently does NOT connect to them — see "Local dev caveats" below.

## Architecture

### Two-surface routing per tool (SEO + auth-gated workflow)

Each reading lives at `/readings/[slug]` and is rendered by `app/readings/[slug]/page.tsx`, which mounts BOTH a marketing SEO surface (`MarketingView`) and the authenticated workflow (`ToolWorkflow`) into the same statically-exported HTML. CSS in `app/globals.css` keys off `data-tool-auth` (set on `<html>` after Firebase hydration) to show one and hide the other. This is deliberate: Google sees the marketing copy, signed-in users see the upload UI, with a single static page per slug. Adding a new tool requires entries in BOTH `lib/tools/registry.ts` and `functions/src/tool-prompts.ts` — both are required.

The result page `/readings/[slug]/result?jobId=…` polls Firestore until the job flips to `complete` or `failed`. `generateForTool` accepts a client-supplied UUID `jobId` so the client can navigate to the result page before the OpenAI call returns.

### Tool registry split (security-critical)

- `lib/tools/registry.ts` — client-visible: name, copy, SEO, displayed `creditCost`. **Do not trust this on the server.**
- `functions/src/tool-prompts.ts` — server-only canonical: prompt text, real `creditCost`, OpenAI endpoint and parameters, per-tool preprocessing.

`generateForTool` looks up the toolId in `tool-prompts.ts` and uses ONLY those values for cost, prompt, and OpenAI parameters. The client `creditCost` field is advisory display only.

### Credits ledger

`userCredits/{userId}` holds the user's balance and purchase history. Per-event audit entries live in the subcollection `userCredits/{userId}/usageEvents/{eventId}` (the in-doc array hit Firestore's 1MB cap). Refunds are idempotent via deterministic doc IDs.

Writes to `userCredits` are blocked by `firestore.rules` for all clients. The doc is written ONLY by:
1. `ensureUserCredits` callable on first sign-in. The signup grant is whatever `FREE_CREDITS_PER_USER` is set to in that file — read it; do not assume.
2. `stripeWebhook` `checkout.session.completed` handler on credit purchase.
3. `generateForTool` transaction (deduct on start, refund on failure via `credit-ledger.ts`).

`generateForTool` also enforces a per-user concurrency cap and validates `photoStoragePath.startsWith('users/${userId}/')` before downloading from Storage — without that check a user could submit another user's path. Job creation + credit deduction happen in a single transaction; same `jobId` re-submission is a no-op.

### Static export + GitHub Pages deploy

`output: 'export'` in `next.config.mjs` means there are no Next API routes and no server runtime — every dynamic interaction goes through Firebase (Auth, Firestore, Storage, callable Functions). The build is deployed via `.github/workflows/deploy.yml`, which builds with `NEXT_PUBLIC_*` env vars from GitHub secrets and pushes the contents of `out/` to a SEPARATE public repo (configured in the workflow) that serves `storyincolor.com` via GitHub Pages with a `CNAME`.

Source repo is private, served repo is public, `out/` is a local artifact — do not commit it (it's gitignored).

### Generation output URLs

`generateForTool` saves output PNGs to Storage with a `firebaseStorageDownloadTokens` metadata token, then constructs a token-based `firebasestorage.googleapis.com/.../?alt=media&token=…` URL. These do NOT expire (unlike a 7-day signed URL). Storage rules make these files read-only for the owner — clients cannot overwrite their own generation outputs to tamper with the URL referenced by the job doc.

### Admin

Admin authorization uses a Firebase Auth **custom claim** `admin: true`. All enforcement points (`firestore.rules`, `storage.rules`, the admin-only callables in `functions/src/`) check `request.auth.token.admin == true`. There is no email fallback — rotating the admin is purely a matter of moving the claim, no rule/function redeploy needed.

The claim is set on the Firebase Auth user, NOT in committed code. To verify the current claim state:

```bash
firebase auth:export /tmp/auth.json --project <PROJECT>
python3 -c "import json;d=json.load(open('/tmp/auth.json'));[print(u.get('localId'),u.get('email'),u.get('customAttributes')) for u in d['users'] if u.get('email','').lower()=='<EMAIL>']"
```

To rotate the admin in the future:

```js
// in /tmp/set-admin.mjs, run from functions/ where firebase-admin is installed:
import admin from "firebase-admin";
admin.initializeApp({ projectId: "<PROJECT>" });
await admin.auth().setCustomUserClaims(NEW_UID, { admin: true });
// optionally clear on the old user:
// await admin.auth().setCustomUserClaims(OLD_UID, {});
```

The list in `app/admin/page.tsx` is a UX hint only — server enforces. No rule/function redeploy needed when rotating.

### Analytics + attribution

Five interlocking layers; touch them as a system, not piecemeal — the deduplication only works when client + server agree on `event_id`.

- **Capture** (`lib/attribution/capture.ts`, `components/tracking/attribution-capture.tsx`). Reads URL UTMs / click IDs and `document.referrer`, persists `firstTouch` + `lastTouch` to localStorage and a first-party cookie. First-touch only fires on a denylist-protected set of entry routes so SEO traffic to legal pages doesn't poison attribution.
- **Persist** (`lib/attribution/persist.ts`). On signup completion, the browser writes profile + attribution to `users/{uid}` in Firestore. Use `set({merge:true})` so soft-delete flags survive.
- **ID linking** (`components/tracking/auth-bridge.tsx`). On every Firebase user change, push the UID into Clarity, GA4, and Meta Pixel.
- **Funnel events** (`lib/analytics/events.ts`). One typed API per conversion. Each helper mints an `event_id` UUID and fans out to Pixel + GA4 + Clarity. The InitiateCheckout `event_id` is threaded through Stripe metadata so the post-redirect Purchase emit reuses the same id.
- **Server-side conversions** (`functions/src/conversions/`). `dispatchServerConversion` posts to Meta CAPI + GA4 Measurement Protocol with the SAME `event_id` the browser used → Meta dedupes. Wired into the Stripe webhook, `ensureUserCredits`, and `generateForTool`.

The full event taxonomy lives in `lib/analytics/events.ts`. The wiring sites for the server mirror live in `functions/src/conversions/dispatch.ts` and the call sites that import it. Do not re-list them here.

**Master kill switch:** an env var on the Cloud Function disables every server conversion call. A test-mode env var sends Meta events as test events. Names + behaviour live in `functions/src/conversions/dispatch.ts`. Required Firebase secrets and non-secret env vars are declared at the top of that file.

**Where attribution shows up in the admin:** `/admin` lists each user with first-touch + last-touch blocks plus linked tracker IDs. The "Funnel by source" table rolls up signups, activated users, paying customers, revenue, and per-source conversion. All computed server-side in `getAdminDashboardData`.

**Privacy policy:** intentionally generic. Adding a new tracker class probably warrants a copy revisit; adjusting wiring within the existing tools does not.

## Local dev caveats

- **Never run `npm run build` while `npm run dev` is up.** The production build writes to the same `.next/` directory the dev server is serving SSR chunks from, and the chunk hashes don't match. The dev server will then 500 with `ENOENT: ... _ssr_components_...` and 404 every CSS/JS asset. Recovery: stop the dev server, `rm -rf .next`, restart. If you need a build verification, stop the dev server first.
- `app/firebase/firebase-provider.tsx` has emulator connections **commented out** — local dev currently hits production Firebase. If you uncomment, also run `firebase emulators:start`.
- The two npm trees do not share a `node_modules`; install deps in both root and `functions/` when first cloning.
- Root `tsconfig.json` is permissive; `functions/tsconfig.json` is strict. The build catches type errors but the root config tolerates more `any` than functions/. Run `tsc --noEmit` (root) or `npm run build` inside `functions/` for the strictest possible check.
- shadcn/ui components live in `components/ui/`. Path alias `@/*` maps to repo root.

## When adding a new reading/tool

1. Add a `Tool` entry to `lib/tools/registry.ts` (client copy, FAQ, SEO).
2. Add a matching `ServerToolConfig` entry to `functions/src/tool-prompts.ts` keyed by the same `id`. The `endpoint` choice ("edits" vs "generations") and the rest of the parameters are documented inline in `tool-prompts.ts` — read the existing entries.
3. Drop a cover image at `public/images/tools/<slug>.webp` (and optionally `<slug>-input.webp`/`<slug>-sample.webp`). Run `node scripts/generate-sample.mjs <slug>` to generate them via the live API.
4. The dynamic route `/readings/[slug]` and its result page are generated via `generateStaticParams` from the registry — no per-page file is needed.

## Verifying things before claiming them

When investigating user-impacting behaviour (funnel, credits, costs, limits, who sees what UI when), **always** read the relevant source file before forming a conclusion. Constants here drift; the source is canonical. The same applies to analytics queries — always specify a date window that matches the period you're analysing.
