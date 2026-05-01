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
import { getNextTool, getPairingTease } from "@/lib/tools/pairings";
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
        Up to 2 minutes
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
  // Inline button busy states (separate from `loading` for the page itself)
  // — give immediate visual feedback while download fetch / createShareLink
  // are in flight, instead of relying on a toast that takes 200-300ms to
  // render. Refs back the same flags so we can early-exit reentrant clicks
  // before React has flushed the setState.
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const downloadingRef = useRef(false);
  const sharingRef = useRef(false);
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
    const handleDownload = async () => {
      // The HTML `download` attribute is silently ignored for cross-origin
      // URLs (the browser opens the file in-tab instead). Firebase Storage
      // serves from firebasestorage.googleapis.com — a different origin
      // from storyincolor.com — so we must fetch the bytes ourselves and
      // hand the browser a blob URL.
      if (downloadingRef.current) return;
      downloadingRef.current = true;
      setDownloading(true);
      const url = job.outputDownloadUrl!;
      const filename = `storyincolor-${tool.slug}.png`;
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = filename;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } finally {
          // Free the blob a tick after click so Safari has time to grab it.
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
        toast.success("Saved");
      } catch (err) {
        console.error("[download] fetch-as-blob failed:", err);
        // Last-resort fallback: open the URL in a new tab so the user can
        // long-press / right-click → Save. Better than silently failing.
        window.open(url, "_blank", "noopener,noreferrer");
        toast.message("Opened in a new tab — long-press or right-click to save.");
      } finally {
        downloadingRef.current = false;
        setDownloading(false);
      }
    };

    const handleShare = async () => {
      // Build a public, brand-safe share URL by calling the createShareLink
      // callable. This persists a public sharedReadings/{shareId} doc and
      // returns the short id we tack onto /share?id=... — the recipient
      // doesn't need an account or auth token to view it.
      //
      // We mint the share doc on every click; the callable de-dupes
      // server-side per (jobId, uid), so repeat clicks reuse the same id.
      if (sharingRef.current) return;
      if (!user?.uid || !jobId) {
        toast.error("Sign in required to share.");
        return;
      }
      sharingRef.current = true;
      setSharing(true);
      let shareUrl: string;
      try {
        const [{ getFunctions, httpsCallable }] = await Promise.all([
          import("firebase/functions"),
        ]);
        const functions = getFunctions();
        const createShareLink = httpsCallable<
          { jobId: string },
          { shareId: string }
        >(functions, "createShareLink");
        const { data } = await createShareLink({ jobId });
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://storyincolor.com";
        shareUrl = `${origin}/share?id=${encodeURIComponent(data.shareId)}`;
      } catch (err) {
        console.error("[share] createShareLink failed:", err);
        toast.error("Couldn't create share link.");
        sharingRef.current = false;
        setSharing(false);
        return;
      }

      // We deliberately do NOT pass `text` to navigator.share. Some share
      // targets (notably the system "Copy" action on macOS / iOS, and a
      // few messaging apps) concatenate text + url into a single string
      // when the user picks them, producing a polluted URL like
      //   /share?id=<hex>%20Check%20out%20my%20...
      // Keeping just title + url means "Copy" copies just the URL and
      // messaging targets show the URL preview card.
      try {
        const nav: any =
          typeof navigator !== "undefined" ? navigator : undefined;
        if (nav?.share) {
          try {
            await nav.share({
              title: `My ${tool.name} — StoryInColor`,
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
      } finally {
        sharingRef.current = false;
        setSharing(false);
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
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                aria-busy={downloading}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-all duration-150 hover:bg-gray-200 active:scale-[0.97] disabled:cursor-wait disabled:opacity-80"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                aria-busy={sharing}
                className="liquid-glass inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-wait disabled:opacity-80"
              >
                {sharing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Share
                  </>
                )}
              </button>
              <Link
                href={`/readings/${tool.slug}`}
                className="liquid-glass inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
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

            {/* Pairing-driven upsell. Surfaces a complementary reading
                tied thematically to the one just completed — aura→face,
                palm→handwriting, beauty→colour, etc. (see lib/tools/pairings.ts).
                Sits below the action row so the primary download/share
                actions stay top-of-mind, but it's the largest non-action
                element on the page so users actively engaged with their
                result see "what's next" without being shoved into another
                purchase. coloring-book has no pairing — the card hides
                cleanly when getNextTool returns null. */}
            <UpsellCard currentToolId={tool.id} />
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

/**
 * Pairing-driven "Up next" card. Reads from lib/tools/pairings.ts to
 * pick a complementary reading and renders a single editorial card with
 * the paired tool's cover image on the left, a tease line + CTA on the
 * right. The pairing is deterministic per current tool; coloring-book
 * yields null and the card renders nothing.
 */
function UpsellCard({ currentToolId }: { currentToolId: string }) {
  const next = getNextTool(currentToolId);
  if (!next) return null;
  const tease = getPairingTease(currentToolId);
  return (
    <section
      aria-label="Try another reading"
      className="mt-14"
    >
      <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
        <span className="h-px w-8 bg-white/20" aria-hidden="true" />
        Up next
      </div>
      <div className="liquid-glass overflow-hidden rounded-2xl">
        <div className="grid items-center gap-6 p-5 md:grid-cols-[160px_1fr] md:gap-7 md:p-6">
          {/* Cover image — small thumbnail tile so the just-completed
              result above stays the focal point of the page. */}
          <Link
            href={`/readings/${next.slug}`}
            className="block overflow-hidden rounded-xl ring-1 ring-white/5 transition-transform hover:scale-[1.02]"
            aria-label={`Try ${next.name}`}
          >
            <div className="aspect-[2/3] w-full bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={next.coverImage}
                alt={`${next.name} sample`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          </Link>
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-normal tracking-[-0.03em] text-white sm:text-3xl">
              {next.name}{" "}
              <span className="italic font-light text-gray-400">
                — {next.tagline.toLowerCase()}.
              </span>
            </h2>
            <p className="text-sm text-gray-300 md:text-base">{tease}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Link
                href={`/readings/${next.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-all duration-150 hover:bg-gray-200 active:scale-[0.97]"
              >
                Try {next.name}
              </Link>
              <Link
                href="/readings"
                className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
              >
                See all readings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
