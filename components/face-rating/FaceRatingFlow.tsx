"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload as UploadIcon, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  AGE_OPTIONS,
  COMPLIMENTS_OPTIONS,
  FACE_LOADER_STEPS,
  FACE_LOADER_SUBMESSAGES,
  pickFaceAffirmation,
  progressForFaceScreen,
  selfRateLabelFor,
  type Gender,
  type AgeRange,
  type GoalChip,
  type ComplimentsFreq,
} from "@/lib/face-rating/types";
import { ProgressBar } from "@/components/face-rating/primitives/ProgressBar";
import { Affirmation } from "@/components/face-rating/primitives/Affirmation";
import {
  useFaceRatingState,
  rememberOwnerSecret,
} from "@/components/face-rating/useFaceRatingState";
import {
  compressImage,
  describeCompression,
} from "@/lib/face-rating/compress-image";

// 3D rotating head — vanilla three.js (no R3F, no reconciler). Lazy-
// loaded so the ~150KB three.js bundle + 400KB GLB only ship on the
// upload screens that actually mount the component.
const Head3D = dynamic(() => import("@/components/face-rating/Head3D"), {
  ssr: false,
  loading: () => null,
});
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

export default function FaceRatingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // The funnel can be mounted under /face-rating OR under /readings/{slug}
  // (per the founder's "convert reading-by-reading" plan). Derive the
  // result destination from the current pathname so the user stays in
  // the same URL space.
  const resultPath = pathname?.startsWith("/readings/")
    ? `${pathname}/result`
    : "/face-rating/result";
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

  // If the saved state has a completed lightAnalysis OR is from the
  // pre-rewrite 8-screen flow (no ageRange field, "ready" in screen
  // sequence), reset to fresh intro. Keeps inviteCodeRedeemed if present.
  useEffect(() => {
    const isStale =
      state.lightAnalysis ||
      state.pendingReadingToken ||
      // Catch sessions that were on the old "ready" / "country" screens.
      (state.screen as string) === "ready" ||
      (state.screen as string) === "country";
    if (isStale) {
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

        {state.screen === "gender" && (
          <PromiseChipScreen
            title="Who are we reading?"
            options={GENDER_OPTIONS}
            onSelect={(id) => {
              setState((s) => ({ ...s, gender: id as Gender }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "age" && (
          <ChipScreen
            title="What's your age range?"
            subtitle="Different ages read differently."
            options={AGE_OPTIONS}
            onSelect={(id) => {
              setState((s) => ({ ...s, ageRange: id as AgeRange }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "goal" && (
          <ChipScreen
            title="What do you want to know first?"
            subtitle="Your reading will lean here."
            options={GOAL_OPTIONS}
            onSelect={(id) => {
              setState((s) => ({ ...s, goal: id as GoalChip }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "self-rate" && (
          <SelfRateScreen
            initial={state.selfRate ?? 5}
            onContinue={(v) => {
              setState((s) => ({ ...s, selfRate: v }));
              advance();
            }}
          />
        )}

        {state.screen === "mission" && (
          <MissionScreen onContinue={advance} />
        )}

        {state.screen === "compliments" && (
          <ChipScreen
            title="How often do strangers compliment your looks?"
            subtitle="Helps us read against your real-world feedback."
            options={COMPLIMENTS_OPTIONS}
            onSelect={(id) => {
              setState((s) => ({ ...s, complimentsFreq: id as ComplimentsFreq }));
              advanceWithMaybeAffirmation();
            }}
          />
        )}

        {state.screen === "lockin" && <LockInScreen onCommit={advance} />}

        {state.screen === "front-photo" && (
          <UploadScreen
            title="Front photo."
            hint="Look straight at the camera. Good lighting. No filter."
            silhouette="front"
            gender={state.gender}
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
            title="Now your side profile."
            hint="Turn 90° to your left or right. This adds jawline + structure depth — but you can skip if you'd rather not."
            silhouette="side"
            gender={state.gender}
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
            ageRange={state.ageRange}
            goal={state.goal}
            selfRate={state.selfRate}
            complimentsFreq={state.complimentsFreq}
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
                `${resultPath}?token=${state.pendingReadingToken}`,
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
            Get my honest rating
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- PromiseChipScreen — UMAX-style chip-as-character-voice ---------- */

function PromiseChipScreen<T extends string>({
  title,
  options,
  onSelect,
}: {
  title: string;
  options: { id: T; label: string; promise?: string }[];
  onSelect: (id: T) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        {title}
      </h1>
      <div className="mt-8 flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className="flex w-full flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left transition-colors hover:border-white/30 hover:bg-white/[0.06]"
          >
            <span className="text-base text-white">{opt.label}</span>
            {opt.promise && (
              <span className="text-xs text-white/55">{opt.promise}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- SelfRateScreen — UMAX self-rating slider, the key commitment ---------- */

function SelfRateScreen({
  initial,
  onContinue,
}: {
  initial: number;
  onContinue: (value: number) => void;
}) {
  const [v, setV] = useState(initial);
  const label = selfRateLabelFor(v);
  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-4xl">
        How would you rate yourself right now?
      </h1>
      <p className="mt-3 text-sm text-white/60">
        Be honest. This is just for you. We&rsquo;ll compare your view to ours.
      </p>
      <div className="mt-12">
        <div className="text-7xl font-light tracking-tight">
          {v.toFixed(1)}
          <span className="text-2xl text-white/40">/10</span>
        </div>
        <div className="mt-3 text-base font-light italic text-white/85">
          {label}
        </div>
      </div>
      <div className="mt-10 px-2">
        <input
          type="range"
          min={1}
          max={10}
          step={0.1}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          className="w-full accent-white"
          aria-label="Self-rating from 1 to 10"
        />
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-white/40">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onContinue(v)}
        className="mt-10 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-white/90"
      >
        Continue
      </button>
    </div>
  );
}

/* ---------- MissionScreen — narrative lock ---------- */

function MissionScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        Our job is simple
      </p>
      <h1 className="mt-6 text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        Give you the honest read no friend will give you —
      </h1>
      <p className="mt-4 text-2xl font-light italic text-white/85 md:text-3xl">
        and the plan to act on it.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-12 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-white/90"
      >
        I&rsquo;m in
      </button>
    </div>
  );
}

/* ---------- LockInScreen — UMAX press-and-hold commitment ritual ---------- */

function LockInScreen({ onCommit }: { onCommit: () => void }) {
  const [holdMs, setHoldMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const HOLD_TARGET = 2000; // 2s hold

  const stop = useCallback(() => {
    startRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHoldMs(0);
  }, []);

  const tick = useCallback(() => {
    if (startRef.current == null) return;
    const elapsed = Date.now() - startRef.current;
    setHoldMs(elapsed);
    if (elapsed >= HOLD_TARGET) {
      // Commit
      startRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      onCommit();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onCommit]);

  const start = useCallback(() => {
    if (startRef.current != null) return;
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pct = Math.min(1, holdMs / HOLD_TARGET);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        Time to lock in.
      </h1>
      <p className="mt-3 text-sm text-white/60">
        Press and hold to start your reading.
      </p>
      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onMouseDown={start}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={(e) => {
            e.preventDefault();
            start();
          }}
          onTouchEnd={stop}
          onTouchCancel={stop}
          className="relative h-40 w-40 select-none rounded-full bg-white/[0.04] outline-none"
          aria-label="Press and hold to commit"
        >
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            className="absolute inset-0"
          >
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="3"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
              style={{ transition: holdMs === 0 ? "stroke-dashoffset 0.2s" : undefined }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs uppercase tracking-[0.18em] text-white/70">
              {pct >= 1 ? "Locked" : pct > 0 ? "Hold…" : "Press"}
            </span>
          </div>
        </button>
      </div>
      <p className="mt-8 text-xs text-white/40">
        2 seconds.
      </p>
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
  silhouette,
  gender,
  existingToken,
  slot,
  allowSkip,
  onUploaded,
  onSkip,
}: {
  title: string;
  hint: string;
  silhouette: "front" | "side";
  gender?: Gender;
  existingToken?: string;
  slot: "front" | "side";
  allowSkip?: boolean;
  onUploaded: (result: { token: string; path: string }) => void;
  onSkip?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyStage, setBusyStage] = useState<"preparing" | "uploading" | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (rawFile: File | undefined | null) => {
      if (!rawFile) return;
      // Validation. Server-side ALSO enforces a 10MB cap.
      if (!/^image\/(png|jpeg|webp)$/.test(rawFile.type)) {
        setErr("Please upload a JPG, PNG, or WEBP image.");
        return;
      }
      if (rawFile.size > MAX_BYTES) {
        setErr(
          "File too large — please use under 10MB. (Most modern phones export much smaller.)",
        );
        return;
      }
      setErr(null);
      setBusy(true);
      setBusyStage("preparing");
      setProgress(0);
      try {
        // CLIENT-SIDE COMPRESSION:
        // Resize to max 1600px long side + JPEG quality 0.88. This is
        // already at or above the resolution the server downsamples to,
        // so zero fidelity loss on the OpenAI side. Saves bandwidth +
        // Storage cost. EXIF orientation is applied during decode so
        // photos are upright when the model reads them.
        const file = await compressImage(rawFile, {
          maxDimension: 1600,
          quality: 0.88,
        });
        if (file !== rawFile && process.env.NODE_ENV !== "production") {
          // Dev-only log; harmless in prod (gated by check above).
          console.info(
            `[face-rating] photo compressed: ${describeCompression(rawFile, file)}`,
          );
        }

        const token = existingToken || uuidv4();
        // Compressed output is always JPEG; if compression was skipped
        // (already small), fall back to the original mime extension.
        const ext =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
        const subId = uuidv4().slice(0, 8);
        const path = `pending/${token}/input-${slot}-${subId}.${ext}`;
        setBusyStage("uploading");
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
        setBusyStage(null);
      }
    },
    [existingToken, onUploaded, slot],
  );

  // Native label+input pattern — far more reliable than react-dropzone's
  // synthetic click. Drag + drop preserved with separate handlers.
  // The silhouette SVG (front or side) sits at the visual center of the
  // dropzone so the user immediately knows which photo is being asked
  // for, without reading the headline.
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-white/70">{hint}</p>

      <label
        htmlFor={`face-upload-${slot}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDragActive) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`group relative mt-8 flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
          isDragActive
            ? "border-white bg-white/[0.06]"
            : "border-white/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-white/40"
        }`}
      >
        <input
          ref={inputRef}
          id={`face-upload-${slot}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            // Reset so re-selecting the same file fires onChange again.
            e.target.value = "";
          }}
        />

        {/* 3D rotating head — sculptural editorial bust. Fades + shrinks
            while uploading so the upload progress UI takes focus. No SVG
            fallback layered underneath — Head3D shows nothing until
            three.js + the GLB are ready (typically <1s on a warm cache),
            which is cleaner than a flickering double image. */}
        <div
          className={`flex h-full w-full items-center justify-center text-white/85 transition-all duration-300 ${
            busy ? "scale-75 opacity-30" : "opacity-100 group-hover:opacity-95"
          }`}
        >
          <Head3D
            variant={silhouette}
            gender={gender}
            className="h-[260px] w-[260px] md:h-[300px] md:w-[300px]"
          />
        </div>

        {/* Action overlay — sits over the silhouette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-6">
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-white/85" />
              <p className="text-sm text-white/85">
                {busyStage === "preparing"
                  ? "Preparing your photo…"
                  : `Uploading… ${Math.round(progress * 100)}%`}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm transition-colors group-hover:bg-white/15">
                <UploadIcon className="h-3.5 w-3.5" />
                {isDragActive
                  ? "Drop your photo"
                  : silhouette === "front"
                    ? "Tap to choose front photo"
                    : "Tap to choose side profile"}
              </div>
              <p className="text-[11px] text-white/45">
                JPG · PNG · WEBP · up to 10MB
              </p>
            </>
          )}
        </div>
      </label>

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
          Skip — front photo is enough
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
  ageRange,
  goal,
  selfRate,
  complimentsFreq,
  inviteCode,
  eventId,
  onReady,
  onFailed,
}: {
  token: string;
  frontPath: string;
  sidePath?: string;
  gender?: string;
  ageRange?: string;
  goal?: string;
  selfRate?: number;
  complimentsFreq?: string;
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
          ageRange,
          goal,
          selfRate,
          complimentsFreq,
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
