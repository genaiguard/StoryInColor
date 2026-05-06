"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Lock,
  Users,
  Share2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Scissors,
  Wind,
  Droplets,
  Camera,
  Smile,
  TrendingUp,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { loadStripe, type Stripe as StripeJS } from "@stripe/stripe-js";
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
import {
  AnimatedScore,
  BellCurve,
  SubScoreGrid,
  MaskedText,
  BlurredBlock,
  SectionHeader,
  LockedRow,
  CompletionBadge,
  scoreColorClass,
} from "@/components/face-rating/FaceRatingViz";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise: Promise<StripeJS | null> = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

type Phase =
  | "loading"
  | "preview"
  | "email-gate"
  | "paywall"
  | "checkout"
  | "polling"
  | "full";

const TOTAL_SECTIONS = 11;

export default function FaceRatingResultView() {
  const searchParams = useSearchParams();
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
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(
    null,
  );
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRedemptions, setInviteRedemptions] = useState<number>(0);
  const [inviteUnlocked, setInviteUnlocked] = useState<boolean>(false);
  const [ownerSecret, setOwnerSecret] = useState<string | undefined>(undefined);

  // Recall owner secret on mount.
  useEffect(() => {
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

  // Initial fetch.
  useEffect(() => {
    if (!initialized) return;
    if (!token) {
      setErrMsg("Missing token. Please start over.");
      return;
    }
    (async () => {
      try {
        const fn = httpsCallable(getFunctions(), "getFaceFullReport");
        const res = await fn({ token, ownerSecret });
        const data = res.data as {
          status: "locked" | "unlocked";
          lightAnalysis?: FaceLightAnalysis;
          fullAnalysis?: FaceFullAnalysis;
          shareEnabled?: boolean;
          shareId?: string;
          emailCaptured?: boolean;
        };
        if (data.lightAnalysis) setLight(data.lightAnalysis);
        if (data.status === "unlocked" && data.fullAnalysis) {
          setFull(data.fullAnalysis);
          setShareEnabled(!!data.shareEnabled);
          if (data.shareId) {
            setShareUrl(`https://storyincolor.com/r?id=${data.shareId}`);
          }
          setPhase("full");
        } else if (sessionId) {
          setPhase("polling");
        } else if (data.lightAnalysis) {
          if (data.emailCaptured) {
            setPhase("paywall");
          } else {
            setPhase("preview");
          }
        } else {
          setErrMsg("This reading wasn't found. Please start over.");
        }
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [initialized, token, sessionId, ownerSecret]);

  // Pre-create Stripe session as soon as the user reaches the paywall.
  useEffect(() => {
    if (phase !== "paywall") return;
    if (stripeClientSecret) return;
    let cancelled = false;
    (async () => {
      try {
        const fn = httpsCallable(
          getFunctions(),
          "createFaceRatingCheckoutSession",
        );
        const res = await fn({
          token,
          successUrl:
            typeof window !== "undefined"
              ? `${window.location.origin}/face-rating/result`
              : "https://storyincolor.com/face-rating/result",
        });
        const data = res.data as { success: boolean; clientSecret?: string };
        if (!cancelled && data.success && data.clientSecret) {
          setStripeClientSecret(data.clientSecret);
        }
      } catch {
        /* ignore — lazy-create on click */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Polling loop post-checkout.
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
          if (data.shareId)
            setShareUrl(`https://storyincolor.com/r?id=${data.shareId}`);
          setPhase("full");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) {
        if (attempts >= MAX_ATTEMPTS) {
          setErrMsg(
            "Generation is taking longer than usual. Please refresh in a minute.",
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

  const startCheckout = useCallback(async () => {
    setErrMsg(null);
    if (stripeClientSecret) {
      setPhase("checkout");
      return;
    }
    try {
      const fn = httpsCallable(
        getFunctions(),
        "createFaceRatingCheckoutSession",
      );
      const res = await fn({
        token,
        successUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/face-rating/result`
            : "https://storyincolor.com/face-rating/result",
      });
      const data = res.data as { success: boolean; clientSecret?: string };
      if (data.success && data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
        setPhase("checkout");
      } else {
        setErrMsg("Could not start checkout. Try again.");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token, stripeClientSecret]);

  const startInvitePath = useCallback(async () => {
    try {
      const fn = httpsCallable(
        getFunctions(),
        "getOrCreateFaceRatingInviteCode",
      );
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

  const toggleShare = useCallback(async () => {
    try {
      const fn = httpsCallable(getFunctions(), "setFaceRatingShareEnabled");
      const res = await fn({ token, enabled: !shareEnabled, ownerSecret });
      const data = res.data as { success: boolean; shareUrl?: string };
      if (data.success) {
        setShareEnabled(!shareEnabled);
        if (!shareEnabled && data.shareUrl) setShareUrl(data.shareUrl);
        if (shareEnabled) setShareUrl(null);
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [shareEnabled, token, ownerSecret]);

  const deletePhotos = useCallback(async () => {
    if (!confirm("Delete uploaded photos from our servers? Cannot be undone."))
      return;
    try {
      const fn = httpsCallable(getFunctions(), "deleteFaceRatingPhoto");
      await fn({ token, ownerSecret });
      alert("Your photos have been deleted from our servers.");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token, ownerSecret]);

  /* ---------- Render ---------- */

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm text-white/70">
          Generating your full reading… (~30s)
        </p>
        <p className="max-w-md text-xs text-white/40">
          Stage 2 runs a deeper model on your photo. This is the heavy
          computation that produces your detailed observations and glow-up
          plan.
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
        token={token}
        shareEnabled={shareEnabled}
        shareUrl={shareUrl}
        onToggleShare={toggleShare}
        onDeletePhotos={deletePhotos}
      />
    );
  }

  return (
    <PreviewView
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
/* PREVIEW + PAYWALL VIEW                                         */
/* ============================================================ */

function PreviewView({
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
  // Whether the user has reached the paywall step (email gate cleared).
  const showPaywallCTA = phase === "paywall";
  // We show much MORE in the preview now — partial reveal of every
  // section so the user knows what they're paying for.
  const reveal = false;

  if (!light) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const topPercent = Math.max(1, 100 - (light.demographic_band?.percentile ?? 50));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        {/* Hero */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            StoryInColor · Face Rating
          </p>
          <h1 className="mt-3 text-2xl font-light italic md:text-3xl">
            Your honest face rating
          </h1>
          <div className="mt-8">
            <AnimatedScore value={light.overall_score} size="lg" />
          </div>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm ${scoreColorClass(
              light.overall_score,
            )}`}
          >
            <span className="font-medium">{light.tier_label}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/65">
              Top {topPercent}% in {light.demographic_band?.label || "your demographic"}
            </span>
          </div>
        </div>

        {/* Distribution chart */}
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-white/40">
            Where you sit
          </p>
          <BellCurve value={light.overall_score} />
          <p className="mt-3 text-center text-xs text-white/50">
            You scored {light.overall_score.toFixed(1)} — calibrated against{" "}
            {light.demographic_band?.label || "your demographic"}.
          </p>
        </div>

        {/* The hook — one observation visible (from the top strength) */}
        {light.strengths?.[0]?.observation && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.04] p-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-emerald-300/85">
              <Sparkles className="h-3 w-3" />
              First thing we noticed —{" "}
              {SUB_SCORE_LABELS[light.strengths[0].feature as SubScoreKey] ||
                light.strengths[0].feature}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/85 md:text-base">
              {light.strengths[0].observation}
            </p>
          </div>
        )}

        <div className="mx-auto mt-8 flex max-w-xl justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[11px] text-white/65">
            <Lock className="h-3 w-3 text-white/55" />
            <span>
              <span className="text-white/85">9 of {TOTAL_SECTIONS} sections locked</span>
              <span className="text-white/45"> · one-time $4.99 unlocks everything</span>
            </span>
          </div>
        </div>

        {/* SUB-SCORES — visible (the proof the engine is real) */}
        <Section eyebrow="08 sub-scores · revealed" title="Calibrated sub-scores">
          <p className="mb-4 text-sm text-white/55">
            Eight calibrated dimensions, scored 0–10 against{" "}
            {light.demographic_band?.label || "your demographic"}.
          </p>
          <SubScoreGrid scores={light.sub_scores} reveal={true} />
        </Section>

        {/* ARCHETYPE — name visible, description blurred */}
        <Section
          eyebrow="Your archetype"
          title={
            light.archetype?.name ? (
              <>{light.archetype.name}</>
            ) : (
              "—"
            )
          }
          locked
        >
          <div
            className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-white/30"
            style={{ filter: "blur(5px)" }}
            aria-hidden="true"
          >
            {light.archetype?.description ||
              "Detailed archetype description revealed in the full report — what people feel when they look at you, the secondary feature that complicates the read, and how this archetype tends to land socially."}
          </div>
        </Section>

        {/* STRENGTHS — top features visible, observations locked */}
        <Section
          eyebrow={`${light.strengths?.length || 3} strengths identified`}
          title="Your standout features"
          locked
        >
          <ul className="space-y-3">
            {(light.strengths || []).slice(0, 3).map((s, i) => (
              <LockedRow
                key={i}
                label={
                  SUB_SCORE_LABELS[s.feature as SubScoreKey] || s.feature
                }
                score={s.score}
                tone="emerald"
                reveal={false}
                observation={
                  s.observation ||
                  "Specific anatomical reasons this feature reads strong, what it signals to viewers, and how it compounds with the rest of your face."
                }
              />
            ))}
          </ul>
        </Section>

        {/* AREAS FOR GROWTH — count visible, content locked */}
        <Section
          eyebrow={`${light.areas_for_growth?.length || 3} areas to grow`}
          title="What's holding your score back"
          locked
        >
          <ul className="space-y-3">
            {(light.areas_for_growth || []).slice(0, 4).map((g, i) => (
              <LockedRow
                key={i}
                label={g.area || `area_${i + 1}`}
                score={g.score}
                tone={i === 0 ? "rose" : "amber"}
                reveal={false}
                observation={
                  g.specific_observation ||
                  "Specific cause unlocked in the full report — what drags this score down and how it impacts the overall read."
                }
                actionable={
                  g.actionable ||
                  "Concrete plan with products, techniques, and habits you can start today."
                }
              />
            ))}
          </ul>
        </Section>

        {/* CELEBRITY LOOK-ALIKES — partially revealed */}
        {light.celebrity_archetype?.matches?.length ? (
          <Section
            eyebrow={`${light.celebrity_archetype.matches.length} celebrity matches`}
            title="You read like…"
            locked
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {light.celebrity_archetype.matches.slice(0, 3).map((m, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-light text-white/85">
                    {m.name?.charAt(0) || "?"}
                  </div>
                  <div className="mt-3 text-sm text-white/85">
                    <MaskedText text={m.name || "Hidden Hidden"} reveal={false} visibleChars={1} />
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-white/45">
                    <Lock className="h-3 w-3" />
                    <span className="select-none blur-[5px]" aria-hidden="true">
                      {m.match_pct || 75}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section
            eyebrow="Celebrity look-alikes"
            title="You read like…"
            locked
          >
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45">
              Up to 3 celebrity matches with shared-feature analysis — unlocked
              in the full report.
            </div>
          </Section>
        )}

        {/* POTENTIAL — current visible, optimized blurred */}
        <Section eyebrow="Your potential" title="Where you could be in 90 days" locked>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/45">
                  Now
                </div>
                <div className="mt-1 text-4xl font-light tabular-nums">
                  {(light.potential?.current_score ?? light.overall_score).toFixed(1)}
                </div>
              </div>
              <TrendingUp className="h-5 w-5 text-white/30" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">
                  Optimized
                </div>
                <div
                  className="mt-1 text-4xl font-light tabular-nums text-emerald-200/70 select-none"
                  style={{ filter: "blur(8px)" }}
                  aria-hidden="true"
                >
                  {(light.potential?.optimized_score ?? light.overall_score + 0.8).toFixed(1)}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/45">
              {(light.potential?.gap_drivers?.length || 3)} gap drivers
              identified — unlock to see which features close the gap.
            </p>
          </div>
        </Section>

        {/* GLOW-UP PLAN — categories visible, content locked */}
        <Section eyebrow="Your glow-up plan" title="5-part action plan" locked>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { Icon: Scissors, label: "Haircut", key: "haircut" },
              { Icon: Wind, label: "Grooming", key: "grooming" },
              { Icon: Droplets, label: "Skincare", key: "skincare" },
              { Icon: Camera, label: "Photography", key: "photography" },
              { Icon: Smile, label: "Expression", key: "expression" },
            ].map(({ Icon, label, key }) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/55" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                    {label}
                  </div>
                  <p
                    className="mt-1 truncate text-xs text-white/35 select-none"
                    style={{ filter: "blur(4px)" }}
                    aria-hidden="true"
                  >
                    {(light.glow_up_plan as unknown as Record<string, string> | undefined)?.[key] ||
                      "Specific routine + products"}
                  </p>
                </div>
                <Lock className="h-3 w-3 flex-shrink-0 text-white/35" />
              </li>
            ))}
          </ul>
        </Section>

        {/* PAYWALL CTA */}
        <div className="mx-auto mt-12 max-w-xl">
          <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                One purchase, full report
              </p>
              <h3 className="mt-2 text-2xl font-light italic md:text-3xl">
                $4.99 · one-time
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Unlocks all {TOTAL_SECTIONS} sections — archetype, all 8
                sub-score observations, strengths, growth plan, celebrity
                matches, potential, full glow-up plan. No subscription.
                No upsells.
              </p>
            </div>

            {phase === "preview" && (
              <button
                type="button"
                onClick={goToEmail}
                className="mt-6 block w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
              >
                Show me my full reading →
              </button>
            )}

            {phase === "email-gate" && (
              <div className="mt-5">
                <p className="text-xs text-white/55">
                  Where should we send your reading link?
                </p>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !emailBusy) onSubmitEmail();
                  }}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={emailBusy}
                  onClick={onSubmitEmail}
                  className="mt-3 block w-full rounded-full bg-white px-6 py-3.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                >
                  {emailBusy ? "Saving…" : "Continue to unlock →"}
                </button>
                <p className="mt-2 text-[11px] text-white/40">
                  We&rsquo;ll email you the link too, in case you want to come back later.
                </p>
              </div>
            )}

            {showPaywallCTA && (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={onStartCheckout}
                  className="block w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black hover:bg-white/90"
                >
                  Unlock full reading — $4.99
                </button>
                {!inviteCode ? (
                  <button
                    type="button"
                    onClick={onStartInvitePath}
                    className="block w-full rounded-full border border-white/15 px-6 py-3 text-sm text-white/85 hover:bg-white/[0.04]"
                  >
                    Or invite 3 friends to unlock free
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/55">
                      <Users className="h-3 w-3" />
                      {inviteUnlocked
                        ? "Unlocked! Refresh to view."
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
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-[11px] text-white/30">
            For entertainment. Not a clinical assessment.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  locked,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-12 max-w-xl">
      <SectionHeader
        eyebrow={eyebrow}
        title={typeof title === "string" ? title : (title as string)}
        locked={locked}
      />
      {children}
    </section>
  );
}

/* ============================================================ */
/* FULL REPORT VIEW                                               */
/* ============================================================ */

function FullReportView({
  full,
  token,
  shareEnabled,
  shareUrl,
  onToggleShare,
  onDeletePhotos,
}: {
  full: FaceFullAnalysis;
  token: string;
  shareEnabled: boolean;
  shareUrl: string | null;
  onToggleShare: () => void;
  onDeletePhotos: () => void;
}) {
  const topPercent = Math.max(1, 100 - (full.demographic_band?.percentile ?? 50));
  const [copiedShare, setCopiedShare] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        {/* HERO */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            StoryInColor · Your full reading
          </p>
          <h1 className="mt-3 text-2xl font-light italic md:text-3xl">
            Honest face rating · Unlocked
          </h1>
          <div className="mt-8">
            <AnimatedScore value={full.overall_score} size="lg" />
          </div>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-sm ${scoreColorClass(
              full.overall_score,
            )}`}
          >
            <span className="font-medium">{full.tier_label}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/65">
              Top {topPercent}% in {full.demographic_band?.label || "your demographic"}
            </span>
          </div>
        </div>

        <div className="mx-auto mt-8 flex justify-center">
          <CompletionBadge current={TOTAL_SECTIONS} total={TOTAL_SECTIONS} reveal={true} />
        </div>

        {/* DISTRIBUTION */}
        <FullSection eyebrow="Distribution" title="Where you sit">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
            <BellCurve value={full.overall_score} height={140} />
            <p className="mt-3 text-center text-sm text-white/65">
              You scored {full.overall_score.toFixed(1)} —{" "}
              {full.demographic_band?.label || "your demographic"}, top{" "}
              {topPercent}%.
            </p>
          </div>
        </FullSection>

        {/* ARCHETYPE */}
        <FullSection eyebrow="Your archetype" title={full.archetype.name}>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-6">
            <p className="text-[15px] leading-relaxed text-white/85">
              {full.archetype.description}
            </p>
          </div>
        </FullSection>

        {/* SUB-SCORES */}
        <FullSection eyebrow="08 sub-scores" title="Calibrated dimensions">
          <SubScoreGrid scores={full.sub_scores} reveal={true} />
        </FullSection>

        {/* STRENGTHS */}
        <FullSection
          eyebrow={`${full.strengths.length} standout features`}
          title="Your strengths"
        >
          <ul className="space-y-3">
            {full.strengths.map((s, i) => (
              <li
                key={i}
                className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.03] p-5"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-base text-white">
                    {SUB_SCORE_LABELS[s.feature as SubScoreKey] || s.feature}
                  </span>
                  <span className="text-lg font-light tabular-nums text-emerald-300">
                    {s.score.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/80">
                  {s.observation}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.04] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/85">
                  <Sparkles className="h-2.5 w-2.5" />
                  Top {Math.max(1, 100 - s.percentile_in_demographic)}% in your demographic
                </div>
              </li>
            ))}
          </ul>
        </FullSection>

        {/* AREAS FOR GROWTH */}
        <FullSection
          eyebrow={`${full.areas_for_growth.length} growth areas`}
          title="What's holding your score back"
        >
          <ul className="space-y-3">
            {full.areas_for_growth.map((g, i) => (
              <li
                key={i}
                className={`rounded-2xl border p-5 ${
                  i === 0
                    ? "border-rose-300/15 bg-rose-300/[0.03]"
                    : "border-amber-200/15 bg-amber-200/[0.03]"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-base text-white capitalize">
                    {g.area.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`text-lg font-light tabular-nums ${
                      i === 0 ? "text-rose-300" : "text-amber-200"
                    }`}
                  >
                    {g.score.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/80">
                  {g.specific_observation}
                </p>
                <div
                  className={`mt-3 rounded-lg border bg-black/30 p-3 text-[13px] leading-relaxed ${
                    i === 0
                      ? "border-rose-300/15 text-rose-200/90"
                      : "border-amber-200/15 text-amber-100/90"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-[0.16em] opacity-60">
                    Action plan
                  </span>
                  <p className="mt-1">{g.actionable}</p>
                </div>
              </li>
            ))}
          </ul>
        </FullSection>

        {/* CELEBRITY LOOK-ALIKES */}
        {full.celebrity_archetype?.matches?.length > 0 && (
          <FullSection
            eyebrow="Look-alikes"
            title="You read like…"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {full.celebrity_archetype.matches.map((m, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 text-center"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-2xl font-light italic text-white">
                    {m.name?.charAt(0) || "?"}
                  </div>
                  <div className="mt-3 text-base text-white">{m.name}</div>
                  <div className="mt-1 text-2xl font-light tabular-nums text-white/85">
                    {m.match_pct}%
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/55">
                    {m.shared_features}
                  </p>
                </div>
              ))}
            </div>
          </FullSection>
        )}

        {/* POTENTIAL */}
        <FullSection eyebrow="Your potential" title="Where you could be in 90 days">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-300/[0.04] to-white/[0.01] p-6">
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Now
                </div>
                <div className="mt-1 text-5xl font-light tabular-nums text-white">
                  {full.potential.current_score.toFixed(1)}
                </div>
              </div>
              <TrendingUp className="mb-2 h-5 w-5 text-emerald-300" />
              <div className="flex-1 text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/85">
                  Optimized
                </div>
                <div className="mt-1 text-5xl font-light tabular-nums text-emerald-200">
                  {full.potential.optimized_score.toFixed(1)}
                </div>
              </div>
            </div>
            {full.potential.gap_drivers.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Closing the gap
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {full.potential.gap_drivers.map((d, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-1 text-xs text-emerald-200/85 capitalize"
                    >
                      {d.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FullSection>

        {/* GLOW-UP PLAN */}
        <FullSection eyebrow="Action plan" title="Your glow-up plan">
          <ul className="space-y-2.5">
            {(
              [
                { Icon: Scissors, label: "Haircut", body: full.glow_up_plan.haircut },
                { Icon: Wind, label: "Grooming", body: full.glow_up_plan.grooming },
                { Icon: Droplets, label: "Skincare", body: full.glow_up_plan.skincare },
                { Icon: Camera, label: "Photography", body: full.glow_up_plan.photography },
                { Icon: Smile, label: "Expression", body: full.glow_up_plan.expression },
              ] as const
            ).map(({ Icon, label, body }) => (
              <li
                key={label}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <Icon className="mt-1 h-4 w-4 flex-shrink-0 text-white/65" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                    {label}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </FullSection>

        {/* RE-RATE */}
        <FullSection eyebrow="Track your glow-up" title="Re-rate yourself">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start gap-3">
              <Calendar className="mt-1 h-4 w-4 flex-shrink-0 text-white/65" />
              <div>
                <p className="text-sm text-white/85">
                  Come back in {full.re_rate.next_recommended_at_days} days.
                </p>
                <p className="mt-0.5 text-xs text-white/45">
                  Same face, fresh score — track your glow-up.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30" />
          </div>
        </FullSection>

        {/* SHARE TOGGLE */}
        <FullSection eyebrow="Share" title="Make this rating shareable">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Share2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/65" />
                <div>
                  <div className="text-sm text-white/85">
                    Public link to your score + tier
                  </div>
                  <div className="mt-0.5 text-xs text-white/45">
                    Disabled by default. You decide.
                  </div>
                </div>
              </div>
              <button
                onClick={onToggleShare}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  shareEnabled
                    ? "bg-emerald-300/20 text-emerald-200"
                    : "border border-white/20 text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                {shareEnabled ? "On" : "Off"}
              </button>
            </div>
            {shareEnabled && shareUrl && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-xs text-white/90 outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl).catch(() => {});
                    setCopiedShare(true);
                    setTimeout(() => setCopiedShare(false), 1500);
                  }}
                  className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
                >
                  {copiedShare ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            )}
          </div>
        </FullSection>

        {/* DELETE PHOTOS */}
        <div className="mx-auto mt-12 flex justify-center">
          <button
            onClick={onDeletePhotos}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/45 transition-colors hover:border-rose-300/30 hover:text-rose-300/85"
          >
            <Trash2 className="h-3 w-3" />
            Delete my photos from the server
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/30">
          For entertainment. Not a clinical assessment.
        </p>
        {/* Token in DOM for debug only */}
        <p className="mt-1 hidden text-center text-[10px] text-white/15">
          {token.slice(0, 8)}…
        </p>
      </div>
    </div>
  );
}

function FullSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-12 max-w-xl">
      <SectionHeader eyebrow={eyebrow} title={title} />
      {children}
    </section>
  );
}
