"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import {
  Sparkles,
  ArrowLeft,
  Upload as UploadIcon,
  Play,
  Loader2,
  CreditCard,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFirebase } from "@/app/firebase/firebase-provider";
import {
  getUserCredits,
  formatCreditBalance,
} from "@/app/firebase/credits-helpers";
import { getConfiguredStorage } from "@/app/firebase/storage-helpers";
import type { Tool } from "@/lib/tools/types";

type Props = { tool: Tool };

const ACCEPTED_TYPES: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Client-side authenticated workflow for a tool. Sits alongside the static
 * MarketingView in /readings/[slug]/page.tsx; on hydration we set
 * `data-tool-auth="signed-in" | "signed-out"` on <html>, and CSS in
 * globals.css hides the SEO marketing view for signed-in visitors and hides
 * this workflow for signed-out visitors.
 */
export default function ToolWorkflow({ tool }: Props) {
  const { user, loading, initialized } = useFirebase();

  // Drive page-level visibility — see comment in globals.css for the
  // signed-in/out CSS toggle and the no-cleanup rationale.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!initialized || loading) {
      root.setAttribute("data-tool-auth", "loading");
      return;
    }
    root.setAttribute("data-tool-auth", user ? "signed-in" : "signed-out");
  }, [user, loading, initialized]);

  if (loading || !initialized) {
    return null;
  }

  if (!user) {
    return null;
  }

  return <AuthenticatedWorkflow tool={tool} />;
}

/* -------------------------------------------------------------------------- */
/* Authenticated upload + generate workflow                                   */
/* -------------------------------------------------------------------------- */

function AuthenticatedWorkflow({ tool }: { tool: Tool }) {
  const { user } = useFirebase();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const returnPath = `/readings/${tool.slug}`;
  const purchaseHref = `/credits?next=${encodeURIComponent(returnPath)}`;

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;
    (async () => {
      try {
        const c = await getUserCredits(user.uid);
        if (!cancelled) setCredits(c.balance ?? 0);
      } catch (err) {
        console.error("Failed to load credits:", err);
        if (!cancelled) setCredits(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    setError(null);
    if (rejected && rejected.length > 0) {
      const reason = rejected[0]?.errors?.[0]?.message ?? "File rejected";
      setError(reason);
      toast.error(reason);
      return;
    }
    if (accepted.length === 0) return;
    setFile(accepted[0]);
    setUploadProgress(0);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: isSubmitting,
  });

  const insufficientCredits = credits !== null && credits < tool.creditCost;
  const generateDisabled =
    !file ||
    isSubmitting ||
    credits === null ||
    !user?.uid;
  const needsPurchase = !!file && insufficientCredits;

  async function handleGenerate() {
    if (!file || !user?.uid) return;

    if (credits !== null && credits < tool.creditCost) {
      router.push(purchaseHref);
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    setError(null);

    try {
      const [{ ref, uploadBytesResumable }, { getFunctions, httpsCallable }] =
        await Promise.all([
          import("firebase/storage"),
          import("firebase/functions"),
        ]);

      const storage = getConfiguredStorage();
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const storagePath = `users/${user.uid}/uploads/${uuidv4()}.${ext}`;
      const storageRef = ref(storage, storagePath);

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file, {
          contentType: file.type || undefined,
        });
        task.on(
          "state_changed",
          (snap) => {
            const pct = snap.totalBytes
              ? (snap.bytesTransferred / snap.totalBytes) * 100
              : 0;
            setUploadProgress(pct);
          },
          (uploadErr) => reject(uploadErr),
          () => resolve(),
        );
      });

      setUploadProgress(100);

      const functions = getFunctions();
      // 5 minutes — matches the server-side timeoutSeconds: 300 on the
      // callable. The default httpsCallable timeout is 70s which would
      // surface as "Generation failed" on slow OpenAI runs even though the
      // server is still working.
      const generate = httpsCallable(functions, "generateForTool", {
        timeout: 5 * 60 * 1000,
      });

      // Pre-generate jobId so the client knows where to poll. The server
      // accepts this jobId and uses it for the job/generation docs, which
      // means we can navigate to /result immediately and let the result
      // page subscribe to the job.
      const jobId = uuidv4();

      const generatePromise = generate({
        toolId: tool.id,
        photoStoragePath: storagePath,
        jobId,
      });

      router.push(`/readings/${tool.slug}/result?jobId=${jobId}`);

      // Fast-fail bounce-back for client-detectable rejections (quota,
      // insufficient credits, daily-free-cap, etc.) — see comment in original
      // implementation for the rationale.
      generatePromise.catch((err: any) => {
        const code = String(err?.code ?? "");
        const message: string = err?.message ?? "";
        const fastFailCodes = [
          "resource-exhausted",
          "failed-precondition",
          "invalid-argument",
          "permission-denied",
          "unauthenticated",
        ];
        if (fastFailCodes.some((c) => code.endsWith(c))) {
          // Friendly message for the daily free cap on coloring pages.
          // Server emits 'DAILY_FREE_LIMIT_REACHED — 3 free per day.'
          const friendly = message.includes("DAILY_FREE_LIMIT_REACHED")
            ? `You've used today's free ${tool.name.toLowerCase()} pages. Try again tomorrow.`
            : message || "Couldn't start generation";
          toast.error(friendly);
          router.replace(`/readings/${tool.slug}`);
          return;
        }
        console.error("generateForTool error:", err);
      });
    } catch (err: any) {
      console.error("Generate error:", err);
      const message =
        err?.message ||
        err?.details ||
        "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
      setIsSubmitting(false);
    }
  }

  // Cost label shown to the user. 1 credit == 1 reading on every public
  // surface; coloring-book is free (creditCost 0).
  const isFree = tool.creditCost === 0;
  const creditLabel = isFree
    ? "Free"
    : tool.creditCost === 1
      ? "1 reading"
      : `${tool.creditCost} readings`;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-tool-workflow
        className="flex min-h-screen flex-col bg-black text-white"
      >
        {/* Sticky top bar */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
          <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
            <Link
              href="/dashboard"
              className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/"
              className="hidden text-base font-semibold tracking-[-0.02em] sm:block sm:text-lg"
            >
              <span className="font-light">Story</span>
              <span className="font-semibold">In</span>
              <span className="font-light">Color</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Balance pill is a Link to /credits on every page that
                  shows it — dashboard, reading workflow, etc. — so the
                  user always has a one-click path to top up. The
                  tooltip explains what gets deducted; the link is the
                  action. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={purchaseHref}
                    aria-label="Reading balance — view credit packs"
                    className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
                  >
                    <Sparkles className="h-4 w-4" />
                    {credits === null
                      ? "…"
                      : formatCreditBalance(credits)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  {isFree
                    ? "This reading is on us — no balance used."
                    : `${creditLabel} will come off your balance.`}
                </TooltipContent>
              </Tooltip>
              <Link
                href={purchaseHref}
                className="hidden text-sm font-medium text-gray-300 transition-colors hover:text-white sm:inline-block"
              >
                Buy more
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
          <div className="container mx-auto max-w-6xl">
            <nav
              className="mb-8 text-xs text-gray-500"
              aria-label="Breadcrumb"
            >
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link
                    href="/readings"
                    className="transition-colors hover:text-white"
                  >
                    Readings
                  </Link>
                </li>
                <li aria-hidden="true" className="text-white/20">
                  /
                </li>
                <li className="text-gray-300">{tool.name}</li>
              </ol>
            </nav>

            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
              {/* Left: title + form */}
              <section>
                <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
                  <span
                    className="h-px w-8 bg-white/20"
                    aria-hidden="true"
                  />
                  {tool.category} reading
                </div>
                <h1
                  className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
                >
                  {tool.name}
                </h1>
                <p className="mt-3 text-lg italic font-light text-gray-300 md:text-xl">
                  {tool.tagline}.
                </p>
                <p className="mt-4 text-sm text-gray-400 md:text-base">
                  {tool.heroCopy}
                </p>

                <div className="liquid-glass mt-8 rounded-2xl p-6">
                  <div
                    {...getRootProps()}
                    className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                      isDragActive
                        ? "border-white/40 bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    } ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input {...getInputProps()} />
                    {previewUrl ? (
                      <div className="flex flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Selected preview"
                          className="max-h-44 rounded-lg border border-white/10 object-contain"
                        />
                        <p className="text-sm text-gray-200">
                          {file?.name}{" "}
                          <span className="text-gray-500">
                            ({Math.round((file?.size ?? 0) / 1024)} KB)
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Click or drop another to replace
                        </p>
                      </div>
                    ) : (
                      <>
                        <UploadIcon className="mb-3 h-7 w-7 text-gray-400" />
                        <p className="text-base font-medium text-white">
                          {isDragActive
                            ? "Drop your photo here"
                            : "Drag & drop a photo, or click to choose"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          PNG, JPG, or WEBP up to 10MB
                        </p>
                      </>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    {tool.inputHint}
                  </p>

                  {isSubmitting && (
                    <div className="mt-4">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(uploadProgress)}
                      >
                        <div
                          className="h-full bg-white transition-all duration-200 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-300">
                        {uploadProgress < 100
                          ? `Uploading… ${Math.round(uploadProgress)}%`
                          : `Reading your ${tool.name.toLowerCase()}…`}
                      </p>
                    </div>
                  )}

                  {error && (
                    <p
                      className="mt-3 text-sm text-rose-300"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  {needsPurchase && (
                    <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-amber-100">
                            Your photo is ready for a premium reading.
                          </p>
                          <p className="mt-1 text-sm text-amber-100/80">
                            Purchase readings to continue with {tool.name}.
                            After checkout, you'll come back here to start.
                          </p>
                          <Link
                            href={purchaseHref}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                          >
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                            Purchase readings
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-400">
                        Cost:
                      </span>
                      <span className="font-medium text-white tabular-nums">
                        {creditLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generateDisabled}
                      aria-busy={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-all duration-150 hover:bg-gray-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Reading…
                        </>
                      ) : needsPurchase ? (
                        <>
                          <CreditCard className="h-4 w-4" />
                          Purchase readings
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 fill-black" />
                          Read my photo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {/* Right: preview + hint. Use object-contain so the cover
                  image (2:3 portrait spread) is fully visible without
                  cropping. The dark surrounding box becomes letterboxing
                  for any cover whose aspect doesn't match exactly. */}
              <aside>
                <div className="liquid-glass overflow-hidden rounded-2xl">
                  <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tool.coverImage}
                      alt={`${tool.name} sample`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                      How to bring a photo
                    </p>
                    <p className="mt-2 text-sm text-gray-300">
                      {tool.inputHint}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
