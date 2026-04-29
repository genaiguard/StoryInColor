"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  Share2,
  ArrowLeft,
  Loader2,
  Plus,
} from "lucide-react";

import { useFirebase } from "@/app/firebase/firebase-provider";
import { trackViewReadingResult } from "@/lib/analytics/events";
import type { Job, Tool } from "@/lib/tools/types";

type Props = { tool: Tool };

function ResultHeader() {
  return (
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
          className="text-base font-semibold tracking-[-0.02em] sm:text-lg"
        >
          <span className="font-light">Story</span>
          <span className="font-semibold">In</span>
          <span className="font-light">Color</span>
        </Link>
        <Link
          href="/credits"
          className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
        >
          Top up
        </Link>
      </div>
    </header>
  );
}

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-9 w-9 animate-spin text-white" />
      <p className="mt-4 text-sm font-medium text-gray-300">{message}</p>
    </div>
  );
}

function ProcessingAnimation({ toolName }: { toolName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        aria-hidden="true"
        className="mb-8"
      >
        <circle
          cx="70"
          cy="70"
          r="56"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        >
          <animate
            attributeName="r"
            values="38;62;38"
            dur="2.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.05;0.7"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx="70"
          cy="70"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
        >
          <animate
            attributeName="r"
            values="26;48;26"
            dur="2.6s"
            begin="0.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.85;0.15;0.85"
            dur="2.6s"
            begin="0.4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="70" cy="70" r="11" fill="white">
          <animate
            attributeName="r"
            values="9;13;9"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      <p
        className="text-2xl font-normal tracking-[-0.04em] text-white sm:text-3xl"
      >
        Working on your{" "}
        <span className="italic font-light text-gray-300">
          {toolName.toLowerCase()}.
        </span>
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Usually 20-40 seconds
      </p>
    </div>
  );
}

export default function ResultView({ tool }: Props) {
  const { user, initialized, loading } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams?.get("jobId") ?? null;

  const [job, setJob] = useState<Job | null>(null);
  const [docMissing, setDocMissing] = useState<boolean>(false);
  const [subError, setSubError] = useState<string | null>(null);
  // Fire view_reading_result exactly once per job — Firestore subscription
  // ticks repeatedly even after status flips to complete, so we need a
  // ref-guard to dedupe.
  const resultViewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      job?.status === "complete" &&
      jobId &&
      resultViewedRef.current !== jobId
    ) {
      resultViewedRef.current = jobId;
      trackViewReadingResult({
        toolId: tool.id,
        toolName: tool.name,
        jobId,
      });
    }
  }, [job?.status, jobId, tool.id, tool.name]);

  useEffect(() => {
    if (initialized && !loading && !user) {
      const next = jobId
        ? `/readings/${tool.slug}/result?jobId=${encodeURIComponent(jobId)}`
        : `/readings/${tool.slug}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [initialized, loading, user, router, jobId, tool.slug]);

  useEffect(() => {
    if (!user?.uid || !jobId) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { getFirestore, doc, onSnapshot } = await import(
          "firebase/firestore"
        );
        const db = getFirestore();
        const jobRef = doc(db, "users", user.uid, "jobs", jobId);
        unsubscribe = onSnapshot(
          jobRef,
          (snap) => {
            if (cancelled) return;
            if (!snap.exists()) {
              setDocMissing(true);
              setJob(null);
              return;
            }
            setDocMissing(false);
            setJob(snap.data() as Job);
          },
          (err) => {
            console.error("Job snapshot error:", err);
            if (!cancelled) setSubError(err.message);
          },
        );
      } catch (err: any) {
        console.error("Failed to subscribe to job:", err);
        if (!cancelled) setSubError(err?.message ?? "Failed to load job");
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, jobId]);

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <ResultHeader />
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
          <Spinner message="Loading…" />
        </main>
      </div>
    );
  }

  if (!jobId) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <ResultHeader />
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
          <div className="liquid-glass mx-auto max-w-md rounded-2xl p-8 text-center">
            <h1
              className="text-2xl font-normal tracking-[-0.02em]"
            >
              Job not found
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              We couldn't find a job ID in this URL.
            </p>
            <Link
              href={`/readings/${tool.slug}`}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Back to {tool.name}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (subError) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <ResultHeader />
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
          <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-red-100">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-300" />
              <h1 className="text-lg font-medium">Couldn't load job</h1>
            </div>
            <p className="text-sm text-red-200/90">{subError}</p>
            <Link
              href={`/readings/${tool.slug}`}
              className="liquid-glass mt-5 inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium"
            >
              Back to {tool.name}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (job?.status === "failed") {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <ResultHeader />
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-6 text-amber-100">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h1 className="text-lg font-medium">Generation failed</h1>
            </div>
            <p className="text-sm text-amber-200/90">
              {job.error ||
                "Something went wrong while generating your image."}
            </p>
            {job.refunded ? (
              <p className="mt-3 text-sm font-medium text-emerald-300">
                {job.creditCost === 0
                  ? "No charge — this reading is on us anyway."
                  : `Refunded — ${job.creditCost === 1 ? "1 reading" : `${job.creditCost} readings`} returned to your balance.`}
              </p>
            ) : (
              <p className="mt-3 text-sm text-amber-200/80">
                Refund pending — if your balance hasn't been restored within
                a few minutes, please contact support.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/readings/${tool.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                Try again
              </Link>
              <Link
                href="/dashboard"
                className="liquid-glass inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (job?.status === "complete" && job.outputDownloadUrl) {
    const handleShare = async () => {
      const shareUrl =
        typeof window !== "undefined" ? window.location.href : "";
      const nav: any =
        typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        try {
          await nav.share({
            title: `My ${tool.name}`,
            text: `Check out my ${tool.name} from StoryInColor`,
            url: shareUrl,
          });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      } catch {
        toast.error("Couldn't copy link");
      }
    };

    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <ResultHeader />
        <main className="container mx-auto max-w-4xl flex-1 px-4 py-12 md:px-8 md:py-16">
          <div className="animate-blur-fade-up">
            <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span
                className="h-px w-8 bg-white/20"
                aria-hidden="true"
              />
              Your reading
            </div>
            <h1
              className="mb-8 text-center text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
            >
              Your {tool.name.toLowerCase()} is{" "}
              <span className="italic font-light text-gray-300">ready.</span>
            </h1>
            <div className="liquid-glass overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={job.outputDownloadUrl}
                alt={`${tool.name} result`}
                loading="eager"
                className="mx-auto block w-full object-contain"
              />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={job.outputDownloadUrl}
                download
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                type="button"
                onClick={handleShare}
                className="liquid-glass inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <Link
                href={`/readings/${tool.slug}`}
                className="liquid-glass inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Read another
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <ResultHeader />
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
        <div className="animate-blur-fade-up">
          <ProcessingAnimation toolName={tool.name} />
          {docMissing && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Waiting for the job to start…
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
