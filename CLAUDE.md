# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project at a glance

StoryInColor (repo name `aibooks`, deployed at https://storyincolor.com) — a static-exported Next.js marketing site plus a set of Firebase Cloud Functions that turn user-uploaded photos into editorial AI "readings" (palm, face, aura, iridology, handwriting, plate, plant, room, style, skincare, plus a coloring-book line-art generator). Users buy credits via Stripe and spend them per generation; image generation uses OpenAI `gpt-image-1`.

There are two npm trees: the root (Next.js app) and `functions/` (Cloud Functions). They share no code — anything used on both sides (credit packages, tool list) is duplicated and must be kept in sync by hand.

## Commands

Root (Next.js app):
- `npm run dev` — Next dev server.
- `npm run build` — static export. Writes to `out/`. **`next.config.mjs` sets `output: 'export'` and `ignoreBuildErrors`/`ignoreDuringBuilds` are both true** — TypeScript and ESLint errors do NOT fail the build. Run `npm run lint` and `tsc --noEmit` separately if you want them enforced.
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

`/admin` and `getAdminDashboardData` are gated on `request.auth.token.email === 'ipekcioglu@me.com'` — the admin email is hard-coded in `firestore.rules`, `storage.rules`, and the function. Changing the admin requires editing all three plus redeploying rules and functions.

## Local dev caveats

- **Never run `npm run build` while `npm run dev` is up.** The production build writes to the same `.next/` directory the dev server is serving SSR chunks from, and the chunk hashes don't match. The dev server will then 500 with `ENOENT: ... _ssr_components_...` and 404 every CSS/JS asset. Recovery: stop the dev server, `rm -rf .next`, restart. If you need a build verification, stop the dev server first.
- `app/firebase/firebase-provider.tsx` has emulator connections **commented out** — local dev currently hits production Firebase. If you uncomment, also run `firebase emulators:start`.
- The two npm trees do not share a `node_modules`; install deps in both root and `functions/` when first cloning.
- `tsconfig.json` has `strict: false` and `noImplicitAny: false`. The build won't catch type errors anyway (`ignoreBuildErrors: true`). For real type-checking run `tsc --noEmit` (root) or `npm run build` inside `functions/`.
- shadcn/ui components live in `components/ui/` (config in `components.json`). Path alias `@/*` maps to repo root.
- Tailwind config: `tailwind.config.ts`. Global styles in `app/globals.css` — that file also contains the auth-gated CSS toggles for the per-tool routing pattern described above.

## When adding a new reading/tool

1. Add a `Tool` entry to `lib/tools/registry.ts` (client copy, FAQ, SEO).
2. Add a matching `ServerToolConfig` entry to `functions/src/tool-prompts.ts` keyed by the same `id`. Pick `endpoint: "edits"` if the user's photo conditions the output, `"generations"` if it's a stylized result that doesn't need the photo (e.g. `aura-reading`).
3. Drop a cover image at `public/images/tools/<slug>.webp` (and optionally `<slug>-input.webp`/`<slug>-sample.webp`). Run `node scripts/generate-sample.mjs <slug>` to generate them via the live API.
4. The dynamic route `/readings/[slug]` and its result page are generated via `generateStaticParams` from the registry — no per-page file is needed.
