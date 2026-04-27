"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFirebase } from "@/app/firebase/firebase-provider";
import type { Job, Tool } from "@/lib/tools/types";

type Props = { tool: Tool };

export default function ResultView({ tool }: Props) {
  const { user, initialized, loading } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams?.get("jobId") ?? null;

  const [job, setJob] = useState<Job | null>(null);
  const [docMissing, setDocMissing] = useState<boolean>(false);
  const [subError, setSubError] = useState<string | null>(null);

  // If the visitor is not signed in, send them to sign-in and back here.
  useEffect(() => {
    if (initialized && !loading && !user) {
      const next = jobId
        ? `/tools/${tool.slug}/result?jobId=${encodeURIComponent(jobId)}`
        : `/tools/${tool.slug}`;
      router.replace(`/login?register=true&next=${encodeURIComponent(next)}`);
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
          }
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

  // Auth still loading
  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Spinner message="Loading…" />
        </main>
      </div>
    );
  }

  // No jobId in query string
  if (!jobId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-semibold text-gray-900">
                Job not found
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                We couldn't find a job ID in this URL.
              </p>
              <div className="mt-6">
                <Button
                  asChild
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  <Link href={`/tools/${tool.slug}`}>
                    Back to {tool.name}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (subError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <h1 className="text-lg font-semibold text-red-900">
                Couldn't load job
              </h1>
              <p className="mt-2 text-sm text-red-800">{subError}</p>
              <div className="mt-4">
                <Button
                  asChild
                  variant="outline"
                  className="border-red-300 text-red-800 hover:bg-red-100"
                >
                  <Link href={`/tools/${tool.slug}`}>
                    Back to {tool.name}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Failed
  if (job?.status === "failed") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <h1 className="text-lg font-semibold text-amber-900">
                Generation failed
              </h1>
              <p className="mt-2 text-sm text-amber-800">
                {job.error ||
                  "Something went wrong while generating your image."}
              </p>
              <p className="mt-2 text-sm font-medium text-emerald-800">
                Credits refunded — your {job.creditCost}{" "}
                {job.creditCost === 1 ? "credit" : "credits"} have been returned to
                your balance.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  <Link href={`/tools/${tool.slug}`}>Try again</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Complete
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
          // User cancelled — fall through silently to clipboard fallback
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="animate-in fade-in duration-500">
            <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900 md:text-3xl">
              Your {tool.name} is ready
            </h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.outputDownloadUrl}
              alt={`${tool.name} result`}
              loading="eager"
              className="mx-auto w-full max-w-2xl rounded-2xl shadow-lg"
            />
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <a href={job.outputDownloadUrl} download>
                  Download
                </a>
              </Button>
              <Button variant="outline" onClick={handleShare}>
                Share
              </Button>
              <Button asChild variant="outline">
                <Link href={`/tools/${tool.slug}`}>Generate another</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Processing (or doc not yet present)
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="animate-in fade-in duration-500">
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

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Story<span className="text-orange-500">{`{InColor}`}</span>
        </Link>
        <Link
          href="/credits"
          className="text-sm font-medium text-gray-700 hover:text-orange-600"
        >
          Buy credits
        </Link>
      </div>
    </header>
  );
}

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      <p className="mt-4 text-sm font-medium text-gray-700">{message}</p>
    </div>
  );
}

function ProcessingAnimation({ toolName }: { toolName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        aria-hidden="true"
        className="mb-6"
      >
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="#fed7aa"
          strokeWidth="2"
          opacity="0.6"
        >
          <animate
            attributeName="r"
            values="32;52;32"
            dur="2.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.1;0.7"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx="60"
          cy="60"
          r="34"
          fill="none"
          stroke="#fb923c"
          strokeWidth="2"
          opacity="0.7"
        >
          <animate
            attributeName="r"
            values="22;40;22"
            dur="2.4s"
            begin="0.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.2;0.8"
            dur="2.4s"
            begin="0.4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="60" cy="60" r="10" fill="#f97316">
          <animate
            attributeName="r"
            values="9;12;9"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      <p className="text-base font-semibold text-gray-900">
        Working on your {toolName}…
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Usually 20-40 seconds
      </p>
    </div>
  );
}
