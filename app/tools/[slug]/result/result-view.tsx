"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFirebase } from "@/app/firebase/firebase-provider";
import type { Job, Tool } from "@/lib/tools/types";

type Props = { tool: Tool };

export default function ResultView({ tool }: Props) {
  const { user, initialized, loading } = useFirebase();
  const searchParams = useSearchParams();
  const jobId = searchParams?.get("jobId") ?? null;

  const [job, setJob] = useState<Job | null>(null);
  const [docMissing, setDocMissing] = useState<boolean>(false);
  const [subError, setSubError] = useState<string | null>(null);

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
                {job.error || "Something went wrong while generating your image."}{" "}
                Your {job.creditCost} credits were refunded.
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
      try {
        await navigator.clipboard.writeText(window.location.href);
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
            <img
              src={job.outputDownloadUrl}
              alt={`${tool.name} result`}
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
                <Link href="/dashboard">Try another tool</Link>
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
          <Spinner message={`Generating your ${tool.name}…`} showDots />
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

function Spinner({
  message,
  showDots = false,
}: {
  message: string;
  showDots?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      <p className="mt-4 text-sm font-medium text-gray-700">
        {message}
        {showDots && <ProgressDots />}
      </p>
    </div>
  );
}

function ProgressDots() {
  return (
    <span className="ml-1 inline-flex">
      <span className="animate-pulse [animation-delay:0ms]">.</span>
      <span className="animate-pulse [animation-delay:200ms]">.</span>
      <span className="animate-pulse [animation-delay:400ms]">.</span>
    </span>
  );
}
