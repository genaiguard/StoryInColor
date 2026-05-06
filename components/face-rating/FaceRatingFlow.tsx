"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload as UploadIcon, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDropzone } from "react-dropzone";
import {
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  FACE_LOADER_STEPS,
  FACE_LOADER_SUBMESSAGES,
  pickFaceAffirmation,
  progressForFaceScreen,
  type Gender,
  type GoalChip,
} from "@/lib/face-rating/types";
import { ProgressBar } from "@/components/quiz/primitives/ProgressBar";
import { Affirmation } from "@/components/quiz/primitives/Affirmation";
import {
  useFaceRatingState,
  rememberOwnerSecret,
} from "@/components/face-rating/useFaceRatingState";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getConfiguredStorage } from "@/app/firebase/storage-helpers";
import { getFunctions, httpsCallable } from "firebase/functions";
import { newEventId } from "@/lib/analytics/events";

const ACCEPTED: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};
const MAX_BYTES = 10 * 1024 * 1024;

// Country list — short. Most face-rating users globally fall in these
// English-speaking + EU countries. Server uses this as a calibration hint
// for the demographic_band; uncommon countries map to "global" silently.
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "TR", name: "Turkey" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "OTHER", name: "Other / global" },
];

export default function FaceRatingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initialized } = useFirebase();
  const { state, setState, advance, back } = useFaceRatingState();
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [pendingAffirmation, setPendingAffirmation] = useState<string | null>(null);
  const [eventId] = useState(() => newEventId());

  // If a friend's invite code is on the URL, capture it.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && /^[a-z0-9]{6}$/i.test(ref)) {
      setState((s) => ({ ...s, inviteCodeRedeemed: ref.toLowerCase() }));
    }
  }, [searchParams, setState]);

  // M4: If the saved state has a completed lightAnalysis, the user already
  // ran a reading. Don't resume the old token — start fresh on the intro
  // screen but keep `inviteCodeRedeemed` if present.
  useEffect(() => {
    if (state.lightAnalysis || state.pendingReadingToken) {
      setState((s) => ({
        screen: "intro",
        inviteCodeRedeemed: s.inviteCodeRedeemed,
        startedAt: new Date().toISOString(),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAffirmationDone = useCallback(() => {
    setShowAffirmation(false);
    setPendingAffirmation(null);
    advance();
  }, [advance]);

  const advanceWithMaybeAffirmation = useCallback(() => {
    if (Math.random() > 0.55) {
      setPendingAffirmation(pickFaceAffirmation());
      setShowAffirmation(true);
    } else {
      advance();
    }
  }, [advance]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (showAffirmation && pendingAffirmation) {
    return (
      <div className="relative flex min-h-screen flex-col bg-black text-white">
        <ProgressBar value={progressForFaceScreen(state.screen)} />
        <Affirmation message={pendingAffirmation} onDone={onAffirmationDone} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <ProgressBar value={progressForFaceScreen(state.screen)} />

      <header className="px-4 py-4 md:px-6">
        {state.screen !== "intro" && state.screen !== "loader" && state.screen !== "reveal" ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white/80"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white/80"
          >
            <ArrowLeft className="h-3 w-3" />
            Exit
          </Link>
        )}
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-5 pb-12 md:px-10">
        {state.screen === "intro" && <IntroScreen onBegin={advance} />}

        {state.screen === "ready" && (
          <ReadyScreen
            onYes={advanceWithMaybeAffirmation}
            onLater={() => router.push("/")}
          />
        )}

        {state.screen === "gender" && (
          <ChipScreen
            title="Quick calibration."
            subtitle="So we score against the right reference group."
            options={GENDER_OPTIONS}
            onSelect={(id) => {
              setState((s) => ({ ...s, gender: id as Gender }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "goal" && (
          <ChipScreen
            title="What are you here for?"
            subtitle="One pick. We tune the report."
            options={GOAL_OPTIONS}
            onSelect={(id) => {
              setState((s) => ({ ...s, goal: id as GoalChip }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "country" && (
          <ChipScreen
            title="Where are you?"
            subtitle="Used for the percentile calibration."
            options={COUNTRIES.map((c) => ({ id: c.code, label: c.name }))}
            onSelect={(id) => {
              setState((s) => ({ ...s, countryCode: id }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "front-photo" && (
          <UploadScreen
            title="Front photo."
            hint="Looking straight at the camera. Good lighting. No filter."
            existingToken={state.pendingReadingToken}
            slot="front"
            onUploaded={({ token, path }) => {
              setState((s) => ({
                ...s,
                pendingReadingToken: token,
                frontPhotoStoragePath: path,
              }));
              advance();
            }}
          />
        )}

        {state.screen === "side-photo" && (
          <UploadScreen
            title="Side profile (optional)."
            hint="Profile shot — left or right. Adds jawline + structure depth. Skippable."
            existingToken={state.pendingReadingToken}
            slot="side"
            allowSkip
            onUploaded={({ path }) => {
              setState((s) => ({ ...s, sidePhotoStoragePath: path }));
              advance();
            }}
            onSkip={advance}
          />
        )}

        {state.screen === "loader" && state.pendingReadingToken && state.frontPhotoStoragePath && (
          <LoaderScreen
            token={state.pendingReadingToken}
            frontPath={state.frontPhotoStoragePath}
            sidePath={state.sidePhotoStoragePath}
            gender={state.gender}
            goal={state.goal}
            countryCode={state.countryCode}
            inviteCode={state.inviteCodeRedeemed}
            eventId={eventId}
            onReady={(lightAnalysis, ownerSecret) => {
              setState((s) => ({
                ...s,
                lightAnalysis,
                ownerSecret: ownerSecret || s.ownerSecret,
              }));
              if (state.pendingReadingToken && ownerSecret) {
                rememberOwnerSecret(state.pendingReadingToken, ownerSecret);
              }
              router.push(
                `/face-rating/result?token=${state.pendingReadingToken}`,
              );
            }}
            onFailed={(reason) => {
              alert(`Reading failed: ${reason}`);
              back();
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ---------- Intro ---------- */

function IntroScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
            Sample
          </div>
          <div className="mt-4 text-7xl font-light tracking-tight">
            7.4<span className="text-3xl text-white/40">/10</span>
          </div>
          <div className="mt-2 text-base text-white/80">Chadlite</div>
          <div className="mt-1 text-xs text-white/50">Top 12% — Country</div>
          <ul className="mt-6 space-y-1.5 text-xs text-white/60">
            <li>• 8 calibrated sub-scores</li>
            <li>• Archetype identity</li>
            <li>• Top strengths + areas for growth</li>
            <li>• Celebrity look-alikes</li>
            <li>• Glow-up plan</li>
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">
            StoryInColor · Face Rating
          </p>
          <h1 className="mt-2 text-4xl font-light italic leading-tight tracking-tight md:text-5xl">
            Get your honest face rating.
          </h1>
          <p className="mt-4 text-sm text-white/70 md:text-base">
            Calibrated against thousands of reference photos. PSL tier,
            sub-scores, percentile, archetype, strengths, growth areas, and
            your glow-up plan. Same input → same output. No score volatility.
          </p>
          <button
            type="button"
            onClick={onBegin}
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-medium text-black hover:bg-white/90 md:w-auto md:px-8"
          >
            Get my rating
          </button>
          <p className="mt-3 text-xs text-white/50">
            One-time · $4.99 to unlock full report
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ready (reverse-psychology gate) ---------- */

function ReadyScreen({
  onYes,
  onLater,
}: {
  onYes: () => void;
  onLater: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <h1 className="text-4xl font-light italic leading-tight tracking-tight md:text-5xl">
        Are you ready for an honest score?
      </h1>
      <p className="mt-4 text-sm text-white/60">
        Honest means honest. We don&rsquo;t inflate.
      </p>
      <div className="mt-10 flex flex-col gap-3 md:flex-row md:justify-center">
        <button
          type="button"
          onClick={onYes}
          className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-white/90"
        >
          Yes, I&rsquo;m ready
        </button>
        <button
          type="button"
          onClick={onLater}
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3.5 text-sm font-medium text-white/70 hover:bg-white/5"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

/* ---------- ChipScreen ---------- */

function ChipScreen<T extends string>({
  title,
  subtitle,
  options,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  options: { id: T; label: string }[];
  onSelect: (id: T) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        {title}
      </h1>
      {subtitle && <p className="mt-3 text-sm text-white/60">{subtitle}</p>}
      <div className="mt-8 flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left text-sm text-white transition-colors hover:border-white/30 hover:bg-white/[0.06]"
          >
            <span>{opt.label}</span>
            <span className="text-white/30">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- UploadScreen (used for both front + side) ---------- */

function UploadScreen({
  title,
  hint,
  existingToken,
  slot,
  allowSkip,
  onUploaded,
  onSkip,
}: {
  title: string;
  hint: string;
  existingToken?: string;
  slot: "front" | "side";
  allowSkip?: boolean;
  onUploaded: (result: { token: string; path: string }) => void;
  onSkip?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setErr(null);
      setBusy(true);
      setProgress(0);
      try {
        const token = existingToken || uuidv4();
        const ext =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
        // Unique filename per upload so re-uploads don't collide with the
        // create-only storage rule. M5.
        const subId = uuidv4().slice(0, 8);
        const path = `pending/${token}/input-${slot}-${subId}.${ext}`;
        const storage = await getConfiguredStorage();
        const { ref, uploadBytesResumable } = await import("firebase/storage");
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              setProgress(snap.bytesTransferred / snap.totalBytes);
            },
            (e) => reject(e),
            () => resolve(),
          );
        });
        onUploaded({ token, path });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [existingToken, onUploaded, slot],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxSize: MAX_BYTES,
    multiple: false,
    onDrop,
  });

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-white/70">{hint}</p>

      <div
        {...getRootProps()}
        className={`mt-8 flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
          isDragActive
            ? "border-white bg-white/[0.06]"
            : "border-white/20 bg-white/[0.02] hover:border-white/40"
        }`}
      >
        <input {...getInputProps()} />
        {busy ? (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Uploading… {Math.round(progress * 100)}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <UploadIcon className="h-7 w-7" />
            <p className="text-sm">
              {isDragActive ? "Drop here" : "Drag & drop, or click to choose"}
            </p>
            <p className="text-xs text-white/40">JPG, PNG, WEBP — up to 10MB</p>
          </div>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {err}
        </p>
      )}
      {allowSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full rounded-full border border-white/10 px-6 py-3 text-xs uppercase tracking-[0.18em] text-white/50 hover:bg-white/[0.04]"
        >
          Skip — front only
        </button>
      )}
    </div>
  );
}

/* ---------- LoaderScreen ---------- */

function LoaderScreen({
  token,
  frontPath,
  sidePath,
  gender,
  goal,
  countryCode,
  inviteCode,
  eventId,
  onReady,
  onFailed,
}: {
  token: string;
  frontPath: string;
  sidePath?: string;
  gender?: string;
  goal?: string;
  countryCode?: string;
  inviteCode?: string;
  eventId: string;
  onReady: (lightAnalysis: any, ownerSecret?: string) => void;
  onFailed: (reason: string) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [subMsgIndex, setSubMsgIndex] = useState(0);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fn = httpsCallable(getFunctions(), "analyzeFaceUnauth", {
          timeout: 120000,
        });
        const utm = readUtmFromUrl();
        const attribution = {
          ...utm,
          referrer: typeof document !== "undefined" ? document.referrer : undefined,
        };
        const res = await fn({
          token,
          frontPhotoStoragePath: frontPath,
          sidePhotoStoragePath: sidePath,
          gender,
          goal,
          countryCode,
          inviteCode,
          attribution,
          fbEventId: eventId,
        });
        if (cancelled) return;
        const data = res.data as {
          status?: string;
          lightAnalysis?: any;
          ownerSecret?: string;
        };
        // If user came in via someone's invite code, redeem it now.
        if (inviteCode) {
          try {
            const redeem = httpsCallable(getFunctions(), "redeemFaceRatingInvite");
            await redeem({ token, inviteCode });
          } catch {
            /* non-fatal */
          }
        }
        if (data?.status === "ready" && data.lightAnalysis) {
          const elapsed = Date.now() - startedAt;
          // Hold for at least 8s so the loader anticipation lands.
          const wait = Math.max(0, 8000 - elapsed);
          setTimeout(
            () => !cancelled && onReady(data.lightAnalysis, data.ownerSecret),
            wait,
          );
        } else {
          throw new Error(`Unexpected status: ${data?.status}`);
        }
      } catch (e) {
        if (cancelled) return;
        onFailed(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stepIndex >= FACE_LOADER_STEPS.length - 1) return;
    const t = setTimeout(
      () => setStepIndex((i) => Math.min(i + 1, FACE_LOADER_STEPS.length - 1)),
      FACE_LOADER_STEPS[stepIndex].durationMs,
    );
    return () => clearTimeout(t);
  }, [stepIndex]);

  useEffect(() => {
    const t = setInterval(() => {
      setSubMsgIndex((i) => (i + 1) % FACE_LOADER_SUBMESSAGES.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <Loader2 className="mx-auto mb-8 h-7 w-7 animate-spin text-white/80" />
      <ul className="space-y-3">
        {FACE_LOADER_STEPS.map((step, i) => (
          <li
            key={i}
            className={`flex items-center justify-center gap-2 text-base transition-opacity ${
              i < stepIndex
                ? "text-white/30"
                : i === stepIndex
                  ? "text-white"
                  : "text-white/0"
            }`}
          >
            {i < stepIndex && <Check className="h-3.5 w-3.5 text-white/30" />}
            <span>{step.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs italic text-white/50">
        {FACE_LOADER_SUBMESSAGES[subMsgIndex]}
      </p>
    </div>
  );
}

/* ---------- helpers ---------- */

function readUtmFromUrl(): Record<string, string | undefined> {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  const utm: Record<string, string | undefined> = {};
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]) {
    const v = sp.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}
