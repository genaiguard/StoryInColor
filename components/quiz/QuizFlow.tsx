"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload as UploadIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDropzone } from "react-dropzone";

import type { QuizConfig, Question } from "@/lib/quiz/types";
import {
  pickAffirmation,
  LOADER_SUBMESSAGES,
} from "@/lib/quiz/types";
import { getToolBySlug } from "@/lib/tools/registry";
import {
  trackQuizStarted,
  trackQuizQuestionAnswered,
  trackQuizPhotoUploaded,
  newEventId,
} from "@/lib/analytics/events";
import { ProgressBar } from "@/components/quiz/primitives/ProgressBar";
import { OptionCard } from "@/components/quiz/primitives/OptionCard";
import { Affirmation } from "@/components/quiz/primitives/Affirmation";
import {
  useQuizState,
  progressForScreen,
  SCREEN_SEQUENCE,
} from "@/components/quiz/hooks/useQuizState";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getConfiguredStorage } from "@/app/firebase/storage-helpers";
import { getFunctions, httpsCallable } from "firebase/functions";

const ACCEPTED: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};
const MAX_BYTES = 10 * 1024 * 1024;

type QuizFlowProps = { config: QuizConfig };

/**
 * Top-level orchestrator for the 8-screen quiz funnel.
 * Per QUIZ-PIVOT-SPEC.md §4 §5.
 */
export default function QuizFlow({ config }: QuizFlowProps) {
  const router = useRouter();
  const { initialized } = useFirebase();
  const {
    state,
    recordAnswer,
    advance,
    back,
    setPendingReadingToken,
    setInputStoragePath,
  } = useQuizState(config);

  const [showAffirmation, setShowAffirmation] = useState(false);
  const [pendingAffirmation, setPendingAffirmation] = useState<string | null>(null);
  const [eventId] = useState(() => newEventId());

  // Fire QuizStarted once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const utm = readUtmFromUrl();
    trackQuizStarted({ slug: config.slug, eventId, utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug]);

  const onSelect = useCallback(
    (question: Question, optionId: string) => {
      recordAnswer(question.id, optionId);
      const screenIndex = SCREEN_SEQUENCE.indexOf(state.screen);
      trackQuizQuestionAnswered({
        slug: config.slug,
        questionId: question.id,
        optionId,
        screenIndex,
      });
      // Optionally show affirmation between screens
      if (question.affirmationAfter || Math.random() > 0.5) {
        setPendingAffirmation(question.affirmationAfter || pickAffirmation());
        setShowAffirmation(true);
      } else {
        advance();
      }
    },
    [advance, config.slug, recordAnswer, state.screen],
  );

  const onAffirmationDone = useCallback(() => {
    setShowAffirmation(false);
    setPendingAffirmation(null);
    advance();
  }, [advance]);

  // Render
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
        <ProgressBar value={progressForScreen(state.screen)} />
        <Affirmation message={pendingAffirmation} onDone={onAffirmationDone} />
      </div>
    );
  }

  const currentQuestion = pickQuestionForScreen(config, state.screen);

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <ProgressBar value={progressForScreen(state.screen)} />

      <header className="px-4 py-4 md:px-6">
        {state.screen !== "intro" && state.screen !== "loader" && state.screen !== "reveal" ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white/80"
            aria-label="Go back"
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
        {state.screen === "intro" ? (
          <IntroScreen config={config} onBegin={advance} />
        ) : null}

        {currentQuestion ? (
          <QuestionScreen question={currentQuestion} onSelect={onSelect} />
        ) : null}

        {state.screen === "upload" ? (
          <UploadScreen
            config={config}
            onUploaded={({ token, inputStoragePath }) => {
              setPendingReadingToken(token);
              setInputStoragePath(inputStoragePath);
              advance();
            }}
          />
        ) : null}

        {state.screen === "loader" ? (
          <LoaderScreen
            config={config}
            token={state.pendingReadingToken!}
            inputStoragePath={state.inputStoragePath!}
            quizAnswers={state.answers}
            eventId={eventId}
            onReady={() => {
              // Navigate to result/reveal page (token in query for static export)
              router.push(`/quiz/${config.slug}/result?token=${state.pendingReadingToken}`);
            }}
            onFailed={(reason) => {
              alert(`Reading failed: ${reason}`);
              back();
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function pickQuestionForScreen(
  config: QuizConfig,
  screen: ReturnType<typeof useQuizState>["state"]["screen"],
): Question | null {
  switch (screen) {
    case "hook":
      return config.hook;
    case "identityA":
      return config.identityA;
    case "identityB":
      return config.identityB;
    case "identityC":
      return config.identityC;
    case "aspiration":
      return config.aspiration;
    case "specific":
      return config.specific;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Intro screen — shows sample output + value prop before quiz begins.        */
/* Pattern from Nebula / BetterMe / FunnelFox 2026 web2app teardowns: opening */
/* with the artifact preview + "you'll get…" before the first quiz screen    */
/* lifts completion vs. cold-starting on a question.                         */
/* -------------------------------------------------------------------------- */

function IntroScreen({
  config,
  onBegin,
}: {
  config: QuizConfig;
  onBegin: () => void;
}) {
  const tool = getToolBySlug(config.slug);
  const sample = tool?.seo?.sampleImage;
  const whatYouGet = tool?.seo?.whatYouGet ?? [];
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="grid gap-8 md:grid-cols-2 md:items-center">
        {/* Left: sample preview */}
        {sample ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sample}
              alt={`${tool?.name ?? config.slug} sample reading`}
              className="block w-full"
              loading="eager"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-[11px] uppercase tracking-wider text-white/70">
              Sample reading · yours will be unique to your photo
            </div>
          </div>
        ) : null}

        {/* Right: value prop */}
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">
            {tool?.name ?? "Your reading"}
          </p>
          <h1 className="mt-2 text-3xl font-light italic leading-tight tracking-tight md:text-4xl">
            {tool?.tagline ?? "A reading made just for you."}
          </h1>
          {whatYouGet.length > 0 ? (
            <ul className="mt-6 space-y-2.5 text-sm text-white/80">
              {whatYouGet.slice(0, 4).map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-[5px] inline-block h-1 w-1 flex-shrink-0 rounded-full bg-white/60" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={onBegin}
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-medium text-black hover:bg-white/90 md:w-auto md:px-8"
          >
            Create your own
          </button>
          {/* Per category research (Noom, BetterMe, Nebula, Flo, Truity all
              hide quiz length on entry): we replace the time-disclosure
              line with a soft value signal rather than a question count. */}
          <p className="mt-3 text-xs text-white/50">
            Personalized to you · Free to try
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Question screen                                                            */
/* -------------------------------------------------------------------------- */

function QuestionScreen({
  question,
  onSelect,
}: {
  question: Question;
  onSelect: (question: Question, optionId: string) => void;
}) {
  const grid =
    question.layout === "image-grid"
      ? "grid grid-cols-2 gap-3"
      : question.layout === "emoji-grid"
        ? "grid grid-cols-2 gap-3"
        : "flex flex-col gap-3";
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-3xl font-light italic leading-tight tracking-tight md:text-5xl">
        {question.prompt}
      </h1>
      {question.subPrompt ? (
        <p className="mt-3 text-sm text-white/60">{question.subPrompt}</p>
      ) : null}
      <div className={`mt-8 ${grid}`}>
        {question.options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            layout={question.layout}
            onSelect={(optionId) => onSelect(question, optionId)}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Upload screen                                                              */
/* -------------------------------------------------------------------------- */

function UploadScreen({
  config,
  onUploaded,
}: {
  config: QuizConfig;
  onUploaded: (result: { token: string; inputStoragePath: string }) => void;
}) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setError(null);
      setBusy(true);
      setUploadProgress(0);
      try {
        const token = uuidv4();
        const ext =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
        const inputStoragePath = `pending/${token}/input.${ext}`;
        const storage = await getConfiguredStorage();
        // Use Firebase Storage uploadBytesResumable to track progress
        const { ref, uploadBytesResumable } = await import("firebase/storage");
        const storageRef = ref(storage, inputStoragePath);
        const task = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              setUploadProgress(snap.bytesTransferred / snap.totalBytes);
            },
            (err) => reject(err),
            () => resolve(),
          );
        });
        trackQuizPhotoUploaded({
          slug: config.slug,
          pendingReadingToken: token,
          fileSize: file.size,
        });
        onUploaded({ token, inputStoragePath });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [config.slug, onUploaded],
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
        One last step.
      </h1>
      <p className="mt-3 text-sm text-white/70">{config.uploadHint}</p>

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
            <p className="text-sm">
              Uploading… {Math.round(uploadProgress * 100)}%
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <UploadIcon className="h-7 w-7" />
            <p className="text-sm">
              {isDragActive
                ? "Drop your photo here"
                : "Drag & drop a photo, or click to choose"}
            </p>
            <p className="text-xs text-white/40">
              JPG, PNG, or WEBP up to 10MB
            </p>
          </div>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loader screen                                                              */
/* -------------------------------------------------------------------------- */

function LoaderScreen({
  config,
  token,
  inputStoragePath,
  quizAnswers,
  eventId,
  onReady,
  onFailed,
}: {
  config: QuizConfig;
  token: string;
  inputStoragePath: string;
  quizAnswers: Record<string, string>;
  eventId: string;
  onReady: () => void;
  onFailed: (reason: string) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [subMsgIndex, setSubMsgIndex] = useState(0);
  const startedAt = useMemo(() => Date.now(), []);

  // Run server generation (kicked off once on mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Bump callable timeout to 5 min — OpenAI generation can take
        // 30–90s and the Firebase default (70s) was throwing
        // deadline-exceeded mid-generation on slow runs.
        const fn = httpsCallable(getFunctions(), "generateForToolUnauth", {
          timeout: 300000,
        });
        const utm = readUtmFromUrl();
        const attribution = {
          ...utm,
          referrer: typeof document !== "undefined" ? document.referrer : undefined,
        };
        const res = await fn({
          toolId: config.toolId,
          inputStoragePath,
          token,
          quizAnswers,
          blurStrength: config.reveal.blurStrength,
          attribution,
          fbEventId: eventId,
        });
        if (cancelled) return;
        const data = res.data as { status?: string };
        if (data?.status === "ready") {
          // Hold the loader for at least 12s so the anticipation lands
          const elapsed = Date.now() - startedAt;
          const wait = Math.max(0, 12000 - elapsed);
          setTimeout(() => !cancelled && onReady(), wait);
        } else if (data?.status === "processing") {
          // Should not happen on the awaited call, but tolerate
          const wait = 3000;
          setTimeout(() => !cancelled && onReady(), wait);
        } else {
          throw new Error(`Unexpected status: ${data?.status}`);
        }
      } catch (err) {
        if (cancelled) return;
        onFailed(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loader step animator
  useEffect(() => {
    if (stepIndex >= config.loaderSteps.length - 1) return;
    const t = setTimeout(
      () => setStepIndex((i) => Math.min(i + 1, config.loaderSteps.length - 1)),
      config.loaderSteps[stepIndex].durationMs,
    );
    return () => clearTimeout(t);
  }, [stepIndex, config.loaderSteps]);

  // Sub-message rotation
  useEffect(() => {
    const t = setInterval(() => {
      setSubMsgIndex((i) => (i + 1) % LOADER_SUBMESSAGES.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <Loader2 className="mx-auto mb-8 h-7 w-7 animate-spin text-white/80" />
      <ul className="space-y-3">
        {config.loaderSteps.map((step, i) => (
          <li
            key={i}
            className={`text-base transition-opacity ${
              i < stepIndex
                ? "text-white/30"
                : i === stepIndex
                  ? "text-white"
                  : "text-white/0"
            }`}
          >
            {i < stepIndex ? "✓ " : ""}
            {step.label}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs italic text-white/50">
        {LOADER_SUBMESSAGES[subMsgIndex]}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

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
