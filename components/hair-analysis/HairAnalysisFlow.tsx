"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload as UploadIcon, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  GOAL_OPTIONS,
  AVOID_OPTIONS,
  SOCIAL_OPTIONS,
  SELF_DIRECTION_OPTIONS,
  BLOCKER_OPTIONS,
  FEELING_OPTIONS,
  IMPACT_OPTIONS,
  HAIR_LOADER_STEPS,
  HAIR_LOADER_SUBMESSAGES,
  pickHairAffirmation,
  progressForHairScreen,
  deriveTransformationLevel,
  type HairGoal,
  type HairAvoid,
  type HairSocialMotivation,
  type HairSelfDirection,
  type HairBlocker,
  type HairFeeling,
  type HairImpact,
} from "@/lib/hair-analysis/types";
import {
  useHairAnalysisState,
  rememberHairOwnerSecret,
} from "@/components/hair-analysis/useHairAnalysisState";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getConfiguredStorage } from "@/app/firebase/storage-helpers";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { newEventId } from "@/lib/analytics/events";

const ACCEPTED: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};
const MAX_BYTES = 10 * 1024 * 1024;

export default function HairAnalysisFlow() {
  const router = useRouter();
  const { state, setState, goTo, advance, back } = useHairAnalysisState();
  useFirebase();

  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [loaderStep, setLoaderStep] = useState(0);
  const [loaderSubMsg, setLoaderSubMsg] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const screen = state.screen;
  const progress = progressForHairScreen(screen);

  // --- Loader animation ---
  useEffect(() => {
    if (screen !== "loader") return;
    let step = 0;
    let sub = 0;
    setLoaderStep(0);
    setLoaderSubMsg(0);

    const stepTimer = setInterval(() => {
      step += 1;
      if (step < HAIR_LOADER_STEPS.length) {
        setLoaderStep(step);
      } else {
        clearInterval(stepTimer);
      }
    }, 1100);

    const subTimer = setInterval(() => {
      sub = (sub + 1) % HAIR_LOADER_SUBMESSAGES.length;
      setLoaderSubMsg(sub);
    }, 1400);

    return () => {
      clearInterval(stepTimer);
      clearInterval(subTimer);
    };
  }, [screen]);

  // --- File selection ---
  const handleFile = useCallback((file: File) => {
    setUploadErr(null);
    if (!Object.keys(ACCEPTED).includes(file.type)) {
      setUploadErr("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadErr("Image is too large. Max 10 MB.");
      return;
    }
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // --- Submit photo + call analyzeHairUnauth ---
  const submitPhoto = useCallback(async () => {
    if (!photoFile) return;
    setUploadBusy(true);
    setUploadErr(null);

    try {
      const token = uuidv4();
      const storage = await getConfiguredStorage();
      const ext = photoFile.name.split(".").pop() || "jpg";
      const storagePath = `hair-analysis-pending/${token}/photo.${ext}`;
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, photoFile);

      goTo("loader");

      const transformationLevel = deriveTransformationLevel(
        state.goal,
        state.selfDirection,
        state.feeling,
      );

      const fn = httpsCallable(getFunctions(), "analyzeHairUnauth");
      const res = await fn({
        token,
        photoStoragePath: storagePath,
        goal: state.goal,
        avoid: state.avoid,
        social: state.social,
        selfDirection: state.selfDirection,
        blocker: state.blocker,
        feeling: state.feeling,
        impact: state.impact,
        transformationLevel,
        fbEventId: newEventId(),
      });

      const data = res.data as {
        success: boolean;
        token: string;
        ownerSecret: string;
      };

      setState((s) => ({
        ...s,
        pendingToken: data.token,
        ownerSecret: data.ownerSecret,
        photoStoragePath: storagePath,
      }));

      if (data.ownerSecret) {
        rememberHairOwnerSecret(data.token, data.ownerSecret);
      }

      router.push(`/hair-analysis/result?token=${data.token}`);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      goTo("photo-upload");
    } finally {
      setUploadBusy(false);
    }
  }, [photoFile, state, goTo, setState, router]);

  // Trigger submit once we hit loader and have a file
  useEffect(() => {
    if (screen === "loader" && photoFile && !state.pendingToken) {
      submitPhoto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const showAffirmation = (cb: () => void) => {
    setAffirmation(pickHairAffirmation());
    setTimeout(() => {
      setAffirmation(null);
      cb();
    }, 600);
  };

  /* ------------------------------------------------------------------ */
  /* RENDER                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Progress bar */}
      {screen !== "intro" && screen !== "loader" && screen !== "reveal" && (
        <div className="fixed left-0 top-0 z-50 h-[2px] w-full bg-white/10">
          <div
            className="h-full bg-white/60 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div className="mx-auto max-w-md px-5 py-16">

        {/* Back button */}
        {screen !== "intro" && screen !== "loader" && screen !== "reveal" && (
          <button
            onClick={back}
            className="mb-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/40 hover:text-white/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}

        {/* Affirmation overlay */}
        {affirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <p className="text-lg font-light tracking-wide text-white/90">{affirmation}</p>
          </div>
        )}

        {/* ---- SCREENS ---- */}

        {screen === "intro" && (
          <IntroScreen onStart={() => advance()} />
        )}

        {screen === "q1-goal" && (
          <QuestionScreen
            eyebrow="01 / 07"
            title="What's your #1 goal right now?"
            options={GOAL_OPTIONS}
            selected={state.goal}
            onSelect={(v: HairGoal) => {
              setState((s) => ({ ...s, goal: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "q2-avoid" && (
          <QuestionScreen
            eyebrow="02 / 07"
            title="What's the one thing we should never do to your hair?"
            options={AVOID_OPTIONS}
            selected={state.avoid}
            onSelect={(v: HairAvoid) => {
              setState((s) => ({ ...s, avoid: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "q3-social" && (
          <QuestionScreen
            eyebrow="03 / 07"
            title="How important is it to you that others notice?"
            options={SOCIAL_OPTIONS}
            selected={state.social}
            onSelect={(v: HairSocialMotivation) => {
              setState((s) => ({ ...s, social: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "q4-self" && (
          <QuestionScreen
            eyebrow="04 / 07"
            title="Is there a version of yourself you're trying to get back to — or move toward?"
            options={SELF_DIRECTION_OPTIONS}
            selected={state.selfDirection}
            onSelect={(v: HairSelfDirection) => {
              setState((s) => ({ ...s, selfDirection: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "q5-blocker" && (
          <QuestionScreen
            eyebrow="05 / 07"
            title="What's been holding you back from changing your hair?"
            options={BLOCKER_OPTIONS}
            selected={state.blocker}
            onSelect={(v: HairBlocker) => {
              setState((s) => ({ ...s, blocker: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "q6-feeling" && (
          <QuestionScreen
            eyebrow="06 / 07"
            title="How do you want to feel when you leave the salon?"
            options={FEELING_OPTIONS}
            selected={state.feeling}
            onSelect={(v: HairFeeling) => {
              setState((s) => ({ ...s, feeling: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "q7-impact" && (
          <QuestionScreen
            eyebrow="07 / 07"
            title="How much do you think the right hairstyle could change things for you?"
            options={IMPACT_OPTIONS}
            selected={state.impact}
            onSelect={(v: HairImpact) => {
              setState((s) => ({ ...s, impact: v }));
              showAffirmation(() => advance());
            }}
          />
        )}

        {screen === "lockin" && (
          <LockInScreen onContinue={() => advance()} />
        )}

        {screen === "photo-upload" && (
          <PhotoUploadScreen
            photoPreview={photoPreview}
            uploadErr={uploadErr}
            uploadBusy={uploadBusy}
            fileInputRef={fileInputRef}
            onDrop={handleDrop}
            onFileChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            onSubmit={() => {
              if (photoFile) advance();
            }}
          />
        )}

        {screen === "loader" && (
          <LoaderScreen
            stepIndex={loaderStep}
            subMsgIndex={loaderSubMsg}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Sub-screens                                                          */
/* ================================================================== */

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">
        StoryInColor · Hairstyle Analysis
      </p>
      <h1 className="mt-5 text-3xl font-light leading-tight tracking-tight md:text-4xl">
        8 hairstyles.<br />
        <span className="italic">Generated for your face.</span>
      </h1>
      <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
        Answer 7 quick questions. Upload one photo. We generate 8 looks
        tailored to your face shape and goals. See one instantly — then decide
        if you want to see what the rest look like on you.
      </p>
      <button
        onClick={onStart}
        className="mt-10 rounded-full bg-white px-8 py-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
      >
        Get my looks →
      </button>
      <p className="mt-4 text-[11px] text-white/30">
        For styling inspiration only. Takes about 90 seconds.
      </p>
    </div>
  );
}

function QuestionScreen<T extends string>({
  eyebrow,
  title,
  options,
  selected,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  options: { id: T; label: string; sub?: string }[];
  selected: T | undefined;
  onSelect: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-xl font-light leading-snug tracking-tight md:text-2xl">
        {title}
      </h2>
      <ul className="mt-8 space-y-2.5">
        {options.map((opt) => (
          <li key={opt.id}>
            <button
              onClick={() => onSelect(opt.id)}
              className={`w-full rounded-xl border px-5 py-4 text-left transition-all ${
                selected === opt.id
                  ? "border-white/40 bg-white/[0.08]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white/90">{opt.label}</p>
                  {opt.sub && (
                    <p className="mt-0.5 text-xs text-white/45">{opt.sub}</p>
                  )}
                </div>
                {selected === opt.id && (
                  <Check className="h-4 w-4 flex-shrink-0 text-white/70" />
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LockInScreen({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    const t = setTimeout(onContinue, 2200);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-white/10" />
        <div className="relative rounded-full bg-white/[0.08] p-4">
          <Check className="h-7 w-7 text-white/80" />
        </div>
      </div>
      <p className="mt-6 text-lg font-light text-white/80">
        Building your profile…
      </p>
      <p className="mt-2 text-sm text-white/40">
        Now let's see your face.
      </p>
    </div>
  );
}

function PhotoUploadScreen({
  photoPreview,
  uploadErr,
  uploadBusy,
  fileInputRef,
  onDrop,
  onFileChange,
  onSubmit,
}: {
  photoPreview: string | null;
  uploadErr: string | null;
  uploadBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
        Almost there
      </p>
      <h2 className="mt-3 text-xl font-light leading-snug tracking-tight md:text-2xl">
        Upload a front-facing photo
      </h2>
      <p className="mt-2 text-sm text-white/50">
        Even, natural light. Hair in its natural fall. No heavy filters.
        Processed securely and never stored beyond your session.
      </p>

      <div
        className={`mt-7 relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border transition-colors ${
          photoPreview
            ? "border-white/25 bg-white/[0.04]"
            : "border-dashed border-white/20 bg-white/[0.02] hover:border-white/35 hover:bg-white/[0.04]"
        }`}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={Object.keys(ACCEPTED).join(",")}
          className="sr-only"
          onChange={onFileChange}
        />
        {photoPreview ? (
          <img
            src={photoPreview}
            alt="Your photo"
            className="max-h-64 w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <UploadIcon className="h-8 w-8 text-white/30" />
            <p className="text-sm text-white/50">
              Tap to select or drag and drop
            </p>
            <p className="text-[11px] text-white/30">JPG, PNG, WEBP · max 10 MB</p>
          </div>
        )}
      </div>

      {uploadErr && (
        <p className="mt-3 text-xs text-rose-300">{uploadErr}</p>
      )}

      {photoPreview && (
        <button
          onClick={onSubmit}
          disabled={uploadBusy}
          className="mt-5 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
        >
          {uploadBusy ? "Uploading…" : "Generate my 8 looks →"}
        </button>
      )}
    </div>
  );
}

function LoaderScreen({
  stepIndex,
  subMsgIndex,
}: {
  stepIndex: number;
  subMsgIndex: number;
}) {
  const pct = Math.min(100, Math.round((stepIndex / (HAIR_LOADER_STEPS.length - 1)) * 100));

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        Generating your looks
      </p>

      {/* Progress bar */}
      <div className="mt-8 w-full max-w-xs">
        <div className="h-[1px] w-full bg-white/10">
          <div
            className="h-full bg-white/60 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-light text-white/70">
          {HAIR_LOADER_STEPS[stepIndex]?.label ?? "Almost done…"}
        </p>
      </div>

      {/* Sub-message */}
      <p className="mt-6 text-[11px] text-white/35 transition-opacity duration-500">
        {HAIR_LOADER_SUBMESSAGES[subMsgIndex]}
      </p>

      <p className="mt-10 text-xs text-white/25">
        This takes about 30 seconds.
      </p>
    </div>
  );
}
