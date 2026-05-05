"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { trackQuizPurchase, newEventId } from "@/lib/analytics/events";

type Props = { slug: string };

export default function UnlockedView({ slug }: Props) {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [status, setStatus] = useState<"polling" | "claimed" | "error">(
    "polling",
  );
  const [error, setError] = useState<string | null>(null);
  const [eventId] = useState(() => newEventId());

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing reading token.");
      return;
    }
    let stopped = false;
    let attempts = 0;
    const fn = httpsCallable(getFunctions(), "getQuizPaywallStatus");
    const tick = async () => {
      if (stopped) return;
      attempts++;
      try {
        const res = await fn({ token });
        const data = res.data as { status?: string };
        if (data?.status === "claimed") {
          setStatus("claimed");
          trackQuizPurchase({
            slug,
            pendingReadingToken: token,
            tierId: "monthly",
            valueCents: 1499,
            eventId,
          });
          return;
        }
        if (data?.status === "failed" || data?.status === "expired") {
          setStatus("error");
          setError(`Reading ${data.status}.`);
          return;
        }
        if (attempts > 60) {
          setStatus("error");
          setError(
            "Webhook hasn't fired yet. Check your email — you'll receive a magic link to access your reading.",
          );
          return;
        }
        setTimeout(tick, 2000);
      } catch (err) {
        if (attempts > 5) {
          setStatus("error");
          setError(err instanceof Error ? err.message : String(err));
          return;
        }
        setTimeout(tick, 2000);
      }
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [token, slug, eventId]);

  if (status === "polling") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-white">
        <Loader2 className="h-7 w-7 animate-spin text-white/80" />
        <p className="text-sm text-white/70">Confirming your purchase…</p>
        <p className="max-w-md text-center text-xs text-white/40">
          This usually takes 2–5 seconds.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-white">
        <p className="max-w-md text-center text-sm text-rose-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-white">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-light italic md:text-4xl">
          Here's your full reading.
        </h1>
        <p className="mt-3 text-sm text-white/70">
          We've sent a sign-in link to your email. Click it to open your
          library and re-download your reading any time.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90"
          >
            Open my library
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
