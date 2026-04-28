"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getUserCredits, formatCreditBalance } from "@/app/firebase/credits-helpers";
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
 * MarketingView in /tools/[slug]/page.tsx; on hydration we set
 * `data-auth="signed-in" | "signed-out"` on <html>, and CSS in globals hides
 * the SEO marketing view for signed-in visitors and hides this workflow for
 * signed-out visitors.
 */
export default function ToolWorkflow({ tool }: Props) {
  const { user, loading, initialized } = useFirebase();

  // Drive page-level visibility: marketing view shows for signed-out, this
  // workflow shows for signed-in. We deliberately do NOT remove the attribute
  // on unmount — when the user clicks Generate the workflow unmounts as we
  // navigate to /result, and a cleanup-driven removal would briefly flash the
  // marketing surface mid-navigation. The attribute persists across pages and
  // gets re-set on the next workflow mount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!initialized || loading) {
      root.setAttribute("data-tool-auth", "loading");
      return;
    }
    root.setAttribute(
      "data-tool-auth",
      user ? "signed-in" : "signed-out"
    );
  }, [user, loading, initialized]);

  if (loading || !initialized) {
    // Don't render anything; the static marketing view is visible underneath.
    return null;
  }

  if (!user) {
    // Marketing view (server-rendered, sibling) handles the unauth UI.
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
  const [creditDialogOpen, setCreditDialogOpen] = useState<boolean>(false);

  // Load user credit balance
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

  // Manage object URL for preview
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

  const insufficientCredits =
    credits !== null && credits < tool.creditCost;

  const generateDisabled =
    !file ||
    isSubmitting ||
    credits === null ||
    insufficientCredits ||
    !user?.uid;

  const creditsShort =
    credits !== null && credits < tool.creditCost
      ? tool.creditCost - credits
      : 0;

  async function handleGenerate() {
    if (!file || !user?.uid) return;

    if (credits !== null && credits < tool.creditCost) {
      setCreditDialogOpen(true);
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
          () => resolve()
        );
      });

      setUploadProgress(100);

      const functions = getFunctions();
      // 5 minutes — matches the server-side timeoutSeconds: 300 on the
      // callable. The default httpsCallable timeout is 70s which would surface
      // as "Generation failed" on slow OpenAI runs even though the server
      // is still working.
      const generate = httpsCallable(functions, "generateForTool", { timeout: 5 * 60 * 1000 });

      // Pre-generate jobId so the client knows where to poll. The server
      // accepts this jobId and uses it for the job/generation docs, which
      // means we can navigate to /result immediately and let the result
      // page subscribe to the job — the user no longer stares at the
      // upload card for 30s.
      const jobId = uuidv4();

      // Fire-and-forget: the Cloud Function continues running on the server
      // even if the client disconnects, and it writes the final state to
      // users/{uid}/jobs/{jobId} which the result page is subscribed to.
      const generatePromise = generate({
        toolId: tool.id,
        photoStoragePath: storagePath,
        jobId,
      });

      router.push(`/readings/${tool.slug}/result?jobId=${jobId}`);

      // FAST-FAIL bounce-back: rate-limit / insufficient credits / unknown
      // toolId / forbidden storage path all reject BEFORE any job doc is
      // written. Without this handler the result page would spin forever
      // waiting for a job that never exists. On those error codes, route the
      // user back to the workflow with a toast. After the deduction
      // transaction succeeds, the catch path is irrelevant (the job doc
      // exists and the result page subscribes to it).
      generatePromise.catch((err: any) => {
        const code = String(err?.code ?? "");
        const fastFailCodes = [
          "resource-exhausted",
          "failed-precondition",
          "invalid-argument",
          "permission-denied",
          "unauthenticated",
        ];
        if (fastFailCodes.some((c) => code.endsWith(c))) {
          toast.error(err?.message ?? "Couldn't start generation");
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

  return (
    <TooltipProvider delayDuration={200}>
      <div data-tool-workflow className="min-h-screen bg-gray-50">
        {/* Sticky top bar */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              Story<span className="text-orange-500">{`{InColor}`}</span>
            </Link>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Credit balance — tooltip explains generation cost"
                    className="cursor-help rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    {credits === null
                      ? "Loading credits…"
                      : formatCreditBalance(credits)}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {tool.creditCost === 1
                    ? "1 credit will be deducted on generate"
                    : `${tool.creditCost} credits will be deducted on generate`}
                </TooltipContent>
              </Tooltip>
              <Link
                href="/credits"
                className="text-sm font-medium text-gray-700 hover:text-orange-600"
              >
                Buy credits
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
          {/* Back link + breadcrumb */}
          <div className="mb-4 flex flex-col gap-1">
            <Link
              href="/readings"
              className="text-sm font-medium text-gray-600 hover:text-orange-600"
            >
              ← All tools
            </Link>
            <nav className="text-xs text-gray-500" aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link href="/readings" className="hover:text-orange-600">
                    Tools
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-gray-800">{tool.name}</li>
              </ol>
            </nav>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Left: form */}
            <section>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
                {tool.name}
              </h1>
              <p className="mt-2 text-lg text-gray-700">{tool.tagline}</p>
              <p className="mt-4 text-sm text-gray-600">{tool.heroCopy}</p>

              <Card className="mt-6">
                <CardContent className="p-6">
                  <div
                    {...getRootProps()}
                    className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                      isDragActive
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-300 bg-white hover:border-orange-300 hover:bg-orange-50/40"
                    } ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input {...getInputProps()} />
                    {previewUrl ? (
                      <div className="flex flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Selected preview"
                          className="max-h-40 rounded-md border border-gray-200 object-contain"
                        />
                        <p className="text-sm text-gray-700">
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
                        <p className="text-base font-medium text-gray-900">
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

                  <p className="mt-3 text-xs text-gray-500">{tool.inputHint}</p>

                  {/* Upload + generate progress bar */}
                  {isSubmitting && (
                    <div className="mt-4">
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(uploadProgress)}
                      >
                        <div
                          className="h-full bg-orange-500 transition-all duration-200 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-700">
                        {uploadProgress < 100
                          ? `Uploading… ${Math.round(uploadProgress)}%`
                          : `Working on your ${tool.name}… this usually takes 20-40 seconds`}
                      </p>
                    </div>
                  )}

                  {error && (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="cursor-help text-sm text-gray-600">
                          Cost:{" "}
                          <span className="font-medium text-gray-900">
                            {tool.creditCost}{" "}
                            {tool.creditCost === 1 ? "credit" : "credits"}
                          </span>
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        {tool.creditCost === 1
                          ? "1 credit will be deducted on generate"
                          : `${tool.creditCost} credits will be deducted on generate`}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      onClick={handleGenerate}
                      disabled={generateDisabled}
                      className="bg-orange-500 text-white hover:bg-orange-600"
                    >
                      {isSubmitting ? "Working…" : "Generate"}
                    </Button>
                  </div>

                  {insufficientCredits && (
                    <p className="mt-3 text-xs text-amber-700">
                      You need {tool.creditCost} credits to use {tool.name}. You
                      have {credits ?? 0}.{" "}
                      <Link
                        href="/credits"
                        className="font-medium text-orange-600 underline"
                      >
                        Buy more credits
                      </Link>
                      .
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Right: cover + hint */}
            <aside>
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tool.coverImage}
                  alt={`${tool.name} cover`}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-4 text-sm text-gray-600">{tool.inputHint}</p>
            </aside>
          </div>
        </main>

        {/* Insufficient credits dialog */}
        <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Not enough credits</DialogTitle>
              <DialogDescription>
                You need {tool.creditCost}{" "}
                {tool.creditCost === 1 ? "credit" : "credits"} to use {tool.name}.
                Your current balance is {credits ?? 0}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                asChild
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Link href="/credits">
                  Buy {creditsShort > 0 ? creditsShort : tool.creditCost} more
                  credits → /credits
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
