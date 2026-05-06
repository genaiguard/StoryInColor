"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Lock,
  Sparkles,
  Users,
  Share2,
  Check,
  Trash2,
  Copy,
} from "lucide-react";
import {
  loadStripe,
  type Stripe as StripeJS,
} from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  SUB_SCORE_KEYS,
  SUB_SCORE_LABELS,
  type FaceLightAnalysis,
  type FaceFullAnalysis,
  type SubScoreKey,
} from "@/lib/face-rating/types";
import {
  loadFaceRatingState,
  recallOwnerSecret,
} from "@/components/face-rating/useFaceRatingState";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Eager load Stripe — saves ~1s when user reaches the paywall.
const stripePromise: Promise<StripeJS | null> = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

type Phase =
  | "loading"
  | "preview" // show light analysis + email gate
  | "email-gate" // capturing email
  | "paywall" // showing paywall + checkout option
  | "checkout" // Stripe iframe
  | "polling" // post-checkout, waiting for Stage 2
  | "full"; // unlocked

export default function FaceRatingResultView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { initialized } = useFirebase();
  const token = searchParams.get("token") || "";
  const sessionId = searchParams.get("session_id") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [light, setLight] = useState<FaceLightAnalysis | null>(null);
  const [full, setFull] = useState<FaceFullAnalysis | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRedemptions, setInviteRedemptions] = useState<number>(0);
  const [inviteUnlocked, setInviteUnlocked] = useState<boolean>(false);
  // Owner secret loaded from localStorage state (set by analyze-face-unauth).
  // Required for any sensitive call after claim.
  const [ownerSecret, setOwnerSecret] = useState<string | undefined>(undefined);
  useEffect(() => {
    // Prefer the secret stored against THIS specific token. Fall back to
    // the most recent in-flow state.
    if (token) {
      const recalled = recallOwnerSecret(token);
      if (recalled) {
        setOwnerSecret(recalled);
        return;
      }
    }
    const s = loadFaceRatingState();
    if (s?.ownerSecret) setOwnerSecret(s.ownerSecret);
  }, [token]);

  // Initial fetch — figure out which phase we're in.
  useEffect(() => {
    if (!initialized) return;
    if (!token) {
      setErrMsg("Missing token. Please start over.");
      return;
    }
    (async () => {
      try {
        const fn = httpsCallable(getFunctions(), "getFaceFullReport");
        // Pass ownerSecret if we have it — server requires it for paid/unlocked.
        const res = await fn({ token, ownerSecret });
        const data = res.data as {
          status: "locked" | "unlocked";
          lightAnalysis?: FaceLightAnalysis;
          fullAnalysis?: FaceFullAnalysis;
          shareEnabled?: boolean;
          shareId?: string;
        };
        if (data.lightAnalysis) setLight(data.lightAnalysis);
        if (data.status === "unlocked" && data.fullAnalysis) {
          setFull(data.fullAnalysis);
          setShareEnabled(!!data.shareEnabled);
          if (data.shareId) {
            setShareUrl(`https://storyincolor.com/r?id=${data.shareId}`);
          }
          setPhase("full");
          // Note: we don't clearFaceRatingState() here — the user may
          // refresh the page and need ownerSecret + token to re-fetch.
          // M4 follow-up: ownerSecret persists in a separate keyed store.
        } else if (sessionId) {
          // Just returned from Stripe; poll for Stage 2 completion.
          setPhase("polling");
        } else if (data.lightAnalysis) {
          setPhase("preview");
        } else {
          setErrMsg("This reading wasn't found. Please start over.");
        }
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [initialized, token, sessionId]);

  // Polling loop — post-checkout. L5: cap at 30 attempts (~90s).
  useEffect(() => {
    if (phase !== "polling") return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const poll = async () => {
      attempts += 1;
      try {
        const fn = httpsCallable(getFunctions(), "getFaceFullReport");
        const res = await fn({ token, ownerSecret });
        const data = res.data as {
          status: "locked" | "unlocked";
          fullAnalysis?: FaceFullAnalysis;
          shareEnabled?: boolean;
          shareId?: string;
        };
        if (cancelled) return;
        if (data.status === "unlocked" && data.fullAnalysis) {
          setFull(data.fullAnalysis);
          setShareEnabled(!!data.shareEnabled);
          if (data.shareId) setShareUrl(`https://storyincolor.com/r?id=${data.shareId}`);
          setPhase("full");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) {
        if (attempts >= MAX_ATTEMPTS) {
          setErrMsg(
            "Generation is taking longer than usual. Please refresh in a minute or contact support if this persists.",
          );
          return;
        }
        setTimeout(poll, 3000);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [phase, token, ownerSecret]);

  /* ---------- email capture ---------- */
  const submitEmail = useCallback(async () => {
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setErrMsg("Please enter a valid email.");
      return;
    }
    setEmailBusy(true);
    setErrMsg(null);
    try {
      const fn = httpsCallable(getFunctions(), "captureFaceRatingEmail");
      await fn({ token, email: emailValue, marketingOptIn: false });
      setPhase("paywall");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setEmailBusy(false);
    }
  }, [emailValue, token]);

  /* ---------- Stripe checkout ---------- */
  const startCheckout = useCallback(async () => {
    setErrMsg(null);
    try {
      const fn = httpsCallable(getFunctions(), "createFaceRatingCheckoutSession");
      const res = await fn({
        token,
        successUrl: typeof window !== "undefined"
          ? `${window.location.origin}/face-rating/result`
          : "https://storyincolor.com/face-rating/result",
      });
      const data = res.data as {
        success: boolean;
        clientSecret?: string;
      };
      if (data.success && data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
        setPhase("checkout");
      } else {
        setErrMsg("Could not start checkout. Try again.");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token]);

  /* ---------- invite-3 ---------- */
  const startInvitePath = useCallback(async () => {
    try {
      const fn = httpsCallable(getFunctions(), "getOrCreateFaceRatingInviteCode");
      const res = await fn({ token, ownerSecret });
      const data = res.data as {
        inviteCode: string;
        inviteUrl: string;
        redemptions: number;
        unlocked: boolean;
      };
      setInviteCode(data.inviteCode);
      setInviteRedemptions(data.redemptions);
      setInviteUnlocked(data.unlocked);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token, ownerSecret]);

  /* ---------- share toggle (option C) ---------- */
  const toggleShare = useCallback(async () => {
    try {
      const fn = httpsCallable(getFunctions(), "setFaceRatingShareEnabled");
      const res = await fn({ token, enabled: !shareEnabled, ownerSecret });
      const data = res.data as {
        success: boolean;
        shareUrl?: string;
      };
      if (data.success) {
        setShareEnabled(!shareEnabled);
        if (!shareEnabled && data.shareUrl) setShareUrl(data.shareUrl);
        if (shareEnabled) setShareUrl(null);
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [shareEnabled, token, ownerSecret]);

  /* ---------- delete photos ---------- */
  const deletePhotos = useCallback(async () => {
    if (!confirm("Delete uploaded photos from our servers? Cannot be undone.")) return;
    try {
      const fn = httpsCallable(getFunctions(), "deleteFaceRatingPhoto");
      await fn({ token, ownerSecret });
      alert("Your photos have been deleted from our servers.");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token, ownerSecret]);

  /* ---------- render ---------- */

  if (errMsg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-rose-300">{errMsg}</p>
        <Link
          href="/face-rating"
          className="rounded-full bg-white px-6 py-3 text-sm text-black"
        >
          Start over
        </Link>
      </div>
    );
  }

  if (!initialized || phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }

  if (phase === "polling") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm text-white/70">
          Generating your full reading… (~30s)
        </p>
      </div>
    );
  }

  if (phase === "checkout" && stripeClientSecret) {
    return (
      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-md p-4">
          <button
            onClick={() => setPhase("paywall")}
            className="mb-3 text-xs uppercase tracking-[0.18em] text-white/40 hover:text-white"
          >
            ← Back
          </button>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret: stripeClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  if (phase === "full" && full) {
    return (
      <FullReportView
        full={full}
        light={light}
        token={token}
        shareEnabled={shareEnabled}
        shareUrl={shareUrl}
        onToggleShare={toggleShare}
        onDeletePhotos={deletePhotos}
      />
    );
  }

  // Default: preview + email gate or paywall
  return (
    <PreviewPaywallView
      phase={phase}
      light={light}
      onSubmitEmail={submitEmail}
      emailValue={emailValue}
      setEmailValue={setEmailValue}
      emailBusy={emailBusy}
      onStartCheckout={startCheckout}
      onStartInvitePath={startInvitePath}
      inviteCode={inviteCode}
      inviteRedemptions={inviteRedemptions}
      inviteUnlocked={inviteUnlocked}
      goToEmail={() => setPhase("email-gate")}
    />
  );
}

/* ============================================================ */
/* PREVIEW + PAYWALL                                              */
/* ============================================================ */

function PreviewPaywallView({
  phase,
  light,
  onSubmitEmail,
  emailValue,
  setEmailValue,
  emailBusy,
  onStartCheckout,
  onStartInvitePath,
  inviteCode,
  inviteRedemptions,
  inviteUnlocked,
  goToEmail,
}: {
  phase: Phase;
  light: FaceLightAnalysis | null;
  onSubmitEmail: () => void;
  emailValue: string;
  setEmailValue: (v: string) => void;
  emailBusy: boolean;
  onStartCheckout: () => void;
  onStartInvitePath: () => void;
  inviteCode: string | null;
  inviteRedemptions: number;
  inviteUnlocked: boolean;
  goToEmail: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = useMemo(
    () =>
      inviteCode
        ? `https://storyincolor.com/face-rating?ref=${inviteCode}`
        : null,
    [inviteCode],
  );

  if (!light) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        {/* Hero — score + tier */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
            Your honest face rating
          </p>
          <div className="mt-4 text-7xl font-light tracking-tight md:text-8xl">
            {light.overall_score.toFixed(1)}
            <span className="text-3xl text-white/40">/10</span>
          </div>
          <div className="mt-3 text-2xl font-light italic md:text-3xl">
            {light.tier_label}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {light.demographic_band.label} · top {Math.max(1, 100 - light.demographic_band.percentile)}%
          </div>
        </div>

        {/* Strongest feature observation (free) */}
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/50">
            <Sparkles className="h-3 w-3" />
            One thing we noticed
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/85">
            {light.strongest_feature.observation}
          </p>
        </div>

        {/* Locked sections (blurred preview of what's behind paywall) */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            "8 calibrated sub-scores",
            "Your archetype",
            "Top 3 strengths",
            "Areas for growth",
            "Celebrity look-alikes",
            "Your potential score",
            "Glow-up plan",
          ].map((label, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/55"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                {label}
              </span>
              <span className="text-white/30">—</span>
            </div>
          ))}
        </div>

        {/* CTA(s) */}
        <div className="mx-auto mt-12 max-w-xl">
          {phase === "preview" && (
            <button
              type="button"
              onClick={goToEmail}
              className="block w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black hover:bg-white/90"
            >
              Show me my full reading
            </button>
          )}

          {phase === "email-gate" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-white/80">
                Enter your email to see your full reading.
              </p>
              <input
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                className="mt-3 w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
              />
              <button
                type="button"
                disabled={emailBusy}
                onClick={onSubmitEmail}
                className="mt-3 block w-full rounded-full bg-white px-6 py-3.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
              >
                {emailBusy ? "Saving…" : "See my full reading →"}
              </button>
              <p className="mt-3 text-[11px] text-white/40">
                We&rsquo;ll email your reading link too.
              </p>
            </div>
          )}

          {phase === "paywall" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={onStartCheckout}
                className="block w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black hover:bg-white/90"
              >
                Unlock full reading — $4.99
              </button>

              {/* Invite-3-friends alternative */}
              {!inviteCode ? (
                <button
                  type="button"
                  onClick={onStartInvitePath}
                  className="block w-full rounded-full border border-white/15 px-6 py-4 text-sm text-white/85 hover:bg-white/[0.04]"
                >
                  Or invite 3 friends to unlock free
                </button>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/50">
                    <Users className="h-3 w-3" />
                    {inviteUnlocked
                      ? "Unlocked! Refresh to view your reading."
                      : `Invite friends — ${inviteRedemptions} of 3`}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2">
                    <input
                      readOnly
                      value={inviteUrl || ""}
                      className="flex-1 bg-transparent text-xs text-white/90 outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!inviteUrl) return;
                        navigator.clipboard.writeText(inviteUrl).catch(() => {});
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">
                    Each friend who completes their rating counts. Three = free unlock for you.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-12 text-center text-[11px] text-white/30">
          For entertainment. Not a clinical assessment.
        </p>
      </div>
    </div>
  );
}

/* ============================================================ */
/* FULL REPORT VIEW (11 sections)                                 */
/* ============================================================ */

function FullReportView({
  full,
  light,
  token,
  shareEnabled,
  shareUrl,
  onToggleShare,
  onDeletePhotos,
}: {
  full: FaceFullAnalysis;
  light: FaceLightAnalysis | null;
  token: string;
  shareEnabled: boolean;
  shareUrl: string | null;
  onToggleShare: () => void;
  onDeletePhotos: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        {/* 1. Hero score */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
            Your face rating
          </p>
          <div className="mt-4 text-7xl font-light tracking-tight md:text-8xl">
            {full.overall_score.toFixed(1)}
            <span className="text-3xl text-white/40">/10</span>
          </div>
          <div className="mt-3 text-2xl font-light italic md:text-3xl">
            {full.tier_label}
          </div>

          {/* 2. Percentile + locality strip */}
          <div className="mt-1 text-xs text-white/55">
            {full.demographic_band.label} · top{" "}
            {Math.max(1, 100 - full.demographic_band.percentile)}%
          </div>
        </div>

        {/* 3. Archetype */}
        <Section title="Your archetype">
          <div className="text-2xl font-light italic">{full.archetype.name}</div>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            {full.archetype.description}
          </p>
        </Section>

        {/* 4. Sub-scores */}
        <Section title="Sub-scores">
          <div className="grid gap-2 md:grid-cols-2">
            {SUB_SCORE_KEYS.map((k: SubScoreKey) => {
              const v = full.sub_scores[k] ?? 0;
              const tone =
                v >= 7.5 ? "ok" : v >= 6.0 ? "mid" : "low";
              return (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <span className="text-sm text-white/80">
                    {SUB_SCORE_LABELS[k]}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      tone === "ok"
                        ? "text-emerald-300"
                        : tone === "mid"
                          ? "text-amber-200"
                          : "text-rose-300"
                    }`}
                  >
                    {v.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* 5. Top strengths */}
        <Section title="Your strengths">
          <ul className="space-y-3">
            {full.strengths.map((s, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/10 bg-emerald-300/[0.03] p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/85">
                    {SUB_SCORE_LABELS[s.feature as SubScoreKey] || s.feature}
                  </span>
                  <span className="text-emerald-300">{s.score.toFixed(1)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {s.observation}
                </p>
                <div className="mt-2 text-[11px] text-emerald-300/60">
                  Top {Math.max(1, 100 - s.percentile_in_demographic)}% of your demographic
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* 6. Areas for growth */}
        <Section title="Areas for growth">
          <ul className="space-y-3">
            {full.areas_for_growth.map((g, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/10 bg-amber-200/[0.02] p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/85">{g.area}</span>
                  <span className="text-amber-200">{g.score.toFixed(1)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {g.specific_observation}
                </p>
                <p className="mt-2 text-[11px] text-amber-200/70">
                  → {g.actionable}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 7. Celebrity look-alikes */}
        {full.celebrity_archetype.matches.length > 0 && (
          <Section title="You read like…">
            <div className="grid gap-3 md:grid-cols-3">
              {full.celebrity_archetype.matches.map((m, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="text-base font-medium">{m.name}</div>
                  <div className="mt-1 text-2xl font-light tracking-tight">
                    {m.match_pct}%
                  </div>
                  <div className="mt-2 text-[11px] text-white/55">
                    {m.shared_features}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 8. Potential */}
        <Section title="Your potential">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-baseline gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/50">
                  Now
                </div>
                <div className="text-4xl font-light">
                  {full.potential.current_score.toFixed(1)}
                </div>
              </div>
              <div className="text-2xl text-white/30">→</div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-emerald-300">
                  Optimized
                </div>
                <div className="text-4xl font-light text-emerald-200">
                  {full.potential.optimized_score.toFixed(1)}
                </div>
              </div>
            </div>
            {full.potential.gap_drivers.length > 0 && (
              <p className="mt-3 text-xs text-white/55">
                Gap drivers: {full.potential.gap_drivers.join(", ")}
              </p>
            )}
          </div>
        </Section>

        {/* 9. Glow-up plan */}
        <Section title="Your glow-up plan">
          <ul className="space-y-2">
            {(
              [
                ["Haircut", full.glow_up_plan.haircut],
                ["Grooming", full.glow_up_plan.grooming],
                ["Skincare", full.glow_up_plan.skincare],
                ["Photography", full.glow_up_plan.photography],
                ["Expression", full.glow_up_plan.expression],
              ] as const
            ).map(([label, value]) => (
              <li
                key={label}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="text-[11px] uppercase tracking-wider text-white/50">
                  {label}
                </div>
                <p className="mt-1 text-sm text-white/80">{value}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 10. Re-rate appointment */}
        <Section title="Re-rate yourself">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/75">
            Come back in {full.re_rate.next_recommended_at_days} days. Same face,
            new score — track your glow-up.
          </div>
        </Section>

        {/* 11. Share card / share toggle (option C — opt-in) */}
        <Section title="Share">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Share2 className="h-4 w-4" />
                <span>Make this reading shareable via public link</span>
              </div>
              <button
                onClick={onToggleShare}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  shareEnabled
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "border border-white/20 text-white/70"
                }`}
              >
                {shareEnabled ? "On" : "Off"}
              </button>
            </div>
            {shareEnabled && shareUrl && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-xs text-white/90 outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
                  className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* Photo deletion (legal compliance) */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={onDeletePhotos}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/40 hover:text-white"
          >
            <Trash2 className="h-3 w-3" />
            Delete my photos from the server
          </button>
        </div>

        <p className="mt-8 text-center text-[11px] text-white/30">
          For entertainment. Not a clinical assessment.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xs uppercase tracking-[0.18em] text-white/50">
        {title}
      </h2>
      {children}
    </section>
  );
}
