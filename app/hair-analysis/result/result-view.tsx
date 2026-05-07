"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Copy,
  Check,
  Trash2,
  Scissors,
} from "lucide-react";
import { loadStripe, type Stripe as StripeJS } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  SectionHeader,
  CompletionBadge,
} from "@/components/face-rating/FaceRatingViz";
import { HairStyleGrid } from "@/components/hair-analysis/HairStyleGrid";
import { FaceShapeSVG } from "@/components/hair-analysis/primitives/FaceShapeSVG";
import {
  loadHairAnalysisState,
  recallHairOwnerSecret,
} from "@/components/hair-analysis/useHairAnalysisState";
import type { FaceShape, HairStyleCell } from "@/lib/hair-analysis/types";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise: Promise<StripeJS | null> = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

type Phase = "loading" | "preview" | "email-gate" | "paywall" | "checkout" | "polling" | "full";

export default function HairAnalysisResultView() {
  const searchParams = useSearchParams();
  const { initialized, user, loading: authLoading } = useFirebase();
  const token = searchParams.get("token") || "";
  const sessionId = searchParams.get("session_id") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [faceShape, setFaceShape] = useState<FaceShape>("oval");
  const [styleLabels, setStyleLabels] = useState<string[]>([]);
  const [previewCell, setPreviewCell] = useState<HairStyleCell | null>(null);
  const [fullCells, setFullCells] = useState<HairStyleCell[]>([]);
  const [stylistBrief, setStylistBrief] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [ownerSecret, setOwnerSecret] = useState<string | undefined>(undefined);
  const [copiedBrief, setCopiedBrief] = useState(false);

  // Recall ownerSecret on mount
  useEffect(() => {
    if (token) {
      const recalled = recallHairOwnerSecret(token);
      if (recalled) { setOwnerSecret(recalled); return; }
    }
    const s = loadHairAnalysisState();
    if (s?.ownerSecret) setOwnerSecret(s.ownerSecret);
  }, [token]);

  // Initial fetch
  useEffect(() => {
    if (!initialized || authLoading) return;
    if (!token) { setErrMsg("Missing token. Please start over."); return; }
    let cancelled = false;

    (async () => {
      try {
        const fn = httpsCallable(getFunctions(), "getHairReport");
        const res = await fn({ token, ownerSecret });
        if (cancelled) return;

        const data = res.data as {
          status: "locked" | "unlocked";
          faceShape?: FaceShape;
          styleLabels?: string[];
          previewCellUrl?: string;
          cells?: Array<{ label: string; url: string }>;
          stylistBrief?: string;
          emailCaptured?: boolean;
        };

        if (data.faceShape) setFaceShape(data.faceShape);
        if (data.styleLabels) setStyleLabels(data.styleLabels);

        if (data.status === "unlocked" && data.cells) {
          setFullCells(data.cells.map((c) => ({ label: c.label, storagePath: "", url: c.url })));
          setStylistBrief(data.stylistBrief ?? "");
          setPhase("full");
          return;
        }

        if (data.previewCellUrl) {
          setPreviewCell({ label: data.styleLabels?.[0] ?? "Style 1", storagePath: "", url: data.previewCellUrl });
        }

        if (sessionId) { setPhase("polling"); return; }

        // Signed-in credit fast path
        if (user && ownerSecret) {
          try {
            const unlockFn = httpsCallable(getFunctions(), "unlockHairWithCredit");
            await unlockFn({ token, ownerSecret });
            if (cancelled) return;
            setPhase("polling");
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/INSUFFICIENT_CREDITS/i.test(msg)) { setPhase("paywall"); return; }
          }
        }

        if (data.emailCaptured || user) {
          setPhase("paywall");
        } else {
          setPhase("preview");
        }
      } catch (e) {
        if (!cancelled) setErrMsg(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [initialized, authLoading, user, token, sessionId, ownerSecret]);

  // Pre-create Stripe session on paywall
  useEffect(() => {
    if (phase !== "paywall" || stripeClientSecret) return;
    let cancelled = false;
    (async () => {
      try {
        const fn = httpsCallable(getFunctions(), "createHairCheckoutSession");
        const res = await fn({
          token,
          successUrl: typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname}`
            : "https://storyincolor.com/hair-analysis/result",
        });
        const data = res.data as { success: boolean; clientSecret?: string };
        if (!cancelled && data.clientSecret) setStripeClientSecret(data.clientSecret);
      } catch { /* lazy-create on click */ }
    })();
    return () => { cancelled = true; };
  }, [phase]);

  // Polling loop
  useEffect(() => {
    if (phase !== "polling") return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const fn = httpsCallable(getFunctions(), "getHairReport");
        const res = await fn({ token, ownerSecret });
        const data = res.data as {
          status: "locked" | "unlocked";
          cells?: Array<{ label: string; url: string }>;
          faceShape?: FaceShape;
          styleLabels?: string[];
          stylistBrief?: string;
        };
        if (cancelled) return;
        if (data.status === "unlocked" && data.cells) {
          if (data.faceShape) setFaceShape(data.faceShape);
          if (data.styleLabels) setStyleLabels(data.styleLabels);
          setFullCells(data.cells.map((c) => ({ label: c.label, storagePath: "", url: c.url })));
          setStylistBrief(data.stylistBrief ?? "");
          setPhase("full");
          return;
        }
      } catch { /* keep polling */ }
      if (!cancelled) {
        if (attempts >= 30) { setErrMsg("Generation is taking longer than usual. Please refresh in a minute."); return; }
        setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [phase, token, ownerSecret]);

  const submitEmail = useCallback(async () => {
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setErrMsg("Please enter a valid email.");
      return;
    }
    setEmailBusy(true);
    setErrMsg(null);
    try {
      const fn = httpsCallable(getFunctions(), "captureHairEmail");
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
    if (stripeClientSecret) { setPhase("checkout"); return; }
    try {
      const fn = httpsCallable(getFunctions(), "createHairCheckoutSession");
      const res = await fn({
        token,
        successUrl: typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : "https://storyincolor.com/hair-analysis/result",
      });
      const data = res.data as { success: boolean; clientSecret?: string };
      if (data.clientSecret) { setStripeClientSecret(data.clientSecret); setPhase("checkout"); }
      else setErrMsg("Could not start checkout. Try again.");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token, stripeClientSecret]);

  const deletePhotos = useCallback(async () => {
    if (!confirm("Delete uploaded photo and generated images from our servers?")) return;
    try {
      const fn = httpsCallable(getFunctions(), "deleteHairPhoto");
      await fn({ token, ownerSecret });
      alert("Your photos have been deleted.");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [token, ownerSecret]);

  if (errMsg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-rose-300">{errMsg}</p>
        <Link href="/readings/hairstyle-analysis" className="rounded-full bg-white px-6 py-3 text-sm text-black">
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
        <p className="text-sm text-white/70">Generating your 8 looks… (~30s)</p>
        <p className="max-w-md text-xs text-white/40">
          AI is rendering each style on your face. This only runs once.
        </p>
      </div>
    );
  }

  if (phase === "checkout" && stripeClientSecret) {
    return (
      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-md p-4">
          <button onClick={() => setPhase("paywall")} className="mb-3 text-xs uppercase tracking-[0.18em] text-white/40 hover:text-white">
            ← Back
          </button>
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  if (phase === "full") {
    return (
      <FullReportView
        faceShape={faceShape}
        styleLabels={styleLabels}
        cells={fullCells}
        stylistBrief={stylistBrief}
        token={token}
        ownerSecret={ownerSecret}
        copiedBrief={copiedBrief}
        onCopyBrief={() => {
          navigator.clipboard.writeText(stylistBrief).catch(() => {});
          setCopiedBrief(true);
          setTimeout(() => setCopiedBrief(false), 1500);
        }}
        onDeletePhotos={deletePhotos}
      />
    );
  }

  return (
    <PreviewView
      phase={phase}
      faceShape={faceShape}
      styleLabels={styleLabels}
      previewCell={previewCell}
      emailValue={emailValue}
      setEmailValue={setEmailValue}
      emailBusy={emailBusy}
      errMsg={errMsg}
      onSubmitEmail={submitEmail}
      onStartCheckout={startCheckout}
      goToEmail={() => setPhase("email-gate")}
    />
  );
}

/* ================================================================== */
/* PREVIEW VIEW                                                         */
/* ================================================================== */

function PreviewView({
  phase,
  faceShape,
  styleLabels,
  previewCell,
  emailValue,
  setEmailValue,
  emailBusy,
  errMsg,
  onSubmitEmail,
  onStartCheckout,
  goToEmail,
}: {
  phase: Phase;
  faceShape: FaceShape;
  styleLabels: string[];
  previewCell: HairStyleCell | null;
  emailValue: string;
  setEmailValue: (v: string) => void;
  emailBusy: boolean;
  errMsg: string | null;
  onSubmitEmail: () => void;
  onStartCheckout: () => void;
  goToEmail: () => void;
}) {
  const lockedCount = Math.max(0, styleLabels.length - 1);
  const showPaywall = phase === "paywall";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-5 py-12 md:px-8">

        {/* Hero */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            StoryInColor · Hairstyle Analysis
          </p>
          <h1 className="mt-3 text-2xl font-light italic md:text-3xl">
            8 looks generated for you.
          </h1>
        </div>

        {/* Face shape */}
        <div className="mt-8 flex justify-center">
          <FaceShapeSVG shape={faceShape} />
        </div>

        {/* Lock badge */}
        <div className="mt-8 flex justify-center">
          <CompletionBadge current={1} total={styleLabels.length || 8} reveal={false} />
        </div>

        {/* Grid */}
        <div className="mt-8">
          <SectionHeader
            eyebrow={`${lockedCount} more looks locked`}
            title="Your hairstyle report"
            locked={lockedCount > 0}
          />
          {styleLabels.length > 0 && (
            <HairStyleGrid
              styleLabels={styleLabels}
              cells={previewCell ? [previewCell] : []}
              revealAll={false}
              previewIndex={0}
            />
          )}
        </div>

        {/* Paywall CTA */}
        <div className="mt-10 rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
              One purchase, all 8 looks
            </p>
            <h3 className="mt-2 text-2xl font-light italic md:text-3xl">
              $4.99 · one-time
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Stylists charge $150–$250 for a consultation like this.
              Unlock all {styleLabels.length || 8} looks + a stylist brief
              you can show at your next appointment.
            </p>
          </div>

          {phase === "preview" && (
            <button
              onClick={goToEmail}
              className="mt-6 block w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black hover:bg-white/90"
            >
              Unlock all {styleLabels.length || 8} looks →
            </button>
          )}

          {phase === "email-gate" && (
            <div className="mt-5">
              <p className="text-xs text-white/55">
                Where should we send your looks link?
              </p>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !emailBusy) onSubmitEmail(); }}
                className="mt-2 w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
              />
              <button
                disabled={emailBusy}
                onClick={onSubmitEmail}
                className="mt-3 block w-full rounded-full bg-white px-6 py-3.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
              >
                {emailBusy ? "Saving…" : "Continue to unlock →"}
              </button>
              <p className="mt-2 text-[11px] text-white/40">
                We&rsquo;ll email you the link so you can come back later.
              </p>
            </div>
          )}

          {showPaywall && (
            <button
              onClick={onStartCheckout}
              className="mt-5 block w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black hover:bg-white/90"
            >
              Unlock all {styleLabels.length || 8} looks — $4.99
            </button>
          )}

          {errMsg && <p className="mt-3 text-xs text-rose-300">{errMsg}</p>}
        </div>

        <p className="mt-8 text-center text-[11px] text-white/30">
          For styling inspiration only. Not a professional consultation.
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* FULL REPORT VIEW                                                     */
/* ================================================================== */

function FullReportView({
  faceShape,
  styleLabels,
  cells,
  stylistBrief,
  token,
  ownerSecret,
  copiedBrief,
  onCopyBrief,
  onDeletePhotos,
}: {
  faceShape: FaceShape;
  styleLabels: string[];
  cells: HairStyleCell[];
  stylistBrief: string;
  token: string;
  ownerSecret?: string;
  copiedBrief: boolean;
  onCopyBrief: () => void;
  onDeletePhotos: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-5 py-12 md:px-8">

        {/* Hero */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            StoryInColor · Hairstyle Analysis
          </p>
          <h1 className="mt-3 text-2xl font-light italic md:text-3xl">
            Your 8 looks · Unlocked
          </h1>
        </div>

        <div className="mt-6 flex justify-center">
          <CompletionBadge current={styleLabels.length} total={styleLabels.length} reveal={true} />
        </div>

        {/* Face shape */}
        <div className="mt-8 flex justify-center">
          <FaceShapeSVG shape={faceShape} />
        </div>

        {/* Account claim — optional */}
        <AccountClaimCard token={token} ownerSecret={ownerSecret} />

        {/* Full grid */}
        <section className="mt-10">
          <SectionHeader eyebrow={`${styleLabels.length} looks`} title="Your hairstyle report" />
          <HairStyleGrid
            styleLabels={styleLabels}
            cells={cells}
            revealAll={true}
          />
        </section>

        {/* Stylist brief */}
        {stylistBrief && (
          <section className="mt-10">
            <SectionHeader eyebrow="Show this to your stylist" title="Your stylist brief" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-3">
                <Scissors className="mt-1 h-4 w-4 flex-shrink-0 text-white/50" />
                <p className="flex-1 text-sm leading-relaxed text-white/85">
                  {stylistBrief}
                </p>
              </div>
              <button
                onClick={onCopyBrief}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.05]"
              >
                {copiedBrief ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedBrief ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>
          </section>
        )}

        {/* Delete */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={onDeletePhotos}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/45 hover:border-rose-300/30 hover:text-rose-300/85"
          >
            <Trash2 className="h-3 w-3" />
            Delete my photos from the server
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/30">
          For styling inspiration only. Not a professional consultation.
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* ACCOUNT CLAIM — reused pattern from face-rating                     */
/* ================================================================== */

function AccountClaimCard({ token, ownerSecret }: { token: string; ownerSecret?: string }) {
  const router = useRouter();
  const { user } = useFirebase();
  const [phase, setPhase] = useState<"collapsed" | "form" | "submitting" | "success" | "dismissed">("collapsed");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (user || phase === "dismissed") return null;

  const submit = async () => {
    setErr(null);
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    if (!ownerSecret) { setErr("Session secret missing. Please refresh."); return; }
    setPhase("submitting");
    try {
      const fn = httpsCallable(getFunctions(), "claimHairAccount");
      const res = await fn({ token, ownerSecret, password });
      const data = res.data as { success: boolean; email: string };
      const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(getAuth(), data.email, password);
      setPhase("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not set up your account.");
      setPhase("form");
    }
  };

  return (
    <section className="mt-10">
      {phase === "success" ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.04] p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-300/85">
            <Check className="h-3 w-3" />
            Account saved
          </div>
          <p className="mt-2 text-sm text-white/85">Your looks are saved. Sign back in any time.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] text-black hover:bg-white/90"
          >
            Open dashboard →
          </button>
        </div>
      ) : phase === "collapsed" ? (
        <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm leading-relaxed text-white/85">
              Set a password to save these looks and access them from your dashboard.
            </p>
            <button onClick={() => setPhase("dismissed")} className="text-[11px] uppercase tracking-[0.16em] text-white/35 hover:text-white/60">
              Skip
            </button>
          </div>
          <button
            onClick={() => setPhase("form")}
            className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] text-black hover:bg-white/90"
          >
            Set a password
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Save your looks</p>
          <input
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={phase === "submitting"}
            className="mt-3 w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={phase === "submitting"}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
            autoComplete="new-password"
          />
          {err && <p className="mt-3 text-xs text-rose-300">{err}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={phase === "submitting"}
              className="inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] text-black hover:bg-white/90 disabled:opacity-50"
            >
              {phase === "submitting" ? "Saving…" : "Save & sign in"}
            </button>
            <button onClick={() => setPhase("dismissed")} className="text-[11px] uppercase tracking-[0.16em] text-white/35 hover:text-white/60">
              Skip
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
